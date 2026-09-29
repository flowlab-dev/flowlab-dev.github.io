// Import preview core — runs in the browser and in Node tests. No libraries, nothing leaves the page.
// Flow Lab demo (4. Мастер-приложение, 2026-09-29). Preview only: counts and the first rows with errors.
// Rows keep their real spreadsheet numbers (Excel skips empty rows; CSV counts every line).

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 20000;

export class FileProblem extends Error {}

// ─── Reading files ───────────────────────────────────────────────────────

function decodeText(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch { /* not UTF-8: an older Excel or accounting export */ }
  // Russian text in Windows-1251 is mostly high bytes; Western text in Windows-1252 has a few accents among ASCII letters.
  let high = 0, ascii = 0;
  for (const b of bytes) { if (b >= 0x80) high++; else if ((b | 32) >= 97 && (b | 32) <= 122) ascii++; }
  return new TextDecoder(high > ascii * 0.3 ? 'windows-1251' : 'windows-1252').decode(bytes);
}

export function parseCsv(text) {
  text = text.replace(/\u0000/g, '');
  const head = text.split(/\r?\n/).find((l) => l.trim()) || '';
  const delim = [';', '\t', ','].map((d) => [d, head.split(d).length - 1]).sort((a, b) => b[1] - a[1])[0];
  const d = delim[1] > 0 ? delim[0] : ',';
  const rows = [];
  let row = [], cell = '', quoted = false, line = 1, rowLine = 1, filled = 0;
  const end = () => {
    row.push(cell);
    if (row.some((v) => v.trim())) {
      rows.push({ n: rowLine, cells: row });
      if (++filled > MAX_ROWS + 1) throw new FileProblem(`More than ${MAX_ROWS.toLocaleString('en-US')} rows — split the file`);
    }
    row = []; cell = '';
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else { cell += ch; if (ch === '\n') line++; }
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === d) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      end(); line++; rowLine = line;
    } else cell += ch;
  }
  if (cell !== '' || row.length) end();
  return { rows, delim: d };
}

// .xlsx is a zip of XML files: read the central directory, inflate with the browser's own DecompressionStream.
async function unzip(bytes, wanted) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new FileProblem('This is not an .xlsx file. Save it from Excel as .xlsx or CSV');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = {};
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (p + 46 > bytes.length || dv.getUint32(p, true) !== 0x02014b50) throw new FileProblem('The Excel file is damaged — save it again');
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + elen + clen;
    if (!wanted(name)) continue;
    total += usize;
    if (total > 60 * 1024 * 1024) throw new FileProblem('The file is too large once unpacked — split it');
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + csize);
    if (method === 0) out[name] = data;
    else if (method === 8) {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      out[name] = new Uint8Array(await new Response(stream).arrayBuffer());
    } else throw new FileProblem('Unsupported Excel compression — save the file again');
  }
  return out;
}

function xmlText(s) {
  return s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, '&');
}

