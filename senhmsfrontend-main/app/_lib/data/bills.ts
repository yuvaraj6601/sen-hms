import type { Bill, Receipt, PaymentRecord, BillStatus } from "../types";

export const BILLS: Bill[] = [
  {
    id: "bill1", billNo: "BILL-001", date: "2025-06-10",
    patientId: "p1", patientName: "Suresh Kumar", uhid: "UH-2025-0001",
    patientType: "OP", age: 45, gender: "Male", phone: "9876500001",
    doctorName: "Dr. Venkatesan R", department: "Cardiology", towards: "OPD",
    items: [
      { id: "i1", serviceCode: "SVC001", modalityName: "Consultation", description: "OPD Consultation", quantity: 1, unitPrice: 500, discount: 0, total: 500 },
      { id: "i2", serviceCode: "SVC004", modalityName: "ECG",          description: "ECG",               quantity: 1, unitPrice: 250, discount: 0, total: 250 },
    ],
    subtotal: 750, totalDiscount: 0, totalAmount: 750, paidAmount: 750, dueAmount: 0,
    paymentMode: "Cash", status: "Paid", isInsurance: false,
    payments: [{ id: "pay1", date: "2025-06-10", amount: 750, paymentMode: "Cash", receivedBy: "Priya Menon" }],
    createdBy: "Priya Menon", createdDate: "2025-06-10",
  },
  {
    id: "bill2", billNo: "BILL-002", date: "2025-06-08",
    patientId: "p3", patientName: "Ravi Shankar", uhid: "UH-2025-0003",
    patientType: "IP", age: 58, gender: "Male", phone: "9876500003",
    doctorName: "Dr. Venkatesan R", department: "Cardiology",
    ward: "ICU", bedNumber: "ICU-02", admittedDate: "2025-06-08", towards: "IPD",
    items: [
      { id: "i3", serviceCode: "SVC005", modalityName: "ICU Charges",  description: "ICU Per Day",        quantity: 7, unitPrice: 3000, discount: 0, total: 21000 },
      { id: "i4", serviceCode: "SVC006", modalityName: "ICU Charges",  description: "Ventilator Per Day", quantity: 5, unitPrice: 2500, discount: 0, total: 12500 },
      { id: "i5", serviceCode: "SVC004", modalityName: "ECG",          description: "ECG",                quantity: 2, unitPrice: 250,  discount: 0, total: 500   },
      { id: "i6", serviceCode: "SVC008", modalityName: "Lab",          description: "CBC",                quantity: 3, unitPrice: 250,  discount: 0, total: 750   },
    ],
    subtotal: 34750, totalDiscount: 0, totalAmount: 34750, paidAmount: 20000, dueAmount: 14750,
    paymentMode: "Insurance", referenceNo: "SH-CLM-2025-001", status: "Partial",
    isInsurance: true, insuranceCompany: "Star Health", policyNo: "SH-2024-98765",
    claimedAmount: 34750, insurancePaidAmount: 20000, insuranceStatus: "Partial",
    insuranceRemarks: "Claim under review — partial pre-auth ₹20,000 received",
    payments: [{ id: "pay2", date: "2025-06-12", amount: 20000, paymentMode: "Insurance", referenceNo: "SH-CLM-2025-001", receivedBy: "Priya Menon" }],
    createdBy: "Priya Menon", createdDate: "2025-06-08",
  },
  {
    id: "bill3", billNo: "BILL-003", date: "2025-06-11",
    patientId: "p5", patientName: "Karthik S", uhid: "UH-2025-0005",
    patientType: "IP", age: 35, gender: "Male", phone: "9876500005",
    doctorName: "Dr. Murugan S", department: "General Surgery",
    ward: "General Ward", bedNumber: "GW-12", admittedDate: "2025-06-11", towards: "IPD",
    items: [
      { id: "i7", serviceCode: "SVC016", modalityName: "Procedures",   description: "Suturing",           quantity: 1, unitPrice: 500, discount: 0,  total: 500  },
      { id: "i8", serviceCode: "SVC011", modalityName: "Ward Charges", description: "General Ward / Day", quantity: 4, unitPrice: 800, discount: 0,  total: 3200 },
      { id: "i9", serviceCode: "SVC001", modalityName: "Consultation", description: "OPD Consultation",   quantity: 1, unitPrice: 500, discount: 50, total: 450  },
    ],
    subtotal: 4200, totalDiscount: 50, totalAmount: 4150, paidAmount: 0, dueAmount: 4150,
    paymentMode: "Cash", status: "Pending", isInsurance: false, payments: [],
    createdBy: "Priya Menon", createdDate: "2025-06-11",
  },
  {
    id: "bill4", billNo: "BILL-004", date: "2025-06-09",
    patientId: "p7", patientName: "Murugesan P", uhid: "UH-2025-0007",
    patientType: "IP", age: 67, gender: "Male", phone: "9876500007",
    doctorName: "Dr. Sathish Kumar", department: "Neurology",
    ward: "HDU", bedNumber: "HDU-03", admittedDate: "2025-06-09", towards: "IPD",
    items: [
      { id: "i10", serviceCode: "SVC011", modalityName: "Ward Charges", description: "General Ward / Day", quantity: 6, unitPrice: 800, discount: 0, total: 4800 },
      { id: "i11", serviceCode: "SVC008", modalityName: "Lab",          description: "CBC",                quantity: 2, unitPrice: 250, discount: 0, total: 500  },
      { id: "i12", serviceCode: "SVC009", modalityName: "Lab",          description: "Blood Sugar (F)",    quantity: 3, unitPrice: 80,  discount: 0, total: 240  },
      { id: "i13", serviceCode: "SVC001", modalityName: "Consultation", description: "OPD Consultation",   quantity: 2, unitPrice: 500, discount: 0, total: 1000 },
    ],
    subtotal: 6540, totalDiscount: 0, totalAmount: 6540, paidAmount: 6540, dueAmount: 0,
    paymentMode: "Insurance", referenceNo: "NIA-CLM-2025-007", status: "Paid",
    isInsurance: true, insuranceCompany: "New India", policyNo: "NIA-2024-11223",
    claimedAmount: 6540, insurancePaidAmount: 6540, insuranceStatus: "Settled",
    insuranceRemarks: "Claim fully settled by New India Assurance",
    payments: [{ id: "pay4", date: "2025-06-15", amount: 6540, paymentMode: "Insurance", referenceNo: "NIA-CLM-2025-007", receivedBy: "Ananya Krishnan" }],
    createdBy: "Priya Menon", createdDate: "2025-06-09",
  },
  {
    id: "bill5", billNo: "BILL-005", date: "2025-06-14",
    patientId: "p6", patientName: "Lakshmi N", uhid: "UH-2025-0006",
    patientType: "OP", age: 52, gender: "Female", phone: "9876500006",
    doctorName: "Dr. Anitha Rao", department: "Dermatology", towards: "OPD",
    items: [
      { id: "i14", serviceCode: "SVC001", modalityName: "Consultation", description: "OPD Consultation", quantity: 1, unitPrice: 500, discount: 0, total: 500 },
      { id: "i15", serviceCode: "SVC015", modalityName: "Procedures",   description: "Dressing",         quantity: 2, unitPrice: 200, discount: 0, total: 400 },
    ],
    subtotal: 900, totalDiscount: 0, totalAmount: 900, paidAmount: 0, dueAmount: 900,
    paymentMode: "Cash", status: "Draft", isInsurance: false, payments: [],
    createdBy: "Priya Menon", createdDate: "2025-06-14",
  },
];

