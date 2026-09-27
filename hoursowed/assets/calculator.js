import { calcWeeks, decimalHours, hhmm } from './calc.js';

const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const root = document.getElementById('calc');
// page presets: data-weeks="2" (biweekly), data-daily="1" (California page), data-key (own saved week per page)
const WEEKS = Number(root.dataset.weeks) === 2 ? 2 : 1;
const KEY = root.dataset.key || 'timecard-site-calc-v1';
const N = 7 * WEEKS;
const $ = (sel) => root.querySelector(sel);
const money = (x) => x.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const blankDay = () => ({ segments: [{ in: '', out: '' }], breakMin: '' });

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
// saved data is trusted only if it has our exact shape; anything else → fresh week
function valid(x) {
  return x && Array.isArray(x.days) && x.days.length === N && x.days.every((d) => d && Array.isArray(d.segments) && d.segments.length >= 1 && d.segments.length <= 6
    && d.segments.every((s) => s && ['in', 'out'].every((k) => s[k] === '' || TIME.test(s[k]))) && /^\d{0,3}(\.\d+)?$/.test(String(d.breakMin ?? '')));
}
const load = () => { try { const x = JSON.parse(localStorage.getItem(KEY)); return valid(x) ? x : null; } catch { return null; } };
const saved = load();
const state = saved ? saved : {
  rate: '', weeklyAfter: 40, dailyOn: root.dataset.daily === '1', dailyAfter: 8, multiplier: 1.5, weekStart: 1, days: Array.from({ length: N }, blankDay) };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: works, just not remembered */ } };

// global day index = week × 7 + weekday; each week listed from the chosen first day
const weekOrder = (w) => Array.from({ length: 7 }, (_, i) => w * 7 + (Number(state.weekStart) + i) % 7);
const order = () => Array.from({ length: WEEKS }, (_, w) => weekOrder(w)).flat();
const dayName = (g) => NAMES[g % 7] + (WEEKS > 1 ? `, week ${Math.floor(g / 7) + 1}` : '');
const icon = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="${d}"/></svg>`;

function renderDays() {
  $('#days').innerHTML = order().map((d, i) => {
    const day = state.days[d];
    const head = WEEKS > 1 && i % 7 === 0 ? `<h3 class="week-h">Week ${i / 7 + 1}</h3>` : '';
    const segs = `<div class="seg seg-h" aria-hidden="true"><span>Start</span><span>End</span><span></span></div>` + day.segments.map((s, j) => `
      <div class="seg">
        <input type="time" data-d="${d}" data-j="${j}" data-k="in" value="${esc(s.in)}" aria-label="${dayName(d)}, shift ${j + 1}, start">
        <input type="time" data-d="${d}" data-j="${j}" data-k="out" value="${esc(s.out)}" aria-label="${dayName(d)}, shift ${j + 1}, end">
        ${j > 0 ? `<button type="button" class="icon-btn" data-del="${d}:${j}" aria-label="Remove ${dayName(d)} shift ${j + 1}">${icon('M6 6l12 12M18 6L6 18')}</button>` : '<span></span>'}
      </div>`).join('');
    return `${head}<div class="day" data-day="${d}">
      <div class="day-name">${NAMES[d % 7]}</div>
      <div class="segs">${segs}<button type="button" class="add-seg" data-add="${d}">+ Add split shift</button></div>
      <div class="day-side">
        <label class="f">Unpaid break, min<input class="brk" type="number" inputmode="numeric" min="0" max="600" step="5" data-d="${d}" data-k="break" value="${esc(day.breakMin)}" placeholder="0"></label>
        <div class="day-total" id="t${d}" aria-live="polite"></div>
      </div>
    </div>`;
  }).join('');
}

function update() {
  const ord = order();
  const r = calcWeeks(Array.from({ length: WEEKS }, (_, w) => weekOrder(w).map((d) => state.days[d])), {
    rate: state.rate, weeklyAfter: Number(state.weeklyAfter) || 40, multiplier: Number(state.multiplier) || 1.5,
    dailyAfter: state.dailyOn ? Number(state.dailyAfter) || 8 : null });
  root.querySelectorAll('input[type=time]').forEach((el) => el.removeAttribute('aria-invalid'));
  r.errors.forEach(({ day, segment }) => root.querySelectorAll(`input[data-d="${ord[day]}"][data-j="${segment}"]`).forEach((el) => el.setAttribute('aria-invalid', 'true')));
  ord.forEach((d, i) => {
    const p = r.perDay[i];
    $(`#t${d}`).innerHTML = p.worked ? `${hhmm(p.worked)}${p.overtime ? `<span class="ot">${hhmm(p.overtime)} overtime</span>` : ''}${p.double ? `<span class="ot">${hhmm(p.double)} double</span>` : ''}` : '<span class="muted">—</span>';
  });
  $('#r-total').textContent = hhmm(r.total);
  $('#r-total-dec').textContent = `${decimalHours(r.total)} h`;
  $('#r-reg').textContent = hhmm(r.regular);
  $('#r-ot').textContent = hhmm(r.overtime);
  $('#r-dbl').textContent = hhmm(r.double);
  $('#s-dbl').hidden = !r.double;
  $('#r-pay').textContent = Number(state.rate) > 0 ? money(r.grossPay) : '—';
  $('#r-pay-note').textContent = Number(state.rate) > 0 ? `${money(r.regularPay)} regular + ${money(r.overtimePay)} overtime${r.double ? ` + ${money(r.doublePay)} double` : ''}` : 'Add your hourly rate';
  $('#err').hidden = !r.errors.length;
  $('#daily-after').disabled = !state.dailyOn;
  save();
  return r;
}

