import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const SESSION_COOKIE = "dashboard_session";
const SESSION_VALUE = "authenticated";
const SEVEN_DAYS = 60 * 60 * 24 * 7;

export async function POST(request: NextRequest) {
  const { name, password } = await request.json();

  // Get client IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  // Check password
  const correctPassword = process.env.DASHBOARD_PASSWORD;
  if (!correctPassword || password !== correctPassword) {
    // Log failed attempt (console for now, Supabase later)
    console.log(
      JSON.stringify({
        event: "login_attempt",
        success: false,
        name,
        ip,
        timestamp: new Date().toISOString(),
      })
    );
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  // Log successful login
  console.log(
    JSON.stringify({
      event: "login_attempt",
      success: true,
      name,
      ip,
      timestamp: new Date().toISOString(),
    })
  );

  // Set session cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, SESSION_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SEVEN_DAYS,
    path: "/",
  });

  return NextResponse.json({ success: true });
}
