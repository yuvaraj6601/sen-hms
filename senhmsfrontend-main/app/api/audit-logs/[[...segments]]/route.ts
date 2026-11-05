/**
 * Catch-all proxy route for the audit-log endpoints.
 *
 * Forwards requests to Spring Boot, injecting the JWT from the httpOnly
 * "hms_token" cookie as a Bearer token. The backend enforces that only a
 * Managing Director may read audit logs and returns 403 otherwise — this
 * route simply relays the backend's status and body.
 *
 * Handles:
 *   GET /api/audit-logs        → Spring GET /audit-logs
 *   GET /api/audit-logs/users  → Spring GET /audit-logs/users
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

  const suffix = segments.length ? `/${segments.join("/")}` : "";
  const springPath = `/audit-logs${suffix}`;
  const qs = req.nextUrl.search ?? "";
  const url = `${BACKEND}${springPath}${qs}`;

  let backendRes: Response;
  try {
    backendRes = await fetch(url, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
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
