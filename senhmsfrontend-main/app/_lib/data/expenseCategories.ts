import type { ExpenseCategory } from "../types";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: "ec1",  categoryCode: "EXC001", name: "Salary & Wages",         description: "Staff monthly salaries and wages",          status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "ec2",  categoryCode: "EXC002", name: "Medical Supplies",       description: "Medicines, consumables and disposables",     status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "ec3",  categoryCode: "EXC003", name: "Equipment Purchase",     description: "Medical equipment buying and procurement",   status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "ec4",  categoryCode: "EXC004", name: "Equipment Maintenance",  description: "Repair, servicing and AMC charges",          status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "ec5",  categoryCode: "EXC005", name: "Electricity & Utility",  description: "EB bill, water charges, gas supply",        status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "ec6",  categoryCode: "EXC006", name: "Housekeeping",           description: "Cleaning, laundry and sanitation services", status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "ec7",  categoryCode: "EXC007", name: "Food & Canteen",         description: "Patient food, staff meals and canteen",      status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "ec8",  categoryCode: "EXC008", name: "Marketing",              description: "Ads, banners, digital and promotions",      status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "ec9",  categoryCode: "EXC009", name: "Rent",                   description: "Building and premises rent",                status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "ec10", categoryCode: "EXC010", name: "Staff Advance",          description: "Salary advance disbursed to staff",         status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "ec11", categoryCode: "EXC011", name: "Travel & Conveyance",    description: "Fuel, transport and travel reimbursements",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
  { id: "ec12", categoryCode: "EXC012", name: "Miscellaneous",          description: "Any other expenses not categorised above",  status: "Active", createdBy: "Dr. Admin", createdDate: "2024-01-01" },
];

let _expenseCategories: ExpenseCategory[] = [...EXPENSE_CATEGORIES];
let _excCodeCounter = EXPENSE_CATEGORIES.length + 1;

function generateExcCode(): string {
  return `EXC${String(_excCodeCounter++).padStart(3, "0")}`;
}

export function getExpenseCategories(): ExpenseCategory[] { return _expenseCategories; }
export function getExpenseCategoryById(id: string) { return _expenseCategories.find((c) => c.id === id); }

export function addExpenseCategory(data: Omit<ExpenseCategory, "id" | "categoryCode">): ExpenseCategory {
  const c: ExpenseCategory = { ...data, id: `ec${Date.now()}`, categoryCode: generateExcCode() };
  _expenseCategories = [..._expenseCategories, c];
  return c;
}

export function updateExpenseCategory(id: string, data: Partial<ExpenseCategory>): ExpenseCategory | null {
  const i = _expenseCategories.findIndex((c) => c.id === id);
  if (i === -1) return null;
  _expenseCategories[i] = { ..._expenseCategories[i], ...data };
  return _expenseCategories[i];
}

export function toggleExpenseCategoryStatus(id: string): void {
  const i = _expenseCategories.findIndex((c) => c.id === id);
  if (i !== -1) _expenseCategories[i].status = _expenseCategories[i].status === "Active" ? "Inactive" : "Active";
}
