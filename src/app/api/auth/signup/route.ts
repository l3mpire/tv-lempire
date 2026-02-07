import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getSupabase } from "@/lib/supabase";

const SESSION_COOKIE = "dashboard_session";
const SEVEN_DAYS = 60 * 60 * 24 * 7;

export async function POST(request: NextRequest) {
  let body: { email?: string; name?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, name, password } = body;

  // Validate inputs
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Insert user — is_admin is set atomically via DB default + trigger:
  // The first row gets is_admin=true, all others get false.
  // We insert with is_admin=false and let a DB trigger handle the first-user case,
  // OR we use a conditional: insert, then check if this is the only user.
  const { data, error } = await supabase
    .from("users")
    .insert({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      password_hash: passwordHash,
    })
    .select("id, name, email, is_admin")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }

  // Set session cookie with user UUID
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, data.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SEVEN_DAYS,
    path: "/",
  });

  return NextResponse.json({
    success: true,
    user: {
      id: data.id,
      name: data.name,
      email: data.email,
      isAdmin: data.is_admin,
    },
  });
}