export const RECEIPTS: Receipt[] = [
  { id: "r1", receiptNo: "RCP-001", billNo: "BILL-001", patientName: "Suresh Kumar",  uhid: "UH-2025-0001", date: "2025-06-10", amount: 750,   paymentMode: "Cash",      towards: "OPD", receivedBy: "Priya Menon",    status: "Active" },
  { id: "r2", receiptNo: "RCP-002", billNo: "BILL-002", patientName: "Ravi Shankar",  uhid: "UH-2025-0003", date: "2025-06-12", amount: 20000, paymentMode: "Insurance", towards: "IPD", receivedBy: "Priya Menon",    status: "Active" },
  { id: "r3", receiptNo: "RCP-003", billNo: "BILL-004", patientName: "Murugesan P",   uhid: "UH-2025-0007", date: "2025-06-15", amount: 6540,  paymentMode: "Insurance", towards: "IPD", receivedBy: "Ananya Krishnan", status: "Active" },
];

// ─── Mutable store ────────────────────────────────────────────────────────────
export let _bills: Bill[] = [...BILLS];
let _billCounter = BILLS.length + 1;

function generateBillNo(): string {
  return `BILL-${String(_billCounter++).padStart(3, "0")}`;
}

export function getBills(): Bill[] { return _bills; }
export function getBillById(id: string): Bill | undefined { return _bills.find((b) => b.id === id); }
export function getBillsByPatient(patientId: string): Bill[] { return _bills.filter((b) => b.patientId === patientId); }

export function addBill(data: Omit<Bill, "id" | "billNo">): Bill {
  const b: Bill = { ...data, id: `bill${Date.now()}`, billNo: generateBillNo() };
  _bills = [b, ..._bills];
  return b;
}

export function updateBill(id: string, data: Partial<Bill>): Bill | null {
  const i = _bills.findIndex((b) => b.id === id);
  if (i === -1) return null;
  _bills[i] = { ..._bills[i], ...data };
  return _bills[i];
}

export function recordPayment(billId: string, payment: Omit<PaymentRecord, "id">, receivedBy: string): Bill | null {
  const i = _bills.findIndex((b) => b.id === billId);
  if (i === -1) return null;
  const bill = _bills[i];
  if (bill.status === "Paid" || bill.status === "Cancelled") return null;
  const newPayment: PaymentRecord = { ...payment, id: `pay${Date.now()}`, receivedBy };
  const newPaid = bill.paidAmount + payment.amount;
  const newDue  = Math.max(0, bill.totalAmount - newPaid);
  _bills[i] = {
    ...bill,
    paidAmount: newPaid, dueAmount: newDue,
    paymentMode: payment.paymentMode, referenceNo: payment.referenceNo,
    status: (newDue === 0 ? "Paid" : "Partial") as BillStatus,
    payments: [...bill.payments, newPayment],
  };
  return _bills[i];
}

export function cancelBill(id: string, reason: string): Bill | null {
  const i = _bills.findIndex((b) => b.id === id);
  if (i === -1) return null;
  if (_bills[i].status === "Paid") return null;
  _bills[i] = { ..._bills[i], status: "Cancelled", cancellationReason: reason };
  return _bills[i];
}

export function updateInsurance(billId: string, fields: {
  insuranceCompany?: string; policyNo?: string; claimedAmount?: number;
  insurancePaidAmount?: number; insuranceStatus?: Bill["insuranceStatus"]; insuranceRemarks?: string;
}): Bill | null {
  return updateBill(billId, fields);
}
