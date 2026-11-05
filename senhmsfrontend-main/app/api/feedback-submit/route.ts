/**
 * /api/feedback-submit — PUBLIC NABH feedback bridge (no JWT).
 *
 * POST /api/feedback-submit — receives the QR feedback form payload and
 *                             forwards it to Spring Boot POST /feedback/submit
 *                             (a permitAll endpoint). Called from the patient's
 *                             phone, so NO authentication cookie is required.
 *
 * Kept on a dedicated path (not the authenticated /api/feedback catch-all) so
 * the staff proxy can safely reject tokenless requests with 401.
 */
import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8080/api";

export async function POST(req: NextRequest) {
  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND}/feedback/submit`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
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
