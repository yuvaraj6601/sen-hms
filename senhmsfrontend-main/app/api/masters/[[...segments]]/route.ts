/**
 * Catch-all proxy route for all masters endpoints.
 *
 * Forwards requests to Spring Boot, injecting the JWT from the
 * httpOnly "hms_token" cookie as a Bearer token.
 *
 * Handles:
 *   GET    /api/masters/*           → Spring GET /masters/*
 *   POST   /api/masters/*           → Spring POST /masters/*
 *   PUT    /api/masters/*           → Spring PUT /masters/*
 *   PATCH  /api/masters/*           → Spring PATCH /masters/*
 *   DELETE /api/masters/*           → Spring DELETE /masters/*
 */

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8080/api";

async function handle(req: NextRequest, { params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params;
  const token = (await cookies()).get("hms_token")?.value;

  if (!token) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Build the Spring Boot path: /masters/{...segments}
  const springPath = `/masters/${segments.join("/")}`;

  // Forward query string
  const qs = req.nextUrl.search ?? "";
  const url = `${BACKEND}${springPath}${qs}`;

  // Forward body for POST / PUT / PATCH
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

export const GET    = handle;
export const POST   = handle;
export const PUT    = handle;
export const PATCH  = handle;
export const DELETE = handle;
