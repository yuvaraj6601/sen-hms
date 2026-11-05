/**
 * /api/tokens — QR self-registration bridge
 *
 * POST /api/tokens  — receives the QR form payload, forwards to Spring Boot
 *                     POST /op-visits/self-register (no JWT needed).
 *                     Returns a simplified token response to the patient form.
 *
 * GET  /api/tokens?date=YYYY-MM-DD — fetches that date's queue from the backend
 *                     filtered to VS (Visitor Self) registrations, so the
 *                     QR Settings dashboard shows only QR-registered tokens.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8080/api";

// ── GET /api/tokens?date=YYYY-MM-DD ──────────────────────────────────────────
// Used by the QR Settings dashboard to show self-registered tokens for a day.
// Requires staff JWT (dashboard is authenticated).
export async function GET(req: NextRequest) {
  const date  = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const token = (await cookies()).get("hms_token")?.value;

  if (!token) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(
      `${BACKEND}/op-visits/queue?date=${date}&registrationSource=VS`,
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );
    const json = await res.json();
    // The QR settings page expects a plain array — extract from ApiResponse wrapper
    const list: Array<{
      id: number; tokenNo: string; uhid: string; patientName: string; phone: string | null;
      address: string | null; age: number | null; gender: string | null;
      visitDate: string; visitTime: string | null; type: string; chiefComplaint: string;
      doctorName: string | null; referredBy: string | null; registrationSource: string;
    }> = json.data ?? [];

    // Map to the shape the QR settings page expects
    const mapped = list.map((v) => ({
      id:           String(v.id),
      tokenNo:      v.tokenNo,
      uhid:         v.uhid ?? "",
      name:         v.patientName,
      mobile:       v.phone ?? "",
      dob:          "",
      age:          v.age ?? 0,
      gender:       v.gender ?? "",
      visitType:    v.type === "FOLLOW_UP" ? "Follow-up" : v.type === "REVIEW" ? "Review" : "New",
      illness:      v.chiefComplaint,
      address:      v.address ?? "",
      doctorName:   v.doctorName ?? "",
      referredBy:   v.referredBy ?? "",
      registeredAt: v.visitTime ?? "",
      date:         v.visitDate,
    }));

    return NextResponse.json(mapped);
  } catch {
    return NextResponse.json([], { status: 200 }); // graceful fallback
  }
}

// ── POST /api/tokens ──────────────────────────────────────────────────────────
// Called from the patient-facing /opd/register form. No JWT required.
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name: string; mobile: string; dob: string; age: number;
    gender: string; visitType: string; regType?: string; illness: string; address?: string;
    date: string; registeredAt: string;
  };

  try {
    const res = await fetch(`${BACKEND}/op-visits/self-register`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name:      body.name,
        mobile:    body.mobile,
        dob:       body.dob || undefined,
        age:       body.age || undefined,
        gender:    body.gender,
        visitType: body.visitType,
        regType:   body.regType || undefined,
        illness:   body.illness,
        address:   body.address || undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: "Registration failed", detail: err },
        { status: res.status }
      );
    }

    const json = await res.json();
    const visit = json.data ?? json;

    // Return the shape the patient form expects
    return NextResponse.json(
      {
        id:           String(visit.id),
        uhid:         visit.uhid ?? "",
        tokenNo:      visit.tokenNo,
        name:         visit.patientName,
        mobile:       visit.phone ?? body.mobile,
        dob:          body.dob,
        age:          visit.age ?? body.age,
        gender:       visit.gender ?? body.gender,
        visitType:    body.visitType,
        regType:      visit.regType ?? body.regType,
        illness:      visit.chiefComplaint ?? body.illness,
        address:      visit.address ?? body.address ?? "",
        visitTime:    visit.visitTime ?? null,
        registeredAt: visit.visitTime ?? body.registeredAt,
        date:         visit.visitDate ?? body.date,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Cannot reach the server." }, { status: 503 });
  }
}
