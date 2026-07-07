document.addEventListener('DOMContentLoaded', function () {
  initNav();
  initRoleForm();
  initOtherToggles();
  initAttachToggles();
  initReveal();
  initCountUp();
  initCursorGlow();
});

function initNav() {
  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      nav.classList.toggle('is-open');
    });
  }
}

function initRoleForm() {
  var form = document.getElementById('apply-form');
  if (!form) return;

  var roleOptions = form.querySelectorAll('.role-option');
  var roleFieldsets = form.querySelectorAll('.role-fields');
  var hint = document.getElementById('form-hint');

  function setActiveRole(role) {
    roleOptions.forEach(function (opt) {
      opt.classList.toggle('is-active', opt.dataset.role === role);
    });
    roleFieldsets.forEach(function (fs) {
      var isVisible = fs.dataset.role === role;
      fs.classList.toggle('is-visible', isVisible);
      var fields = fs.querySelectorAll('input, select, textarea');
      fields.forEach(function (f) {
        f.disabled = !isVisible;
      });
    });
    if (hint) hint.textContent = 'Заполните анкету ниже — она подстроилась под выбранную роль.';
  }

  roleOptions.forEach(function (opt) {
    opt.addEventListener('click', function () {
      var input = opt.querySelector('input');
      if (input) input.checked = true;
      setActiveRole(opt.dataset.role);
    });
  });

  var checkedOption = form.querySelector('.role-option input:checked');
  setActiveRole(checkedOption ? checkedOption.closest('.role-option').dataset.role : roleOptions[0].dataset.role);

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var roleLabels = {
      chat: 'Менеджер чата',
      traffic: 'Трафик-менеджер',
      model: 'Модель',
      other: 'Другое предложение сотрудничества'
    };

    var activeRole = form.querySelector('.role-option.is-active').dataset.role;
    var lines = ['Заявка в команду Divine Agency', 'Роль: ' + roleLabels[activeRole], ''];

    var enabledFields = form.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
    enabledFields.forEach(function (field) {
      if (!field.name || (field.type === 'radio' && !field.checked)) return;
      var label = field.closest('.field') ? field.closest('.field').querySelector('label') : null;
      var labelText = label ? label.textContent.trim() : field.name;

      if (field.type === 'file') {
        if (field.files && field.files[0]) {
          lines.push(labelText + ': файл "' + field.files[0].name + '" (приложите вручную к письму)');
        }
        return;
      }

      var value = field.type === 'checkbox' ? (field.checked ? field.value : null) : field.value;
      if (value) lines.push(labelText + ': ' + value);
    });

    var subject = encodeURIComponent('Заявка в команду Divine — ' + roleLabels[activeRole]);
    var body = encodeURIComponent(lines.join('\n'));
    window.location.href = 'mailto:team@divineagency.co?subject=' + subject + '&body=' + body;

    form.style.display = 'none';
    var success = document.getElementById('form-success');
    if (success) success.classList.add('is-visible');
  });
}

function initOtherToggles() {
  document.querySelectorAll('[data-other-toggle]').forEach(function (checkbox) {
    var field = checkbox.closest('.field');
    var input = field ? field.querySelector('.other-input') : null;
    if (!input) return;
    checkbox.addEventListener('change', function () {
      input.classList.toggle('is-visible', checkbox.checked);
      input.disabled = !checkbox.checked;
      if (!checkbox.checked) input.value = '';
    });
    input.disabled = !checkbox.checked;
  });
}

function initAttachToggles() {
  document.querySelectorAll('.toggle-row').forEach(function (row) {
    var field = row.closest('.field');
    var buttons = row.querySelectorAll('.toggle-btn');
    var panes = field.querySelectorAll('.attach-pane');

    function activate(mode) {
      buttons.forEach(function (btn) {
        btn.classList.toggle('is-active', btn.dataset.attach === mode);
      });
      panes.forEach(function (pane) {
        var isVisible = pane.dataset.attachPane === mode;
        pane.classList.toggle('is-visible', isVisible);
        pane.querySelectorAll('input, textarea').forEach(function (f) {
          f.disabled = !isVisible;
        });
      });
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () { activate(btn.dataset.attach); });
    });

    activate(buttons[0] ? buttons[0].dataset.attach : 'file');
  });
}

function initReveal() {
  var targets = document.querySelectorAll('.reveal');
  if (!targets.length) return;

  if (!('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

  targets.forEach(function (el) { observer.observe(el); });
}

function initCountUp() {
  var targets = document.querySelectorAll('.count-up');
  if (!targets.length || !('IntersectionObserver' in window)) return;

  function animate(el) {
    var raw = el.textContent.trim();
    var match = raw.match(/^([^\d]*)([\d,.]+)([^\d]*)$/);
    if (!match) return;

    var prefix = match[1];
    var numStr = match[2];
    var suffix = match[3];
    var hasComma = numStr.indexOf(',') !== -1;
    var decimals = numStr.indexOf('.') !== -1 ? (numStr.split('.')[1] || '').length : 0;
    var target = parseFloat(numStr.replace(/,/g, ''));
    if (isNaN(target)) return;

    var duration = 1400;
    var start = null;

    function format(value) {
      var fixed = value.toFixed(decimals);
      if (!hasComma) return fixed;
      var parts = fixed.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return parts.join('.');
    }

    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = prefix + format(target * eased) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        animate(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });

  targets.forEach(function (el) { observer.observe(el); });
}

function initCursorGlow() {
  var glow = document.getElementById('cursor-glow');
  if (!glow || window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(pointer: coarse)').matches) {
    return;
  }

  window.addEventListener('mousemove', function (e) {
    glow.classList.add('is-active');
    glow.style.transform = 'translate(' + e.clientX + 'px, ' + e.clientY + 'px)';
  });

  window.addEventListener('mouseleave', function () {
    glow.classList.remove('is-active');
  });
}