function colIndex(ref) {
  let n = 0;
  for (const ch of ref) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const P = '(?:[A-Za-z_][\\w.-]*:)?';            // optional namespace prefix: <x:row>, <x:c> from .NET/ERP exports

export async function parseXlsx(bytes) {
  const f = await unzip(bytes, (n) => /^xl\/(sharedStrings\.xml|workbook\.xml|_rels\/workbook\.xml\.rels|worksheets\/[^/]+\.xml)$/.test(n));
  const dec = (k) => (f[k] ? new TextDecoder().decode(f[k]) : '');
  const shared = [...dec('xl/sharedStrings.xml').matchAll(new RegExp(`<${P}si>([\\s\\S]*?)</${P}si>`, 'g'))].map((m) =>
    [...m[1].matchAll(new RegExp(`<${P}t(?:\\s[^>]*)?>([\\s\\S]*?)</${P}t>`, 'g'))].map((t) => xmlText(t[1])).join(''));
  const first = dec('xl/workbook.xml').match(new RegExp(`<${P}sheet\\b[^>]*?\\b(?:r:)?id="([^"]+)"`));
  let path = 'xl/worksheets/sheet1.xml';
  if (first) {
    const rels = dec('xl/_rels/workbook.xml.rels');
    const rel = [...rels.matchAll(/<(?:\w+:)?Relationship\b([^>]*)>/g)].map((m) => m[1]).find((a) => a.includes(`Id="${first[1]}"`));
    const target = rel && (rel.match(/Target="([^"]+)"/) || [])[1];
    if (target) path = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
  }
  const sheet = dec(path) || dec(Object.keys(f).find((k) => k.startsWith('xl/worksheets/')) || '');
  if (!sheet) throw new FileProblem('No sheet with data in this workbook');
  const rows = [];
  let last = 0, blankRun = 0;
  const rowRe = new RegExp(`<${P}row\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${P}row>)`, 'g');
  const cRe = new RegExp(`<${P}c\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${P}c>)`, 'g');
  const vRe = new RegExp(`<${P}v>([\\s\\S]*?)</${P}v>`);
  const isRe = new RegExp(`<${P}is>([\\s\\S]*?)</${P}is>`);
  for (const m of sheet.matchAll(rowRe)) {
    const n = +((m[1].match(/\br="(\d+)"/) || [])[1] || last + 1);
    if (n - last > 1000 && rows.length) break;          // a gap of 1000+ empty rows: formatting to the bottom, no data after
    last = n;
    const cells = [];
    for (const c of (m[2] || '').matchAll(cRe)) {
      const attrs = c[1], body = c[2] || '';
      const ref = (attrs.match(/\br="([A-Z]+)\d+"/) || [])[1];
      const t = (attrs.match(/\bt="([^"]+)"/) || [])[1];
      const v = (body.match(vRe) || [])[1];
      let val = '';
      if (t === 's') val = shared[+v] ?? '';
      else if (t === 'inlineStr') val = xmlText((body.match(isRe) || ['', ''])[1]);
      else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
      else if (v !== undefined) val = xmlText(v);
      const i = ref ? colIndex(ref) : cells.length;
      if (i < 60) cells[i] = val;
    }
    const filled = Array.from(cells, (x) => x ?? '');
    if (!filled.some((x) => String(x).trim())) { if (++blankRun > 1000) break; continue; }
    blankRun = 0;
    rows.push({ n, cells: filled });
    if (rows.length > MAX_ROWS + 1) throw new FileProblem(`More than ${MAX_ROWS.toLocaleString('en-US')} rows — split the file`);
  }
  return { rows, delim: null };
}

// ─── Columns ─────────────────────────────────────────────────────────────

export const FIELDS = {
  order: { label: 'Order number', names: ['order', 'order #', 'order no', 'order number', 'order id', 'invoice', 'invoice #', 'invoice number', 'invoice no', 'reference', 'booking #', 'номер', 'номер документа', 'номер заказа'] },
  customer: { label: 'Customer', names: ['customer', 'customer name', 'client', 'client name', 'company', 'bill to', 'billing name', 'buyer', 'контрагент', 'покупатель', 'клиент'] },
  email: { label: 'Email', names: ['email', 'e-mail', 'email address', 'customer email', 'почта'] },
  amount: { label: 'Amount', names: ['amount', 'total', 'order total', 'grand total', 'price', 'сумма', 'сумма документа', 'итого'] },
  status: { label: 'Status', names: ['status', 'order status', 'payment status', 'financial status', 'статус', 'состояние'] },
  date: { label: 'Date', names: ['date', 'order date', 'created', 'created at', 'invoice date', 'дата'] },
};

const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^0-9a-zа-я#]+/g, ' ').trim();
const BY_NAME = {};
for (const [f, d] of Object.entries(FIELDS)) for (const n of d.names) BY_NAME[norm(n)] ??= f;

export function mapColumns(headers) {
  const h = headers.map(norm);
  const mapping = {}, unused = [];
  // Shopify orders export: «Name» is the order number (#1001), one row per line item
  const shopify = h.includes('name') && (h.includes('financial status') || h.some((x) => x.startsWith('lineitem')));
  headers.forEach((raw, i) => {
    let f = BY_NAME[h[i]] ?? BY_NAME[h[i].replace(/#/g, '').trim()];
    if (shopify && h[i] === 'name') f = 'order';
    if (shopify && h[i] === 'total' && 'amount' in mapping) f = undefined;
    if (f && !(f in mapping)) mapping[f] = i;
    else if (String(raw).trim()) unused.push(String(raw).trim());
  });
  return { mapping, unused, lineItems: shopify || h.some((x) => x.startsWith('lineitem') || x === 'line item') };
}

export async function readTable(name, bytes) {
  if (!bytes.length) throw new FileProblem('The file is empty');
  if (bytes.length > MAX_BYTES) throw new FileProblem('The file is larger than 5 MB — split it');
  const lower = (name || '').toLowerCase();
  let parsed;
  if (lower.endsWith('.xlsx') || (bytes[0] === 0x50 && bytes[1] === 0x4b)) parsed = await parseXlsx(bytes);
  else if (/\.(csv|txt|tsv)$/.test(lower)) parsed = parseCsv(decodeText(bytes));
  else throw new FileProblem('Use an .xlsx or .csv file (an old .xls: open it in Excel and save as .xlsx)');
  const rows = parsed.rows.map((r) => ({ n: r.n, cells: r.cells.map((v) => String(v ?? '').replace(/ /g, ' ').trim()) }))
    .filter((r) => r.cells.some(Boolean));
  if (!rows.length) throw new FileProblem('There is no data in this file');
  // Report titles above the table (QuickBooks «Company / Invoice List»): the header is the row that names the most known columns
  let best = 0, bestScore = -1;
  rows.slice(0, 15).forEach((r, i) => {
    const score = new Set(r.cells.map((c) => BY_NAME[norm(c)] ?? BY_NAME[norm(c).replace(/#/g, '').trim()]).filter(Boolean)).size;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  const headers = rows[best].cells.slice();
  while (headers.length && !headers[headers.length - 1]) headers.pop();
  return { headers, headerRow: rows[best].n, rows: rows.slice(best + 1).map((r) => ({ n: r.n, cells: r.cells.slice(0, headers.length) })), delim: parsed.delim };
}

// ─── Values ──────────────────────────────────────────────────────────────

export function parseAmount(v, { euro = false } = {}) {
  let t = String(v).replace(/[\s  ]/g, '');
  if (/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(t) && /e|\.\d{4,}/i.test(t)) {   // raw number from an Excel formula: 1506.0000000000002, 1.25E+6
    const x = Number(t);
    return Number.isFinite(x) ? Math.round(x * 100) / 100 : null;
  }
  const neg = /^-|^\(.*\)$/.test(t);
  t = t.replace(/^-|^\(|\)$/g, '').replace(/^(?:[A-Z]{2,3}\s?)?[$€£₽]|[$€£₽]$|\b(?:USD|EUR|GBP|CAD|AUD|RUB)\b/gi, '');
  if (t.includes(',') && t.includes('.')) {
    const dec = t.lastIndexOf(',') > t.lastIndexOf('.') ? ',' : '.';
    t = t.split(dec === ',' ? '.' : ',').join('').replace(dec, '.');
  } else if (t.includes(',')) {
    t = /^\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  } else if (euro && /^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, '');                           // «12.500» in a semicolon (European) file is twelve thousand five hundred
  }
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return (neg ? -1 : 1) * Number(t);
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function parseDate(v) {
  const s = String(v).trim().replace(/[ T]\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?\s*([AaPp][Mm])?(\s*(Z|[+-]\d{2}:?\d{2}|[A-Z]{2,4}))?$/, '').trim();
  let y, m, d, r;
  const mon = (w) => MONTHS.indexOf(w.slice(0, 3).toLowerCase()) + 1;
  if ((r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) [, y, m, d] = r;
  else if ((r = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/))) {
    [, m, d, y] = r;                                   // US 9/29/2026; if the first number cannot be a month — UK 29/09/2026
    if (+m > 12) [m, d] = [d, m];
  } else if ((r = s.match(/^(\d{1,2})[.-](\d{1,2})[.-](\d{2,4})$/))) [, d, m, y] = r;
  else if ((r = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/)) && mon(r[1])) { m = mon(r[1]); d = r[2]; y = r[3]; }
  else if ((r = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})\.?[\s-,]+(\d{2,4})$/)) && mon(r[2])) { d = r[1]; m = mon(r[2]); y = r[3]; }
  else if (/^\d{5}(\.\d+)?$/.test(s) && +s > 20000 && +s < 80000) {      // Excel serial date
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(+s) * 864e5).toISOString().slice(0, 10);
  } else return null;
  y = +y < 100 ? 2000 + +y : +y;
  const t = new Date(Date.UTC(y, +m - 1, +d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== +m - 1 || t.getUTCDate() !== +d) return null;
  return t.toISOString().slice(0, 10);
}

// Statuses the demo database understands; the words shops and billing tools really use map onto them.
export const STATUSES = ['New', 'Pending', 'Confirmed', 'Paid', 'Unpaid', 'Overdue', 'Shipped', 'Delivered', 'Completed', 'Cancelled', 'Refunded', 'Failed'];
const SYNONYMS = {
  canceled: 'Cancelled', cancelled: 'Cancelled', voided: 'Cancelled', void: 'Cancelled', open: 'Pending', processing: 'Pending',
  'on hold': 'Pending', authorized: 'Pending', 'partially paid': 'Pending', 'partially refunded': 'Refunded', draft: 'New',
  fulfilled: 'Shipped', unfulfilled: 'Confirmed', succeeded: 'Paid', closed: 'Completed', complete: 'Completed',
  новая: 'New', подтверждена: 'Confirmed', оплачена: 'Paid', отменена: 'Cancelled',
};
export function parseStatus(v) {
  const k = String(v).trim().toLowerCase().replace(/[_-]+/g, ' ');
  return STATUSES.find((s) => s.toLowerCase() === k) || SYNONYMS[k] || null;
}

function closest(word, list) {
  const a = word.toLowerCase();
  let best = null, bestD = 3;
  for (const w of list) {
    const b = w.toLowerCase();
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (dp[a.length][b.length] < bestD) { bestD = dp[a.length][b.length]; best = w; }
  }
  return best;
}

// ─── Plan ────────────────────────────────────────────────────────────────

// db: { orders: {number: {customer, amount, status}}, customers: [names] }
export function plan(table, db) {
  const { mapping, unused, lineItems } = mapColumns(table.headers);
  const result = { mapping, unused, counts: { create: 0, update: 0, same: 0, error: 0 }, newCustomers: new Set(), errors: [], problem: null, rows: 0, lineRows: 0 };
  if (!('order' in mapping)) {
    result.problem = 'No order number column. Name it one of: Order #, Order number, Invoice, Reference.';
    return result;
  }
  if (!table.rows.length) {
    result.problem = 'The file has headers but no data rows.';
    return result;
  }
  const euro = table.delim === ';';
  const known = new Map(Object.keys(db.orders).map((k) => [k.toLowerCase(), k]));
  const customers = new Set(db.customers.map((c) => c.toLowerCase()));
  const seen = new Map();
  for (const { n, cells } of table.rows) {
    const get = (f) => (f in mapping ? cells[mapping[f]] ?? '' : '');
    const order = get('order');
    const totalRe = /^(grand\s+)?totals?\b|^итого|^всего/i;
    if (totalRe.test(order) || (!order && cells.slice(0, 3).some((c) => totalRe.test(c)))) continue;   // «TOTAL» line under a report
    const key = order.toLowerCase();
    if (order && seen.has(key) && lineItems) { result.lineRows++; continue; }   // next line item of the same order
    result.rows++;
    const errs = [];
    const add = (f, msg) => errs.push({ n, column: table.headers[mapping[f]], message: msg, value: get(f) });
    if (!order) add('order', 'Missing order number — a re-upload could not match this row');
    else if (seen.has(key)) add('order', `Duplicate of row ${seen.get(key)}`);
    if (order && !seen.has(key)) seen.set(key, n);
    let amount = null;
    if (get('amount')) {
      amount = parseAmount(get('amount'), { euro });
      if (amount === null) add('amount', 'Not a number (e.g. 1500 or 1,250.50)');
    }
    let status = '';
    if (get('status')) {
      status = parseStatus(get('status'));
      if (!status) {
        const guess = closest(get('status'), [...STATUSES, 'Canceled']);
        add('status', guess ? `Unknown status — did you mean “${guess === 'Canceled' ? 'Cancelled' : guess}”?` : 'Unknown status (see the list of statuses above)');
      }
    }
    const email = get('email');
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) add('email', 'Not a valid email address');
    if (get('date') && !parseDate(get('date'))) add('date', 'Not a date (e.g. 2026-09-29 or 9/29/2026)');
    if (errs.length) {
      result.counts.error++;
      result.errors.push(...errs);
      continue;
    }
    const customer = get('customer');
    if (customer && !customers.has(customer.toLowerCase())) result.newCustomers.add(customer);
    const existing = known.has(key) ? db.orders[known.get(key)] : null;
    if (!existing) { result.counts.create++; continue; }
    const changed = (amount !== null && amount !== existing.amount)
      || (status && status !== existing.status)
      || (customer && customer.toLowerCase() !== existing.customer.toLowerCase());
    result.counts[changed ? 'update' : 'same']++;
  }
  return result;
}
