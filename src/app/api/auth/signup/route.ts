import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import { getSupabase } from "@/lib/supabase";
import { SESSION_COOKIE, escapeHtml } from "@/lib/auth";
const SEVEN_DAYS = 60 * 60 * 24 * 7;
const ALLOWED_DOMAIN = "lempire.co";

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

  // Restrict to @lempire.co emails
  const normalizedEmail = email.toLowerCase().trim();
  const domain = normalizedEmail.split("@")[1];
  if (domain !== ALLOWED_DOMAIN) {
    return NextResponse.json(
      { error: "Only @lempire.co email addresses are allowed" },
      { status: 403 }
    );
  }

  const supabase = getSupabase();

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);
  const verificationToken = randomUUID();

  const { data, error } = await supabase
    .from("users")
    .insert({
      email: normalizedEmail,
      name: name.trim(),
      password_hash: passwordHash,
      verified: false,
      verification_token: verificationToken,
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

  // Send verification email
  const appUrl = request.nextUrl.origin;
  const verifyUrl = `${appUrl}/api/auth/verify?token=${verificationToken}`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "noreply@lempire.co",
      to: normalizedEmail,
      subject: "Verify your email - lempire Dashboard",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #fff; background: #18181b; padding: 20px; border-radius: 8px; text-align: center;">
            lempire Dashboard
          </h2>
          <p>Hi ${escapeHtml(name.trim())},</p>
          <p>Click the button below to verify your email and access the dashboard:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verifyUrl}"
               style="background: #22c55e; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              Verify my email
            </a>
          </div>
          <p style="color: #888; font-size: 13px;">Or copy this link: ${verifyUrl}</p>
        </div>
      `,
    });
  } catch (e) {
    console.error("Failed to send verification email:", e);
  }

  // Set session cookie (user can log in but middleware will redirect to /pending)
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
    needsVerification: true,
    user: {
      id: data.id,
      name: data.name,
      email: data.email,
      isAdmin: data.is_admin,
    },
  });
}
