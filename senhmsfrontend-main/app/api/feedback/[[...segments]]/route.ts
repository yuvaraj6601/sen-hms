/**
 * Catch-all proxy route for /feedback endpoints (STAFF, authenticated).
 * Forwards to Spring Boot with the JWT from the httpOnly cookie.
 *
 * Handles:
 *   GET /api/feedback           → GET /feedback (paginated staff list)
 *   GET /api/feedback/{id}      → GET /feedback/{id} (full record / report source)
 *
 * The PUBLIC submission endpoint lives at /api/feedback-submit (no JWT) so this
 * authenticated guard never blocks the patient-facing QR form.
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

  const path = `/feedback${segments.length ? "/" + segments.join("/") : ""}`;
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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Cannot reach the server." },
      { status: 503 }
    );
  }

  const text = await backendRes.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { success: false, error: text };
  }

  return NextResponse.json(data, { status: backendRes.status });
}

export const GET = handle;
