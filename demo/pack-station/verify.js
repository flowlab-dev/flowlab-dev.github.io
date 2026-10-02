// Scan verification for one order: the same code runs in the n8n Code node and on the packing station page.
// order: { id, name, channel, line_items: [{ sku, title, barcode, quantity, components? }] }
//   components (Mix and Match box): [{ sku, title, barcode, qty }] per one box
// scan:  { barcode, scanned: { SKU: count so far } }
function verifyScan(order, scan) {
  const need = {};   // sku -> { title, barcode, qty }
  const add = (sku, title, barcode, qty, box) => {
    const n = need[sku] || (need[sku] = { sku, title, barcode, qty: 0, boxes: [] });
    n.qty += qty;
    if (box && !n.boxes.includes(box)) n.boxes.push(box);
  };
  for (const li of order.line_items || []) {
    if (Array.isArray(li.components) && li.components.length) {
      for (const c of li.components) add(c.sku, c.title, c.barcode, c.qty * li.quantity, li.title);
    } else add(li.sku, li.title, li.barcode, li.quantity);
  }

  const scanned = { ...(scan.scanned || {}) };
  const code = String(scan.barcode || '').trim();
  const item = Object.values(need).find((n) => n.barcode === code);
  const summary = () => {
    const lines = Object.values(need).map((n) => ({ sku: n.sku, title: n.title, need: n.qty, got: scanned[n.sku] || 0, boxes: n.boxes }));
    const total = lines.reduce((s, l) => s + l.need, 0);
    const got = lines.reduce((s, l) => s + Math.min(l.got, l.need), 0);
    return { lines, total, got };
  };

  if (!item) {
    return { status: 'WRONG_SKU', order: order.name, barcode: code, scanned, ...summary(),
      alert: `WRONG SKU on ${order.name}: scanned ${code || '(empty)'}, not in this order` };
  }
  if ((scanned[item.sku] || 0) >= item.qty) {
    return { status: 'EXTRA_ITEM', order: order.name, barcode: code, sku: item.sku, title: item.title, scanned, ...summary(),
      alert: `EXTRA ITEM on ${order.name}: ${item.sku} already complete (${item.qty} of ${item.qty})` };
  }
  scanned[item.sku] = (scanned[item.sku] || 0) + 1;
  const s = summary();
  return { status: s.got === s.total ? 'READY_TO_PACK' : 'OK', order: order.name, barcode: code, sku: item.sku, title: item.title, scanned, ...s };
}
