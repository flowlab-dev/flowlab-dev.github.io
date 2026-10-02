// Made-up demo data: products, barcodes (EAN-13 in the 200 in-store range, not real products) and three orders from three channels.
const DEMO_PRODUCTS = {
  'WF-340': { sku: 'WF-340', title: 'Wildflower Honey 340g', barcode: '2000001000014' },
  'HE-227': { sku: 'HE-227', title: 'Heather Honey 227g', barcode: '2000001000021' },
  'CR-340': { sku: 'CR-340', title: 'Creamed Honey 340g', barcode: '2000001000038' },
  'CB-200': { sku: 'CB-200', title: 'Honeycomb 200g', barcode: '2000001000045' },
  'WF-1KG': { sku: 'WF-1KG', title: 'Wildflower Honey 1kg', barcode: '2000001000052' },
  'BW-50':  { sku: 'BW-50',  title: 'Beeswax Wraps (3)', barcode: '2000001000069' },
};
const P = (sku, quantity) => ({ ...DEMO_PRODUCTS[sku], quantity });

const DEMO_ORDERS = [
  { id: 1042, name: '#1042', channel: 'Online store', customer: 'A. Taylor', line_items: [
    P('WF-340', 2),
    { sku: 'MM-BOX', title: 'Mix & Match Gift Box', barcode: '', quantity: 1, components: [
      { ...DEMO_PRODUCTS['HE-227'], qty: 1 }, { ...DEMO_PRODUCTS['CR-340'], qty: 1 }, { ...DEMO_PRODUCTS['CB-200'], qty: 1 } ] },
  ] },
  { id: 1043, name: '#1043', channel: 'Shopify POS', customer: 'Shop pickup', line_items: [ P('CR-340', 1), P('BW-50', 1) ] },
  { id: 1044, name: 'W-208', channel: 'Wholesale', customer: 'Corner Deli Ltd', line_items: [ P('WF-1KG', 6), P('HE-227', 12) ] },
];

if (typeof module !== 'undefined') module.exports = { DEMO_PRODUCTS, DEMO_ORDERS };
