import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSessionUserId } from "@/lib/auth";

async function getSessionUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const supabase = getSupabase();
  const { data: user } = await supabase
    .from("users")
    .select("id, preferences")
    .eq("id", userId)
    .single();

  return user;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({});
  }
  return NextResponse.json(user.preferences ?? {});
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const merged = { ...(user.preferences ?? {}), ...body };

  const supabase = getSupabase();
  const { error } = await supabase
    .from("users")
    .update({ preferences: merged })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }

  return NextResponse.json(merged);
}
