import { PATIENTS } from "./patients";
import { BILLS } from "./bills";
import { LAB_INVESTIGATIONS } from "./lab";
import { INSURANCE_CLAIMS } from "./insurance";
import { APPOINTMENTS } from "./appointments";
import { OP_VISITS, TODAY } from "./visits";
import { getHospitalBedSummary } from "./wardsBeds";

export function getDashboardStats() {
  const opPatients  = PATIENTS.filter((p) => p.type === "OP").length;
  const ipPatients  = PATIENTS.filter((p) => p.type === "IP" && p.status === "Admitted").length;
  const discharged  = PATIENTS.filter((p) => p.status === "Discharged").length;

  const bedSummary   = getHospitalBedSummary();
  const totalBeds    = bedSummary.total;
  const occupiedBeds = bedSummary.occupied;

  const todayRevenue  = BILLS.filter((b) => b.date === TODAY).reduce((s, b) => s + b.paidAmount, 0);
  const pendingBills  = BILLS.filter((b) => b.status === "Pending" || b.status === "Partial").reduce((s, b) => s + b.dueAmount, 0);

  const pendingLab    = LAB_INVESTIGATIONS.filter((l) => l.status === "Pending" || l.status === "In Progress").length;
  const pendingClaims = INSURANCE_CLAIMS.filter((c) => c.status === "Submitted" || c.status === "Under Review").length;

  const todayAppointments = APPOINTMENTS.filter((a) => a.date === TODAY).length;
  const waitingPatients   = OP_VISITS.filter((v) => v.status === "Waiting").length;

  return {
    totalPatients: PATIENTS.length,
    opPatients, ipPatients, discharged,
    totalBeds, occupiedBeds,
    availableBeds: totalBeds - occupiedBeds,
    bedOccupancy: Math.round((occupiedBeds / totalBeds) * 100),
    todayRevenue, pendingBills,
    pendingLab, pendingClaims,
    todayAppointments, waitingPatients,
  };
}
