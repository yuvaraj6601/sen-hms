/**
 * Catch-all proxy route for /admissions endpoints.
 * Forwards to Spring Boot with JWT from httpOnly cookie.
 *
 * GET    /api/admissions                              → paginated search
 * GET    /api/admissions/{id}                         → single admission
 * GET    /api/admissions/no/{admissionNo}             → by admission number
 * GET    /api/admissions/patient/{patientId}          → all admissions for patient
 * POST   /api/admissions                              → admit patient
 * PATCH  /api/admissions/{id}/status                 → update condition status
 * POST   /api/admissions/{id}/transfers              → log transfer (ward/bed/doctor)
 * PATCH  /api/admissions/{id}/initiate-discharge     → initiate discharge
 * POST   /api/admissions/{id}/discharge              → complete discharge
 */
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8080/api";

async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ segments?: string[] }> }
) {
  const { segments = [] } = await params;
  const token = (await cookies()).get("hms_token")?.value;

  if (!token) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const path = `/admissions${segments.length ? "/" + segments.join("/") : ""}`;
  const qs   = req.nextUrl.search ?? "";
  const url  = `${BACKEND}${path}${qs}`;

  let body: string | undefined;
  const ct = req.headers.get("content-type") ?? "";
  if (["POST", "PUT", "PATCH"].includes(req.method) && ct.includes("application/json")) {
    body = await req.text();
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(url, {
      method:  req.method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Cannot reach the server." }, { status: 503 });
  }

  const text = await backendRes.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { success: false, error: text }; }
  return NextResponse.json(data, { status: backendRes.status });
}

export const GET    = handle;
export const POST   = handle;
export const PUT    = handle;
export const PATCH  = handle;
export const DELETE = handle;
