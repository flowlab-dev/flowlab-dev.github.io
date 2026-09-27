// Time card math: split shifts, overnight shifts, unpaid breaks, weekly overtime (default after 40 h at 1.5x)
// and optional daily overtime (California style: 1.5x after 8 h a day, 2x after 12 h a day). Pure functions, no DOM — the page and the tests share this file.

/** "8", "8:30", "08:30", "8:30 pm", "8:30PM", "20:30", "8a" → minutes since midnight, or null if not a time */
export function parseTime(raw) {
  const s = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
  const m = s.match(/^(\d{1,2})(?::?(\d{2}))?(a|am|p|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3];
  if (min > 59) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap[0] === 'a' && h === 12) h = 0;
    if (ap[0] === 'p' && h !== 12) h += 12;
  } else if (h > 24 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

/** Minutes worked in one in/out segment; out earlier than (or equal to) in = shift past midnight. */
export function segmentMinutes(inRaw, outRaw) {
  const a = parseTime(inRaw), b = parseTime(outRaw);
  if (a === null || b === null) return null;
  let d = b - a;
  if (d <= 0) d += 24 * 60;
  return d;
}

/**
 * days: [{ segments: [{ in, out }], breakMin }] in the order they were worked (one work week)
 * opts: { rate, weeklyAfter = 40, dailyAfter = null, doubleAfter = 12 (only with dailyAfter), multiplier = 1.5 }
 * Daily overtime hours are not counted again toward the weekly limit (no double overtime).
 * Double time: hours over doubleAfter in one day, paid at 2x; never moved to 1.5x.
 */
export function calcWeek(days, opts = {}) {
  const weeklyAfter = (opts.weeklyAfter ?? 40) * 60;
  const dailyAfter = opts.dailyAfter ? opts.dailyAfter * 60 : null;
  const mult = opts.multiplier ?? 1.5;
  const doubleAfter = dailyAfter === null ? null : (opts.doubleAfter ?? 12) * 60;
  const rate = Number(opts.rate) || 0;
  let regularSoFar = 0;
  const errors = [];
  const perDay = days.map((day, i) => {
    let worked = 0;
    (day.segments || []).forEach((seg, j) => {
      const hasIn = String(seg.in ?? '').trim() !== '', hasOut = String(seg.out ?? '').trim() !== '';
      if (!hasIn || !hasOut) return; // empty or not finished yet (only start typed) — no hours, no error
      const m = segmentMinutes(seg.in, seg.out);
      if (m === null) errors.push({ day: i, segment: j });
      else worked += m;
    });
    worked = Math.max(0, worked - Math.max(0, Math.round(Number(day.breakMin)) || 0));
    const dbl = doubleAfter === null ? 0 : Math.max(0, worked - doubleAfter);
    let reg = dailyAfter === null ? worked : Math.min(worked, dailyAfter);
    let ot = worked - reg - dbl;
    if (regularSoFar + reg > weeklyAfter) {
      const extra = regularSoFar + reg - weeklyAfter;
      reg -= extra;
      ot += extra;
    }
    regularSoFar += reg;
    return { worked, regular: reg, overtime: ot, double: dbl };
  });
  const sum = (k) => perDay.reduce((a, d) => a + d[k], 0);
  const total = sum('worked'), regular = sum('regular'), overtime = sum('overtime'), double = sum('double');
  const cents = (x) => Math.round(x * 100) / 100;
  const regularPay = cents((regular / 60) * rate);
  const overtimePay = cents((overtime / 60) * rate * mult);
  const doublePay = cents((double / 60) * rate * 2);
  return { perDay, total, regular, overtime, double, regularPay, overtimePay, doublePay, grossPay: cents(regularPay + overtimePay + doublePay), errors };
}

/**
 * Several workweeks (biweekly pay period): overtime is counted in each workweek on its own — the FLSA
 * does not allow averaging hours over two or more weeks. weeks: [[day × 7], …]. Totals are sums of the weeks.
 */
export function calcWeeks(weeks, opts = {}) {
  const res = weeks.map((w) => calcWeek(w, opts));
  const sum = (k) => Math.round(res.reduce((a, r) => a + r[k], 0) * 100) / 100;
  const out = { weeks: res, perDay: res.flatMap((r) => r.perDay), errors: res.flatMap((r, w) => r.errors.map((e) => ({ ...e, day: e.day + w * 7 }))) };
  for (const k of ['total', 'regular', 'overtime', 'double', 'regularPay', 'overtimePay', 'doublePay', 'grossPay']) out[k] = sum(k);
  return out;
}

/** 485 → "8:05" */
export const hhmm = (min) => { const m = Math.round(min); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
/** 485 → "8.08" (hours with two decimals, as payroll forms want) */
export const decimalHours = (min) => (Math.round((min / 60) * 100) / 100).toFixed(2);
