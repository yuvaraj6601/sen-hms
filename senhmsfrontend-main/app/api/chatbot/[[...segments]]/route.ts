/**
 * Catch-all proxy route for /chatbot endpoints.
 * Forwards to Spring Boot with the JWT from the httpOnly cookie.
 *
 *   GET  /api/chatbot/questions
 *   POST /api/chatbot/data-query
 *   POST /api/chatbot/diet-plan
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

  const url = `${BACKEND}/chatbot${segments.length ? "/" + segments.join("/") : ""}${req.nextUrl.search ?? ""}`;
  const ct  = req.headers.get("content-type") ?? "";
  const body = req.method === "POST" && ct.includes("application/json") ? await req.text() : undefined;

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

export const GET  = handle;
export const POST = handle;
