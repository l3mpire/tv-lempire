import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSessionUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = getSupabase();
  const { data: user, error } = await supabase
    .from("users")
    .select("id, name, email, is_admin")
    .eq("id", userId)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.is_admin,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const userId = await getSessionUserId();

  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 50) {
    return NextResponse.json(
      { error: "Name must be between 1 and 50 characters" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("users")
    .update({ name })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: "Failed to update name" }, { status: 500 });
  }

  return NextResponse.json({ success: true, name });
}
