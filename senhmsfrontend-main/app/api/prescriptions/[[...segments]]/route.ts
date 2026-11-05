/**
 * Catch-all proxy route for /prescriptions endpoints.
 * Forwards to Spring Boot with the JWT from the httpOnly cookie.
 *
 *   POST /api/prescriptions/voice-draft   (multipart — recorded audio)
 *   POST /api/prescriptions               (doctor-confirmed save)
 *   GET  /api/prescriptions?admissionId=&visitId=&patientId=
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

  const path = `/prescriptions${segments.length ? "/" + segments.join("/") : ""}`;
  const url  = `${BACKEND}${path}${req.nextUrl.search ?? ""}`;
  const ct   = req.headers.get("content-type") ?? "";

  let backendRes: Response;
  try {
    if (ct.includes("multipart/form-data")) {
      const formData = await req.formData();
      backendRes = await fetch(url, {
        method: req.method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
    } else {
      const body = ["POST", "PUT", "PATCH"].includes(req.method) && ct.includes("application/json")
        ? await req.text()
        : undefined;
      backendRes = await fetch(url, {
        method: req.method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body,
      });
    }
  } catch {
    return NextResponse.json({ success: false, error: "Cannot reach the server." }, { status: 503 });
  }

  const text = await backendRes.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { success: false, error: text }; }
  return NextResponse.json(data, { status: backendRes.status });
}

export const GET  = handle;
export const POST = handle;
