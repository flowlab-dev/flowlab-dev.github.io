// Fictional demo database and sample file (names checked by search 2026-09-29: no matching real companies).
export const DEMO_DB = {
  customers: ['Tilbury Lane Interiors', 'Dana Whitcombe', 'Quillfeather Dental'],
  orders: {
    'INV-1041': { customer: 'Tilbury Lane Interiors', amount: 1250, status: 'Confirmed' },
    'INV-1042': { customer: 'Dana Whitcombe', amount: 980, status: 'Confirmed' },
    'INV-1043': { customer: 'Quillfeather Dental', amount: 2400, status: 'Paid' },
  },
};

export const SAMPLE_NAME = 'orders-export-sample.csv';
export const SAMPLE_CSV = `Order #,Date,Customer,Email,Total,Status
INV-1041,2026-09-29,Tilbury Lane Interiors,orders@tilburylane.example.com,"1,250.00",Confirmed
INV-1042,2026-09-29,Dana Whitcombe,dana.w@example.com,980.00,Paid
INV-1047,2026-09-29,Quillfeather Dental,office@quillfeather.example.com,"12,800.00",Paid
INV-1048,2026-09-29,Tilbury Lane Interiors,orders@tilburylane.example.com,325.50,New
INV-1049,2026-09-30,Ostrander & Pike Supply,accounts@ostrander-pike.example.com,700.00,New
INV-1050,2026-09-30,Dana Whitcombe,dana.w@example.com,"1,200.5.0",New
INV-1051,2026-09-30,Quillfeather Dental,office@quillfeather.example.com,210.00,Payed
INV-1048,2026-09-30,Tilbury Lane Interiors,orders@tilburylane.example.com,325.50,New
INV-1052,2026-31-09,Dana Whitcombe,dana.w@example,"1,540.00",Confirmed
,2026-09-30,Quillfeather Dental,office@quillfeather.example.com,90.00,New
`;
