/**
 * mockData.ts — barrel re-export
 *
 * All data and functions now live in app/_lib/data/* domain modules.
 * This file re-exports everything so existing imports throughout the app
 * require zero changes.
 *
 * Why this helps performance:
 * - Each domain module is a separate JS chunk (~5–15 KB each vs 111 KB monolith)
 * - The bundler can tree-shake: a page that only imports `getBills` no longer
 *   pulls in doctors, patients, lab investigations, etc.
 * - Module-level mutable stores are still singletons — state is shared across
 *   the whole session exactly as before.
 */

export * from "./data/departments";
export * from "./data/doctors";
export * from "./data/patients";
export * from "./data/visits";
export * from "./data/appointments";
export * from "./data/bills";
export * from "./data/expenses";
export * from "./data/insurance";
export * from "./data/lab";
export * from "./data/contacts";
export * from "./data/referrers";
export * from "./data/billing";
export * from "./data/expenseCategories";
export * from "./data/dashboard";
export * from "./data/caseSheet";
export * from "./data/hospitalSettings";
export * from "./data/dailySummary";
