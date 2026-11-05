/**
 * Proxy route for /lab/* endpoints.
 * Forwards to Spring Boot with JWT from httpOnly cookie.
 *
 * Handles two body modes:
 *   - application/json  → read as text, forward with JSON content-type
 *   - multipart/form-data → forward raw FormData (file uploads for PDF result type)
 *
 * GET    /api/lab/investigations                → paginated search
 * GET    /api/lab/investigations/{id}           → single record
 * GET    /api/lab/investigations/patient/{id}   → by patient
 * GET    /api/lab/investigations/files/{name}   → stream stored file
 * POST   /api/lab/investigations                → place order (batch)
 * POST   /api/lab/investigations/{id}/upload    → upload PDF/image (multipart)
 * PATCH  /api/lab/investigations/{id}/collect   → collect sample
 * PATCH  /api/lab/investigations/{id}/result    → enter result
 * PATCH  /api/lab/investigations/{id}/cancel    → cancel test
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

  const path = `/lab${segments.length ? "/" + segments.join("/") : ""}`;
  const qs   = req.nextUrl.search ?? "";
  const url  = `${BACKEND}${path}${qs}`;

  const ct = req.headers.get("content-type") ?? "";
  const isMultipart = ct.includes("multipart/form-data");

  // File serving: stream the binary response back directly (PDF / image)
  const isFileServe = segments.includes("files");

  let backendRes: Response;
  try {
    if (isMultipart) {
      // Forward raw FormData — do NOT set Content-Type (fetch sets it with
      // the correct boundary automatically when body is FormData).
      const formData = await req.formData();
      backendRes = await fetch(url, {
        method:  req.method,
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      });
    } else {
      // JSON or body-less requests
      let body: string | undefined;
      if (["POST", "PUT", "PATCH"].includes(req.method) && ct.includes("application/json")) {
        body = await req.text();
      }
      backendRes = await fetch(url, {
        method:  req.method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body,
      });
    }
  } catch {
    return NextResponse.json({ success: false, error: "Cannot reach the server." }, { status: 503 });
  }

  // Stream binary file responses (PDF / images) back unchanged
  if (isFileServe && backendRes.ok) {
    const blob = await backendRes.blob();
    const backendCt = backendRes.headers.get("content-type") ?? "application/octet-stream";
    const disposition = backendRes.headers.get("content-disposition") ?? "";
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
