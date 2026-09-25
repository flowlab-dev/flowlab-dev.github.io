(function () {
  'use strict';

  // Mobile menu
  var burger = document.querySelector('.burger'), nav = document.getElementById('nav');
  burger.addEventListener('click', function () {
    var open = burger.getAttribute('aria-expanded') !== 'true';
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('open', open);
  });
  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A' && nav.classList.contains('open')) burger.click();
  });

  // Sliders: arrows, dots, swipe (native scroll-snap)
  document.querySelectorAll('[data-slider]').forEach(function (s) {
    var track = s.querySelector('.track'), items = Array.prototype.slice.call(track.children);
    var prev = s.querySelector('.arrow--prev'), next = s.querySelector('.arrow--next'), dotsBox = s.querySelector('.dots');
    var step = function () { return items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : track.clientWidth; };
    var dots = items.map(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-label', 'Go to slide ' + (i + 1));
      b.addEventListener('click', function () { track.scrollTo({ left: i * step(), behavior: 'smooth' }); });
      dotsBox.appendChild(b); return b;
    });
    dotsBox.removeAttribute('aria-hidden');
    function update() {
      var max = track.scrollWidth - track.clientWidth - 2;
      var i = Math.round(track.scrollLeft / Math.max(step(), 1));
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max;
      dots.forEach(function (d, k) { d.setAttribute('aria-current', String(k === Math.min(i, dots.length - 1))); });
      dotsBox.hidden = max <= 0;
    }
    prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  // Date fields: typed MM / DD / YYYY or picked from the native calendar
  function fmt(v) { var p = v.split('-'); return p.length === 3 ? p[1] + ' / ' + p[2] + ' / ' + p[0] : ''; }
  document.querySelectorAll('.field--date').forEach(function (f) {
    var text = f.querySelector('input[name]'), picker = f.querySelector('.picker');
    f.querySelector('.cal').addEventListener('click', function () {
      if (picker.showPicker) { try { picker.showPicker(); return; } catch (e) {} }
      text.focus();
    });
    picker.addEventListener('change', function () { text.value = fmt(picker.value); text.removeAttribute('aria-invalid'); });
    text.addEventListener('input', function () {
      var d = text.value.replace(/\D/g, '').slice(0, 8), out = d.slice(0, 2);
      if (d.length > 2) out += ' / ' + d.slice(2, 4);
      if (d.length > 4) out += ' / ' + d.slice(4);
      text.value = out;
    });
  });

  // Search form: demo only, nothing is sent
  var form = document.getElementById('plan'), msg = form.querySelector('.plan__msg');
  function toDate(v) { var m = /^(\d{2}) \/ (\d{2}) \/ (\d{4})$/.exec(v); return m ? new Date(+m[3], m[1] - 1, +m[2]) : null; }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = [];
    form.querySelectorAll('input[name]').forEach(function (i) {
      var ok = i.checkValidity() && i.value.trim() !== '';
      if (i.name === 'checkin' || i.name === 'checkout') ok = ok && !!toDate(i.value);
      i.setAttribute('aria-invalid', String(!ok));
      if (!ok) bad.push(i);
    });
    var a = toDate(form.checkin.value), b = toDate(form.checkout.value);
    if (!bad.length && a && b && b <= a) { form.checkout.setAttribute('aria-invalid', 'true'); bad.push(form.checkout); msg.textContent = 'Check-out must be after check-in.'; }
    else if (bad.length) msg.textContent = 'Please fill in the highlighted fields.';
    else msg.textContent = 'Demo site: in a real build this search opens your booking system. Nothing was sent.';
    if (bad.length) bad[0].focus();
  });
  form.querySelectorAll('input[name]').forEach(function (i) {
    i.addEventListener('input', function () { if (i.getAttribute('aria-invalid') === 'true') i.removeAttribute('aria-invalid'); });
  });
})();
