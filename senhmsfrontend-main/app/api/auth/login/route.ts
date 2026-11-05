import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080/api";

// Maps backend UserRole enum → frontend Role type
const ROLE_MAP: Record<string, string> = {
  MANAGING_DIRECTOR:      "Managing Director",
  ADMIN:                  "Admin",
  DOCTOR:                 "Doctor",
  RECEPTIONIST:           "Receptionist",
  LAB_TECH:               "Lab Tech",
  INSURANCE_COORDINATOR:  "Insurance Coordinator",
  NURSE:                  "Nurse",
  LAB_INS_REC:            "Lab/Ins/Reception",
};

export async function POST(req: NextRequest) {
  const body = await req.json();

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email, password: body.password }),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Cannot reach the server. Please try again." },
      { status: 503 }
    );
  }

  const payload = await backendRes.json();

  if (!backendRes.ok || !payload.success) {
    return NextResponse.json(
      { success: false, error: payload.error ?? "Invalid email or password." },
      { status: backendRes.status }
    );
  }

  const data = payload.data as {
    token: string;
    userId: number;
    name: string;
    email: string;
    employeeId: string;
    role: string;
    departmentId: number | null;
    departmentName: string | null;
    doctorId: number | null;
  };

  const role = ROLE_MAP[data.role] ?? data.role;

  // Session metadata stored in a JS-readable cookie (no sensitive data)
  const sessionMeta = {
    id:             String(data.userId),
    employeeId:     data.employeeId,
    name:           data.name,
    email:          data.email,
    role,
    departmentId:   data.departmentId,
    departmentName: data.departmentName,
    doctorId:       data.doctorId,
  };

  const isProd = process.env.NODE_ENV === "production";
  const res    = NextResponse.json({ success: true, session: sessionMeta });

  // 1. httpOnly cookie carries the JWT — inaccessible to JS
  res.cookies.set("hms_token", data.token, {
    httpOnly: true,
    secure:   isProd,
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 24, // 24 hours
  });

  // 2. Readable cookie carries only non-sensitive session data for the UI
  res.cookies.set("hms_session", JSON.stringify(sessionMeta), {
    httpOnly: false,
    secure:   isProd,
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 24,
  });

  return res;
}
