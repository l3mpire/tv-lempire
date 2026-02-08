import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { extractYoutubeId } from "@/lib/linkify";
import { requireAdmin } from "@/lib/auth";

// GET: public — return videos ordered by position
// ?tv=1 filters to tv_enabled videos only
export async function GET(request: NextRequest) {
  const tvOnly = request.nextUrl.searchParams.get("tv") === "1";
  const supabase = getSupabase();

  let query = supabase
    .from("videos")
    .select("id, youtube_id, title, position, tv_enabled")
    .order("position", { ascending: true });

  if (tvOnly) {
    query = query.eq("tv_enabled", true);
  }

  const { data: videos, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
  }

  return NextResponse.json({ videos: videos ?? [] });
}

// POST: admin — add a video
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { url, title } = body;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const youtubeId = extractYoutubeId(url);
  if (!youtubeId) {
    return NextResponse.json({ error: "Invalid YouTube URL or ID" }, { status: 400 });
  }

  const supabase = getSupabase();

  // Get max position
  const { data: maxRow } = await supabase
    .from("videos")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const nextPosition = (maxRow?.position ?? -1) + 1;

  const { data: video, error } = await supabase
    .from("videos")
    .insert({
      youtube_id: youtubeId,
      title: title || "",
      position: nextPosition,
    })
    .select("id, youtube_id, title, position, tv_enabled")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to add video" }, { status: 500 });
  }

  return NextResponse.json({ video });
}

// DELETE: admin — remove a video by id
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("videos").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete video" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// PATCH: admin — reorder videos or toggle tv_enabled
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const supabase = getSupabase();

  // Toggle tv_enabled for a single video
  if ("id" in body && "tv_enabled" in body) {
    const { id, tv_enabled } = body;
    const { error } = await supabase
      .from("videos")
      .update({ tv_enabled })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Failed to update video" }, { status: 500 });
    }

    const { data: videos, error: listError } = await supabase
      .from("videos")
      .select("id, youtube_id, title, position, tv_enabled")
      .order("position", { ascending: true });

    if (listError) {
      return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
    }

    return NextResponse.json({ videos });
  }

  // Reorder videos
  const { order } = body;

  if (!Array.isArray(order) || order.length === 0) {
    return NextResponse.json({ error: "order must be a non-empty array of video IDs" }, { status: 400 });
  }

  // Verify all IDs exist in DB
  const { data: existing, error: fetchError } = await supabase
    .from("videos")
    .select("id");

  if (fetchError) {
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
  }

  const existingIds = new Set(existing.map((v) => v.id));
  const orderIds = new Set(order);

  if (existingIds.size !== orderIds.size || !order.every((id: number) => existingIds.has(id))) {
    return NextResponse.json({ error: "order must contain exactly all video IDs" }, { status: 400 });
  }

  // Update positions
  for (let i = 0; i < order.length; i++) {
    const { error } = await supabase
      .from("videos")
      .update({ position: i })
      .eq("id", order[i]);

    if (error) {
      return NextResponse.json({ error: "Failed to update video position" }, { status: 500 });
    }
  }

  // Return updated list
  const { data: videos, error: listError } = await supabase
    .from("videos")
    .select("id, youtube_id, title, position, tv_enabled")
    .order("position", { ascending: true });

  if (listError) {
    return NextResponse.json({ error: "Failed to fetch updated videos" }, { status: 500 });
  }

  return NextResponse.json({ videos });
}
