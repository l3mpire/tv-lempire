import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Resend } from "resend";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin, escapeHtml } from "@/lib/auth";
import { postToSlack } from "@/lib/slack";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabase();
  const { data: users, error } = await supabase
    .from("users")
    .select("id, name, email, is_admin, verified, last_online, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  return NextResponse.json({ users });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, isAdmin, verified, resendVerification } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Resend verification email
  if (resendVerification) {
    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("id, name, email, verified")
      .eq("id", userId)
      .single();

    if (fetchError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.verified) {
      return NextResponse.json({ error: "User is already verified" }, { status: 400 });
    }

    const verificationToken = randomUUID();
    await supabase
      .from("users")
      .update({ verification_token: verificationToken })
      .eq("id", userId);

    const appUrl = request.nextUrl.origin;
    const verifyUrl = `${appUrl}/api/auth/verify?token=${verificationToken}`;

    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "noreply@lempire.co",
        to: user.email,
        subject: "Verify your email - lempire Dashboard",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="color: #fff; background: #18181b; padding: 20px; border-radius: 8px; text-align: center;">
              lempire Dashboard
            </h2>
            <p>Hi ${escapeHtml(user.name)},</p>
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
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  const update: Record<string, unknown> = {};

  if (typeof isAdmin === "boolean") {
    if (userId === admin.id && !isAdmin) {
      return NextResponse.json({ error: "Cannot remove your own admin role" }, { status: 400 });
    }
    update.is_admin = isAdmin;
  }

  if (typeof verified === "boolean") {
    update.verified = verified;
    if (verified) update.verification_token = null;

    if (verified) {
      const { data: verifiedUser } = await supabase
        .from("users")
        .select("name")
        .eq("id", userId)
        .single();
      postToSlack("System", `${verifiedUser?.name ?? "Someone"} just joined`, false).catch(console.error);
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("users")
    .update(update)
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }

  // Send email notification when promoting to admin
  if (isAdmin === true) {
    const { data: promotedUser } = await supabase
      .from("users")
      .select("name, email")
      .eq("id", userId)
      .single();

    if (promotedUser) {
      const appUrl = request.nextUrl.origin;
      const adminUrl = `${appUrl}/admin`;

      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "noreply@lempire.co",
          to: promotedUser.email,
          subject: "You are now an admin - lempire Dashboard",
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
              <h2 style="color: #fff; background: #18181b; padding: 20px; border-radius: 8px; text-align: center;">
                lempire Dashboard
              </h2>
              <p>Hi ${escapeHtml(promotedUser.name)},</p>
              <p>You have been promoted to <strong>admin</strong> on the lempire Dashboard.</p>
              <p>You can now access the admin panel to manage products, users, and settings:</p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${adminUrl}"
                   style="background: #f59e0b; color: #000; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                  Go to Admin Panel
                </a>
              </div>
              <p style="color: #888; font-size: 13px;">Or copy this link: ${adminUrl}</p>
            </div>
          `,
        });
      } catch (e) {
        console.error("Failed to send admin promotion email:", e);
        // Don't fail the promotion if email fails
      }
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  if (userId === admin.id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Delete user's messages first
  await supabase.from("messages").delete().eq("user_id", userId);

  // Delete user
  const { error } = await supabase.from("users").delete().eq("id", userId);

  if (error) {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
