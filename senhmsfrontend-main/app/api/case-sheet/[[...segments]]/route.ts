/**
 * Catch-all proxy route for /case-sheet endpoints.
 * Forwards to Spring Boot with JWT from httpOnly cookie.
 *
 * Handles:
 *   GET    /api/case-sheet/observations?patientId=&admissionId=&visitId=
 *   POST   /api/case-sheet/observations
 *   GET    /api/case-sheet/medications?patientId=&admissionId=&visitId=
 *   POST   /api/case-sheet/medications
 *   PATCH  /api/case-sheet/medications/{id}/stop
 *   GET    /api/case-sheet/vitals?patientId=&admissionId=&visitId=
 *   POST   /api/case-sheet/vitals
 *   POST   /api/case-sheet/documents/upload     (multipart — case document upload)
 *   GET    /api/case-sheet/documents/admission/{id}
 *   GET    /api/case-sheet/documents/visit/{id}
 *   DELETE /api/case-sheet/documents/{id}
 *   GET    /api/case-sheet/documents/files/{name}  (binary stream)
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

  const path = `/case-sheet${segments.length ? "/" + segments.join("/") : ""}`;
  const qs   = req.nextUrl.search ?? "";
  const url  = `${BACKEND}${path}${qs}`;

  const ct          = req.headers.get("content-type") ?? "";
  const isMultipart = ct.includes("multipart/form-data");
  const isFileServe = segments.includes("files");

  let backendRes: Response;
  try {
    if (isMultipart) {
      // Forward raw FormData — browser sets Content-Type with boundary automatically
      const formData = await req.formData();
      backendRes = await fetch(url, {
        method:  req.method,
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      });
    } else {
      let body: string | undefined;
      if (["POST", "PUT", "PATCH"].includes(req.method) && ct.includes("application/json")) {
        body = await req.text();
      }
      backendRes = await fetch(url, {
        method: req.method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body,
      });
    }
  } catch {
    return NextResponse.json(
      { success: false, error: "Cannot reach the server." },
      { status: 503 }
    );
  }

  // Stream binary file responses (PDF / images) back unchanged
  if (isFileServe && backendRes.ok) {
    const blob         = await backendRes.blob();
    const backendCt    = backendRes.headers.get("content-type") ?? "application/octet-stream";
    const disposition  = backendRes.headers.get("content-disposition") ?? "";
    return new NextResponse(blob, {
      status: backendRes.status,
      headers: {
        "Content-Type": backendCt,
        ...(disposition ? { "Content-Disposition": disposition } : {}),
      },
    });
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
