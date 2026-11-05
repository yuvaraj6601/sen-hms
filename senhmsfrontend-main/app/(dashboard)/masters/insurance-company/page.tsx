import { redirect } from "next/navigation";

// Redirect to the canonical insurance-companies page
export default function InsuranceCompanyPage() {
  redirect("/masters/insurance-companies");
}
