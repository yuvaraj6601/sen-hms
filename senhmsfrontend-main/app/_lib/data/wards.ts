import type { Ward, Bed } from "../types";

export const WARDS: Ward[] = [
  {
    id: "w1", name: "ICU", department: "ICU", totalBeds: 12, occupiedBeds: 10,
    beds: [
      { id: "b1",  number: "ICU-01", ward: "ICU", status: "Occupied",    patientId: "p3", patientName: "Ravi Shankar" },
      { id: "b2",  number: "ICU-02", ward: "ICU", status: "Occupied",    patientId: "p3", patientName: "Ravi Shankar" },
      { id: "b3",  number: "ICU-03", ward: "ICU", status: "Available" },
      { id: "b4",  number: "ICU-04", ward: "ICU", status: "Occupied" },
      { id: "b5",  number: "ICU-05", ward: "ICU", status: "Occupied" },
      { id: "b6",  number: "ICU-06", ward: "ICU", status: "Maintenance" },
    ],
  },
  {
    id: "w2", name: "HDU", department: "Neurology", totalBeds: 8, occupiedBeds: 5,
    beds: [
      { id: "b10", number: "HDU-01", ward: "HDU", status: "Occupied" },
      { id: "b11", number: "HDU-02", ward: "HDU", status: "Available" },
      { id: "b12", number: "HDU-03", ward: "HDU", status: "Occupied", patientId: "p7", patientName: "Murugesan P" },
      { id: "b13", number: "HDU-04", ward: "HDU", status: "Occupied" },
      { id: "b14", number: "HDU-05", ward: "HDU", status: "Available" },
      { id: "b15", number: "HDU-06", ward: "HDU", status: "Reserved" },
    ],
  },
  {
    id: "w3", name: "General Ward", department: "General", totalBeds: 30, occupiedBeds: 20,
    beds: Array.from({ length: 15 }, (_, i) => ({
      id: `bgw${i + 1}`,
      number: `GW-${String(i + 1).padStart(2, "0")}`,
      ward: "General Ward",
      status: (i % 3 === 0 ? "Available" : i % 5 === 0 ? "Maintenance" : "Occupied") as Bed["status"],
      patientId:   i === 4 ? "p2" : i === 11 ? "p5" : undefined,
      patientName: i === 4 ? "Meena Devi" : i === 11 ? "Karthik S" : undefined,
    })),
  },
  {
    id: "w4", name: "Private Rooms", department: "General", totalBeds: 10, occupiedBeds: 4,
    beds: Array.from({ length: 10 }, (_, i) => ({
      id: `bpr${i + 1}`,
      number: `PR-${String(i + 1).padStart(2, "0")}`,
      ward: "Private Rooms",
      status: (i < 4 ? "Occupied" : i === 6 ? "Reserved" : "Available") as Bed["status"],
    })),
  },
];
