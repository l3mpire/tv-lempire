import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { postToSlack } from "@/lib/slack";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return new NextResponse("Missing token", { status: 400 });
  }

  const supabase = getSupabase();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, verified")
    .eq("verification_token", token)
    .single();

  if (error || !user) {
    return new NextResponse("Invalid or expired token", { status: 400 });
  }

  if (user.verified) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Fetch user name for the Slack notification
  const { data: fullUser } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .single();

  await supabase
    .from("users")
    .update({ verified: true, verification_token: null })
    .eq("id", user.id);

  await postToSlack("System", `${fullUser?.name ?? "Someone"} just joined`, false).catch(console.error);

  return NextResponse.redirect(new URL("/login?verified=1", request.url));
}
