import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ success: true });

  res.cookies.set("hms_token", "", {
    httpOnly: true,
    path:     "/",
    maxAge:   0,
  });

  res.cookies.set("hms_session", "", {
    httpOnly: false,
    path:     "/",
    maxAge:   0,
  });

  return res;
}
