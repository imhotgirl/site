function initHeroGlobe() {
  var canvas = document.getElementById('hero-globe');
  if (!canvas || typeof d3 === 'undefined') return;

  var context = canvas.getContext('2d');

  var containerWidth = canvas.clientWidth || 260;
  var containerHeight = canvas.clientHeight || 260;
  var radius = Math.min(containerWidth, containerHeight) / 2.3;

  var dpr = window.devicePixelRatio || 1;
  canvas.width = containerWidth * dpr;
  canvas.height = containerHeight * dpr;
  context.scale(dpr, dpr);

  var projection = d3.geoOrthographic()
    .scale(radius)
    .translate([containerWidth / 2, containerHeight / 2])
    .clipAngle(90);

  var path = d3.geoPath().projection(projection).context(context);

  function pointInPolygon(point, polygon) {
    var x = point[0], y = point[1];
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      var xi = polygon[i][0], yi = polygon[i][1];
      var xj = polygon[j][0], yj = polygon[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function pointInFeature(point, feature) {
    var g = feature.geometry;
    if (g.type === 'Polygon') {
      var c = g.coordinates;
      if (!pointInPolygon(point, c[0])) return false;
      for (var i = 1; i < c.length; i++) if (pointInPolygon(point, c[i])) return false;
      return true;
    } else if (g.type === 'MultiPolygon') {
      for (var p = 0; p < g.coordinates.length; p++) {
        var polygon = g.coordinates[p];
        if (pointInPolygon(point, polygon[0])) {
          var inHole = false;
          for (var k = 1; k < polygon.length; k++) if (pointInPolygon(point, polygon[k])) { inHole = true; break; }
          if (!inHole) return true;
        }
      }
      return false;
    }
    return false;
  }

  function generateDotsInPolygon(feature, dotSpacing) {
    var dots = [];
    var bounds = d3.geoBounds(feature);
    var minLng = bounds[0][0], minLat = bounds[0][1], maxLng = bounds[1][0], maxLat = bounds[1][1];
    var stepSize = dotSpacing * 0.11;
    for (var lng = minLng; lng <= maxLng; lng += stepSize) {
      for (var lat = minLat; lat <= maxLat; lat += stepSize) {
        var point = [lng, lat];
        if (pointInFeature(point, feature)) dots.push(point);
      }
    }
    return dots;
  }

  var allDots = [];
  var landFeatures = null;

  var BEAM_COUNT = 8;
  var BEAM_SPEED = 0.9;
  var BEAM_PAUSE_MIN = 0.3;
  var BEAM_PAUSE_MAX = 1.2;
  var ARC_LIFT = 34;
  var beams = [];

  function isVisible(lng, lat, rotation) {
    var centerLng = -rotation[0] * Math.PI / 180;
    var centerLat = -rotation[1] * Math.PI / 180;
    var lngR = lng * Math.PI / 180;
    var latR = lat * Math.PI / 180;
    var cosc = Math.sin(centerLat) * Math.sin(latR) + Math.cos(centerLat) * Math.cos(latR) * Math.cos(lngR - centerLng);
    return cosc > 0.001;
  }

  function pickRandomDot() {
    if (allDots.length === 0) return null;
    var d = allDots[Math.floor(Math.random() * allDots.length)];
    return [d.lng, d.lat];
  }

  function makeBeam(delayed) {
    var from = pickRandomDot();
    var to = pickRandomDot();
    var tries = 0;
    while (to && from && to[0] === from[0] && to[1] === from[1] && tries < 10) { to = pickRandomDot(); tries++; }
    if (!from || !to) return null;
    var distance = d3.geoDistance(from, to);
    return {
      from: from,
      to: to,
      interpolate: d3.geoInterpolate(from, to),
      progress: delayed ? -Math.random() * 1.2 : 0,
      pauseTimer: 0,
      pauseTarget: BEAM_PAUSE_MIN + Math.random() * (BEAM_PAUSE_MAX - BEAM_PAUSE_MIN),
      distance: Math.max(distance, 0.15),
      phase: delayed ? 'waiting' : 'flying'
    };
  }

  function initBeams() {
    beams = [];
    for (var i = 0; i < BEAM_COUNT; i++) beams.push(makeBeam(i > 0));
  }

  function updateBeam(beam, dt) {
    if (!beam) return null;
    if (beam.phase === 'waiting') {
      beam.progress += (dt / 1000) * BEAM_SPEED * (0.9 / beam.distance);
      if (beam.progress >= 0) beam.phase = 'flying';
      return beam;
    }
    if (beam.phase === 'flying') {
      beam.progress += (dt / 1000) * BEAM_SPEED * (0.9 / beam.distance);
      if (beam.progress >= 1) { beam.progress = 1; beam.phase = 'paused'; beam.pauseTimer = 0; }
      return beam;
    }
    beam.pauseTimer += dt / 1000;
    if (beam.pauseTimer >= beam.pauseTarget) return makeBeam(false);
    return beam;
  }

  function liftPoint(proj, t, scaleFactor) {
    var cx = containerWidth / 2, cy = containerHeight / 2;
    var dx = proj[0] - cx, dy = proj[1] - cy;
    var len = Math.hypot(dx, dy) || 1;
    var lift = Math.sin(Math.max(0, Math.min(1, t)) * Math.PI) * ARC_LIFT * scaleFactor;
    return [proj[0] + (dx / len) * lift, proj[1] + (dy / len) * lift];
  }

  function drawBeam(beam, rotation, scaleFactor) {
    if (!beam || beam.phase === 'waiting') return;
    var flyingProgress = Math.min(Math.max(beam.progress, 0), 1);
    var segments = 48;
    var upTo = Math.floor(segments * flyingProgress);

    context.save();
    context.shadowColor = 'rgba(205, 163, 73, 0.9)';
    context.shadowBlur = 7 * scaleFactor;
    context.strokeStyle = 'rgba(242, 211, 138, 0.95)';
    context.lineWidth = 1.8 * scaleFactor;
    context.lineCap = 'round';

    var drawing = false;
    context.beginPath();
    for (var i = 0; i <= upTo; i++) {
      var t = i / segments;
      var pt = beam.interpolate(t);
      var visible = isVisible(pt[0], pt[1], rotation);
      var projected = projection(pt);
      if (visible && projected) {
        var lifted = liftPoint(projected, t, scaleFactor);
        if (!drawing) { context.moveTo(lifted[0], lifted[1]); drawing = true; }
        else context.lineTo(lifted[0], lifted[1]);
      } else drawing = false;
    }
    context.stroke();

    var head = beam.interpolate(flyingProgress);
    if (isVisible(head[0], head[1], rotation)) {
      var headProj = projection(head);
      if (headProj) {
        var headPos = liftPoint(headProj, flyingProgress, scaleFactor);
        context.beginPath();
        context.arc(headPos[0], headPos[1], 2.6 * scaleFactor, 0, 2 * Math.PI);
        context.fillStyle = 'rgba(255, 246, 214, 1)';
        context.fill();
      }
    }

    [beam.from, beam.to].forEach(function (coord) {
      if (!isVisible(coord[0], coord[1], rotation)) return;
      var pos = projection(coord);
      if (!pos) return;
      context.beginPath();
      context.arc(pos[0], pos[1], 2 * scaleFactor, 0, 2 * Math.PI);
      context.fillStyle = 'rgba(23, 184, 118, 0.9)';
      context.fill();
    });

    context.restore();
  }

  function render(rotation) {
    context.clearRect(0, 0, containerWidth, containerHeight);
    var currentScale = projection.scale();
    var scaleFactor = currentScale / radius;

    context.beginPath();
    context.arc(containerWidth / 2, containerHeight / 2, currentScale, 0, 2 * Math.PI);
    context.fillStyle = '#050f0a';
    context.fill();
    context.strokeStyle = '#cda349';
    context.lineWidth = 1.4 * scaleFactor;
    context.stroke();

    if (landFeatures) {
      var graticule = d3.geoGraticule();
      context.beginPath();
      path(graticule());
      context.strokeStyle = '#17b876';
      context.lineWidth = 0.6 * scaleFactor;
      context.globalAlpha = 0.2;
      context.stroke();
      context.globalAlpha = 1;

      context.beginPath();
      landFeatures.features.forEach(function (f) { path(f); });
      context.strokeStyle = '#4dffa8';
      context.lineWidth = 0.8 * scaleFactor;
      context.stroke();

      allDots.forEach(function (dot) {
        var projected = projection([dot.lng, dot.lat]);
        if (projected && projected[0] >= 0 && projected[0] <= containerWidth && projected[1] >= 0 && projected[1] <= containerHeight) {
          context.beginPath();
          context.arc(projected[0], projected[1], 1 * scaleFactor, 0, 2 * Math.PI);
          context.fillStyle = '#17b876';
          context.fill();
        }
      });

      beams.forEach(function (beam) { drawBeam(beam, rotation, scaleFactor); });
    }
  }

  var rotation = [0, 0];
  var autoRotate = true;
  var rotationSpeed = 0.45;
  var lastElapsed = 0;

  function loadWorldData() {
    fetch('https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        landFeatures = data;
        landFeatures.features.forEach(function (feature) {
          generateDotsInPolygon(feature, 16).forEach(function (d) {
            allDots.push({ lng: d[0], lat: d[1] });
          });
        });
        initBeams();
        render(rotation);
      })
      .catch(function (err) { console.error('Globe data failed to load', err); });
  }

  d3.timer(function (elapsed) {
    var dt = elapsed - lastElapsed;
    lastElapsed = elapsed;

    if (autoRotate) {
      rotation[0] += rotationSpeed;
      projection.rotate(rotation);
    }

    beams = beams.map(function (beam) { return updateBeam(beam, dt); });
    render(rotation);
  });

  canvas.addEventListener('mousedown', function (event) {
    autoRotate = false;
    var startX = event.clientX, startY = event.clientY;
    var startRotation = rotation.slice();

    function handleMouseMove(moveEvent) {
      var sensitivity = 0.5;
      var dx = moveEvent.clientX - startX;
      var dy = moveEvent.clientY - startY;
      rotation[0] = startRotation[0] + dx * sensitivity;
      rotation[1] = Math.max(-90, Math.min(90, startRotation[1] - dy * sensitivity));
      projection.rotate(rotation);
      render(rotation);
    }
    function handleMouseUp() {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setTimeout(function () { autoRotate = true; }, 10);
    }
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  });

  canvas.addEventListener('touchstart', function (event) {
    autoRotate = false;
    var touch = event.touches[0];
    var startX = touch.clientX, startY = touch.clientY;
    var startRotation = rotation.slice();

    function handleTouchMove(moveEvent) {
      var t = moveEvent.touches[0];
      var sensitivity = 0.5;
      var dx = t.clientX - startX;
      var dy = t.clientY - startY;
      rotation[0] = startRotation[0] + dx * sensitivity;
      rotation[1] = Math.max(-90, Math.min(90, startRotation[1] - dy * sensitivity));
      projection.rotate(rotation);
      render(rotation);
    }
    function handleTouchEnd() {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      setTimeout(function () { autoRotate = true; }, 10);
    }
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
  }, { passive: true });

  loadWorldData();
}
