import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Resend } from "resend";
import { getSupabase } from "@/lib/supabase";
import { escapeHtml } from "@/lib/auth";

const ONE_HOUR_MS = 60 * 60 * 1000;

// Generic response to prevent email enumeration
const GENERIC_RESPONSE = {
  message: "If this email is registered, you will receive a reset link shortly.",
};

export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email } = body;
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const supabase = getSupabase();

  // Look up user — but always return the same response regardless
  const { data: user } = await supabase
    .from("users")
    .select("id, name, email, reset_token_expires_at")
    .eq("email", normalizedEmail)
    .single();

  if (!user) {
    return NextResponse.json(GENERIC_RESPONSE);
  }

  // Rate limit: reject if a token was generated less than 5 minutes ago
  if (user.reset_token_expires_at) {
    const expiresAt = new Date(user.reset_token_expires_at).getTime();
    const createdAt = expiresAt - ONE_HOUR_MS;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (createdAt > fiveMinutesAgo) {
      // Silently return same response — don't reveal rate limiting
      return NextResponse.json(GENERIC_RESPONSE);
    }
  }

  // Generate reset token + expiry
  const resetToken = randomUUID();
  const resetExpiresAt = new Date(Date.now() + ONE_HOUR_MS).toISOString();

  await supabase
    .from("users")
    .update({
      reset_token: resetToken,
      reset_token_expires_at: resetExpiresAt,
    })
    .eq("id", user.id);

  // Send reset email
  const appUrl = request.nextUrl.origin;
  const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "noreply@lempire.co",
      to: normalizedEmail,
      subject: "Reset your password - lempire Dashboard",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #fff; background: #18181b; padding: 20px; border-radius: 8px; text-align: center;">
            lempire Dashboard
          </h2>
          <p>Hi ${escapeHtml(user.name)},</p>
          <p>You requested a password reset. Click the button below to choose a new password:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}"
               style="background: #22c55e; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              Reset my password
            </a>
          </div>
          <p style="color: #888; font-size: 13px;">This link expires in 1 hour.</p>
          <p style="color: #888; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
          <p style="color: #666; font-size: 11px;">Or copy this link: ${resetUrl}</p>
        </div>
      `,
    });
  } catch (e) {
    console.error("Failed to send reset email:", e);
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
