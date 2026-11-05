/**
 * Catch-all proxy for /bills endpoints.
 * Forwards to Spring Boot with JWT from httpOnly cookie.
 *
 * GET    /api/bills                      → paginated search
 * GET    /api/bills/{id}                 → single bill
 * GET    /api/bills/patient/{patientId}  → bills by patient
 * POST   /api/bills                      → create bill
 * PUT    /api/bills/{id}                 → update bill (DRAFT/PENDING)
 * PATCH  /api/bills/{id}/payment         → record payment
 * PATCH  /api/bills/{id}/cancel          → cancel bill
 * PATCH  /api/bills/{id}/insurance       → update insurance
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

  const path = `/bills${segments.length ? "/" + segments.join("/") : ""}`;
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
      method: req.method,
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
