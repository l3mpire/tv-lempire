import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, password } = body;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  // Find user by reset token
  const { data: user, error } = await supabase
    .from("users")
    .select("id, reset_token_expires_at")
    .eq("reset_token", token)
    .single();

  if (error || !user) {
    return NextResponse.json(
      { error: "Invalid or expired reset link" },
      { status: 400 }
    );
  }

  // Check expiry
  const expiresAt = new Date(user.reset_token_expires_at).getTime();
  if (Date.now() > expiresAt) {
    // Clear expired token
    await supabase
      .from("users")
      .update({ reset_token: null, reset_token_expires_at: null })
      .eq("id", user.id);

    return NextResponse.json(
      { error: "This reset link has expired. Please request a new one." },
      { status: 400 }
    );
  }

  // Hash new password and clear reset token (single-use)
  const passwordHash = await bcrypt.hash(password, 10);

  await supabase
    .from("users")
    .update({
      password_hash: passwordHash,
      reset_token: null,
      reset_token_expires_at: null,
    })
    .eq("id", user.id);

  return NextResponse.json({ success: true });
}
