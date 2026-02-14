import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getSupabase } from "@/lib/supabase";
import { SESSION_COOKIE, signSession } from "@/lib/auth";
const SEVEN_DAYS = 60 * 60 * 24 * 7;

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  // Get client IP for logging
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const supabase = getSupabase();

  // Look up user by email
  const { data: user, error } = await supabase
    .from("users")
    .select("id, name, email, password_hash, is_admin")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (error) {
    console.log(
      JSON.stringify({
        event: "login_db_error",
        email,
        ip,
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString(),
      })
    );
    return NextResponse.json(
      { error: "Server error, please try again" },
      { status: 500 }
    );
  }

  if (!user) {
    console.log(
      JSON.stringify({
        event: "login_attempt",
        success: false,
        reason: "user_not_found",
        email,
        ip,
        timestamp: new Date().toISOString(),
      })
    );
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  // Compare password
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    console.log(
      JSON.stringify({
        event: "login_attempt",
        success: false,
        reason: "wrong_password",
        email,
        ip,
        timestamp: new Date().toISOString(),
      })
    );
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  // Log successful login
  console.log(
    JSON.stringify({
      event: "login_attempt",
      success: true,
      email,
      ip,
      timestamp: new Date().toISOString(),
    })
  );

  // Update last_online timestamp
  await supabase
    .from("users")
    .update({ last_online: new Date().toISOString() })
    .eq("id", user.id);

  // Set session cookie with user UUID
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, signSession(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SEVEN_DAYS,
    path: "/",
  });

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
}
