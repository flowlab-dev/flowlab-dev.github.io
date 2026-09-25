// Pure logic shared by the page (site.js) and the tests: phone, lead validation, calculator.
// The server (php/lib.php) repeats the same rules — the browser check is only for convenience.

export function normalizePhone(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  else if (d.length === 10 && '3489'.includes(d[0])) d = '7' + d; // 900…, 812…, 495…, 800…
  if (d.length < 11 || d.length > 15) return null;
  if (d[0] === '7' && d.length !== 11) return null;
  return '+' + d;
}

export function validateLead(fields, values) {
  const errors = {};
  const clean = {};
  for (const f of fields) {
    const raw = String(values[f.name] ?? '').replace(/\r\n/g, '\n').trim();
    if (!raw) {
      if (f.required) errors[f.name] = 'Заполните это поле';
      continue;
    }
    if (f.type === 'tel') {
      const p = normalizePhone(raw);
      if (!p) { errors[f.name] = 'Проверьте номер: нужно 10–11 цифр, например +7 900 123-45-67'; continue; }
      clean[f.name] = p;
      continue;
    }
    if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw)) { errors[f.name] = 'Проверьте адрес почты'; continue; }
    const max = f.max ?? (f.type === 'textarea' ? 1000 : 120);
    if (raw.length > max) { errors[f.name] = `Не больше ${max} знаков`; continue; }
    clean[f.name] = raw;
  }
  if (values.consent !== '1' && values.consent !== true) errors.consent = 'Без согласия мы не можем принять заявку';
  return { ok: Object.keys(errors).length === 0, errors, clean };
}

// Число из поля калькулятора, ограниченное min…max (пусто или не число → значение по умолчанию).
export function calcNumber(f, raw) {
  const n = raw === '' || raw === undefined || raw === null ? NaN : Number(raw);
  const v = Number.isFinite(n) ? n : Number(f.default ?? f.min ?? 1);
  return Math.min(f.max ?? Infinity, Math.max(f.min ?? 0, v));
}

// total = (base + Σ add) × Π multiply + Σ after + Σ perArea; rounded to 10 ₽
// perArea: value × (числовое поле f.per) ÷ (делитель выбранного варианта поля f.divide, option.div) —
// например, плита фундамента за м² пятна дома: площадь ÷ этажность.
export function calcTotal(calc, values) {
  let sum = Number(calc.base) || 0;
  let mul = 1;
  let after = 0;
  const byId = Object.fromEntries(calc.fields.map((f) => [f.id, f]));
  for (const f of calc.fields) {
    let v = 0;
    if (f.type === 'select') {
      const i = Number(values[f.id] ?? 0);
      v = Number(f.options[i]?.value ?? f.options[0].value);
    } else if (f.type === 'number') {
      v = calcNumber(f, values[f.id]);
    } else if (f.type === 'checkbox') {
      if (!values[f.id]) continue;
      v = Number(f.value);
    }
    if (f.effect === 'perArea') {
      const per = byId[f.per] ? calcNumber(byId[f.per], values[f.per]) : 1;
      const d = byId[f.divide];
      const div = d ? Number(d.options[Number(values[f.divide] ?? 0)]?.div ?? 1) || 1 : 1;
      after += v * per / div;
    } else if (f.effect === 'multiply') mul *= v;
    else if (f.effect === 'after') after += v;
    else sum += v;
  }
  return Math.round((sum * mul + after) / 10) * 10;
}

export function calcSummary(calc, values) {
  const parts = [];
  for (const f of calc.fields) {
    if (f.type === 'select') parts.push(`${f.label}: ${f.options[Number(values[f.id] ?? 0)]?.label ?? f.options[0].label}`);
    else if (f.type === 'number') parts.push(`${f.label}: ${calcNumber(f, values[f.id])}`);
    else if (values[f.id]) parts.push(f.label);
  }
  return parts.join('; ');
}

export function formatRub(n) {
  return Math.round(n).toLocaleString('ru-RU').replace(/\s/g, ' ') + ' ₽';
}
