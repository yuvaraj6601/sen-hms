import type { Expense } from "../types";

export const EXPENSES: Expense[] = [
  { id: "e1",  expenseNo: "EXP001", date: "2025-06-01", category: "Medical Supplies",      towards: "MediSupply Co.",       amount: 12500,  paymentMode: "Bank Transfer", referenceNo: "UTR202506010011", description: "Surgical gloves and syringes",              preparedBy: "Priya Menon",   approvedBy: "Dr. Admin", status: "Paid" },
  { id: "e2",  expenseNo: "EXP002", date: "2025-06-05", category: "Equipment Maintenance", towards: "CoolTech Services",    amount: 8000,   paymentMode: "Cash",                                         description: "AC service – OPD block",                    preparedBy: "Priya Menon",   approvedBy: "Dr. Admin", status: "Approved" },
  { id: "e3",  expenseNo: "EXP003", date: "2025-06-10", category: "Electricity & Utility", towards: "TNEB",                 amount: 45000,  paymentMode: "Bank Transfer", referenceNo: "UTR202506100088", description: "Electricity bill – June 2025",              preparedBy: "Priya Menon",   status: "Pending" },
  { id: "e4",  expenseNo: "EXP004", date: "2025-06-12", category: "Housekeeping",          towards: "CleanFirst Pvt Ltd",   amount: 3200,   paymentMode: "Cash",                                         description: "Cleaning supplies – monthly",               preparedBy: "Deepa Suresh",  approvedBy: "Dr. Admin", status: "Approved" },
  { id: "e5",  expenseNo: "EXP005", date: "2025-06-13", category: "Salary & Wages",        towards: "Staff Payroll – June", amount: 185000, paymentMode: "Bank Transfer", referenceNo: "NEFT20250613",    description: "Monthly salary disbursement",               preparedBy: "Dr. Admin",     approvedBy: "Dr. Admin", status: "Paid" },
  { id: "e6",  expenseNo: "EXP006", date: "2025-06-14", category: "Food & Canteen",        towards: "FreshMeals Pvt Ltd",   amount: 9500,   paymentMode: "Cash",                                         description: "Patient diet and staff meals – week 2",     preparedBy: "Deepa Suresh",  status: "Pending" },
  { id: "e7",  expenseNo: "EXP007", date: "2025-06-14", category: "Travel & Conveyance",   towards: "Fuel & Transport",     amount: 2400,   paymentMode: "Cash",                                         description: "Ambulance fuel – June 1st fortnight",       preparedBy: "Priya Menon",   approvedBy: "Dr. Admin", status: "Approved" },
  { id: "e8",  expenseNo: "EXP008", date: "2025-06-15", category: "Medical Supplies",      towards: "PharmaCare Ltd",       amount: 27000,  paymentMode: "Cheque",        referenceNo: "CHQ004521",      description: "IV fluids, bandages and consumables",       preparedBy: "Karthik Rajan", status: "Pending" },
  { id: "e9",  expenseNo: "EXP009", date: "2025-06-15", category: "Miscellaneous",         towards: "Petty Cash",           amount: 1200,   paymentMode: "Cash",                                         description: "Stationery and printing",                   preparedBy: "Priya Menon",   approvedBy: "Dr. Admin", status: "Approved" },
  { id: "e10", expenseNo: "EXP010", date: "2025-06-08", category: "Equipment Purchase",    towards: "MedEquip Solutions",   amount: 95000,  paymentMode: "Bank Transfer", referenceNo: "UTR202506080055", description: "Pulse oximeter × 4, BP monitor × 2",       preparedBy: "Dr. Admin",     approvedBy: "Dr. Admin", status: "Paid" },
  { id: "e11", expenseNo: "EXP011", date: "2025-06-09", category: "Rent",                  towards: "Building Owner",       amount: 120000, paymentMode: "Cheque",        referenceNo: "CHQ004488",      description: "June 2025 building rent",                   preparedBy: "Dr. Admin",     approvedBy: "Dr. Admin", status: "Paid" },
  { id: "e12", expenseNo: "EXP012", date: "2025-06-11", category: "Marketing",             towards: "DigitalAds Agency",    amount: 15000,  paymentMode: "UPI",           referenceNo: "UPI20250611AG",  description: "Google Ads – hospital awareness campaign",  preparedBy: "Priya Menon",   status: "Rejected", rejectionReason: "Budget not allocated for this month" },
];

let _expenses: Expense[] = [...EXPENSES];
let _expNoCounter = EXPENSES.length + 1;

function generateExpNo(): string {
  return `EXP${String(_expNoCounter++).padStart(3, "0")}`;
}

export function getExpenses(): Expense[] { return _expenses; }
export function getExpenseById(id: string) { return _expenses.find((e) => e.id === id); }

export function addExpense(data: Omit<Expense, "id" | "expenseNo">): Expense {
  const e: Expense = { ...data, id: `exp${Date.now()}`, expenseNo: generateExpNo() };
  _expenses = [e, ..._expenses];
  return e;
}

export function updateExpense(id: string, data: Partial<Expense>): Expense | null {
  const i = _expenses.findIndex((e) => e.id === id);
  if (i === -1) return null;
  _expenses[i] = { ..._expenses[i], ...data };
  return _expenses[i];
}

export function deleteExpense(id: string): void {
  _expenses = _expenses.filter((e) => e.id !== id);
}

export function approveExpense(id: string, approvedBy: string): Expense | null {
  return updateExpense(id, { status: "Approved", approvedBy });
}

export function rejectExpense(id: string, approvedBy: string, reason: string): Expense | null {
  return updateExpense(id, { status: "Rejected", approvedBy, rejectionReason: reason });
}

export function markExpensePaid(id: string): Expense | null {
  return updateExpense(id, { status: "Paid" });
}