root.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.k === 'in' || el.dataset.k === 'out') state.days[el.dataset.d].segments[el.dataset.j][el.dataset.k] = el.value;
  else if (el.dataset.k === 'break') state.days[el.dataset.d].breakMin = el.value;
  else if (el.name === 'dailyOn') state.dailyOn = el.checked;
  else if (el.name) state[el.name] = el.value;
  if (el.name === 'weekStart') renderDays();
  update();
});
root.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]'), del = e.target.closest('[data-del]');
  if (add) {
    const d = add.dataset.add;
    if (state.days[d].segments.length >= 6) return;
    state.days[d].segments.push({ in: '', out: '' });
    renderDays(); update();
    root.querySelector(`input[data-d="${d}"][data-j="${state.days[d].segments.length - 1}"][data-k="in"]`).focus();
  } else if (del) {
    const [d, j] = del.dataset.del.split(':').map(Number);
    state.days[d].segments.splice(j, 1);
    renderDays(); update();
    root.querySelector(`[data-add="${d}"]`).focus();
  }
});

$('#print').addEventListener('click', () => { $('#print-date').textContent = `Printed ${new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}`; window.print(); });
// one table for both buttons: spreadsheet paste (tab-separated) and a .csv file
function table() {
  const r = update(), ord = order();
  const rows = [['Day', 'Shifts', 'Unpaid break (min)', 'Hours (h:mm)', 'Hours (decimal)', 'Overtime (h:mm)', 'Double time (h:mm)']];
  ord.forEach((d, i) => {
    const day = state.days[d], p = r.perDay[i];
    rows.push([dayName(d), day.segments.filter((s) => s.in && s.out).map((s) => `${s.in}-${s.out}`).join(' '), day.breakMin || 0, hhmm(p.worked), decimalHours(p.worked), hhmm(p.overtime), hhmm(p.double)]);
  });
  rows.push(['Total', '', '', hhmm(r.total), decimalHours(r.total), hhmm(r.overtime), hhmm(r.double)]);
  if (Number(state.rate) > 0) rows.push(['Gross pay (USD)', '', '', '', r.grossPay.toFixed(2), '', '']);
  return rows;
}
const flash = (btn, text) => { const label = btn.textContent; btn.textContent = text; setTimeout(() => (btn.textContent = label), 1600); };
$('#copy').addEventListener('click', async (e) => {
  const tsv = table().map((row) => row.map((c) => String(c).replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
  try { await navigator.clipboard.writeText(tsv); flash(e.currentTarget, 'Copied — paste into a spreadsheet'); }
  catch { flash(e.currentTarget, 'Copy not allowed here — use Download CSV'); }
});
$('#csv').addEventListener('click', () => {
  const csv = table().map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  Object.assign(document.createElement('a'), { href: url, download: 'time-card.csv' }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('#clear').addEventListener('click', () => {
  if (!confirm(WEEKS > 1 ? 'Clear all times for both weeks?' : 'Clear all times for this week?')) return;
  state.days = Array.from({ length: N }, blankDay);
  renderDays(); update();
});

for (const name of ['rate', 'weeklyAfter', 'dailyAfter', 'multiplier', 'weekStart']) root.querySelector(`[name="${name}"]`).value = state[name];
root.querySelector('[name="dailyOn"]').checked = !!state.dailyOn;
renderDays();
update();
