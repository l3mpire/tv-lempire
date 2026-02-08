import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabase();
  const { data: users, error } = await supabase
    .from("users")
    .select("name")
    .eq("verified", true)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  return NextResponse.json({ users: users.map((u) => u.name) });
}
