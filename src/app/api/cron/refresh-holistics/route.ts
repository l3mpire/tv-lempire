import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

const HOLISTICS_HOST = process.env.HOLISTICS_HOST || "https://eu.holistics.io";
const HOLISTICS_API_KEY = process.env.HOLISTICS_API_KEY;
const HOLISTICS_REPORT_ID = process.env.HOLISTICS_REPORT_ID || "2199023346927";

const PRODUCTS = ["lemlist", "lemwarm", "lemcal", "claap", "taplio", "tweethunter"] as const;
const FALLBACK_GROWTH_RATE = 0.15;

type HolisticsQueryResult = {
  status: "success" | "failure" | "running";
  values?: (string | null)[][];
  paginated?: { num_pages: number };
  error?: string;
};

import type { ProductConfig } from "@/lib/types";

// GET: Vercel Cron only (CRON_SECRET bearer token)
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return refreshHolistics();
}

// POST: admin manual refresh from /admin
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return refreshHolistics();
}

async function refreshHolistics() {
  if (!HOLISTICS_API_KEY) {
    return NextResponse.json(
      { error: "HOLISTICS_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    console.log("[Cron] Starting Holistics data refresh...");

    // Submit query
    const submitRes = await fetch(
      `${HOLISTICS_HOST}/queries/${HOLISTICS_REPORT_ID}/submit_query.json`,
      { headers: { "X-Holistics-Key": HOLISTICS_API_KEY } }
    );

    if (!submitRes.ok) {
      throw new Error(`Failed to submit query: ${submitRes.status}`);
    }

    const { job_id } = await submitRes.json();
    console.log(`[Cron] Query submitted, job_id: ${job_id}`);

    // Poll for results (max 30 attempts)
    let result: HolisticsQueryResult | null = null;
    for (let i = 0; i < 30; i++) {
      const pollRes = await fetch(
        `${HOLISTICS_HOST}/queries/get_query_results.json?job_id=${job_id}`,
        { headers: { "X-Holistics-Key": HOLISTICS_API_KEY } }
      );

      if (!pollRes.ok) {
        throw new Error(`Failed to poll results: ${pollRes.status}`);
      }

      result = await pollRes.json();

      if (result?.status === "success") {
        console.log(`[Cron] Query completed after ${i + 1} attempts`);
        break;
      }

      if (result?.status === "failure") {
        throw new Error(result.error || "Query failed");
      }

      // Still running, wait 1 second
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!result?.values || !result?.paginated) {
      throw new Error("Invalid response format");
    }

    // Fetch last pages to get recent data
    const allValues = [...result.values];
    const totalPages = result.paginated.num_pages;
    console.log(`[Cron] Fetching last pages (${totalPages} total)...`);

    for (let page = Math.max(2, totalPages - 2); page <= totalPages; page++) {
      const pageRes = await fetch(
        `${HOLISTICS_HOST}/queries/get_query_results.json?job_id=${job_id}&_page=${page}`,
        { headers: { "X-Holistics-Key": HOLISTICS_API_KEY } }
      );
      if (pageRes.ok) {
        const pageData: HolisticsQueryResult = await pageRes.json();
        if (pageData.values) allValues.push(...pageData.values);
      }
    }

    // Parse: Map<month, Map<product, arr>>
    const arrByMonth = new Map<string, Map<string, number>>();
    for (const [date, product, arrStr] of allValues) {
      if (!date || !product || !arrStr) continue;
      const month = date.substring(0, 7);
      if (!arrByMonth.has(month)) arrByMonth.set(month, new Map());
      arrByMonth.get(month)!.set(product, parseFloat(arrStr));
    }

    // Find the latest month with meaningful data (at least one product with ARR > 0,
    // excluding lemwarm which can have residual values in future months)
    const months = Array.from(arrByMonth.keys()).sort();
    let currentMonth: string | undefined;
    for (let i = months.length - 1; i >= 0; i--) {
      const monthData = arrByMonth.get(months[i])!;
      const hasRealData = Array.from(monthData.entries()).some(
        ([product, arr]) => arr > 0 && product !== "lemwarm"
      );
      if (hasRealData) {
        currentMonth = months[i];
        break;
      }
    }
    if (!currentMonth) {
      throw new Error("No month with meaningful ARR data found in Holistics report");
    }
    const currentIdx = months.indexOf(currentMonth);
    const previousMonth = currentIdx > 0 ? months[currentIdx - 1] : undefined;
    const currentData = arrByMonth.get(currentMonth);
    const previousData = previousMonth ? arrByMonth.get(previousMonth) : undefined;

    if (!currentData) {
      throw new Error("No current month data found");
    }

    console.log(`[Cron] Processing data: ${currentMonth} vs ${previousMonth}`);

    // Build config for each product
    const now = Date.now();
    const items: { operation: "upsert"; key: string; value: ProductConfig }[] = [];
    const skipped: string[] = [];

    // Fetch existing ARR values from Supabase to protect against overwriting with 0
    const { data: existingRows } = await getSupabase()
      .from("products")
      .select("id, arr");
    const existingARR = new Map<string, number>();
    for (const row of existingRows ?? []) {
      existingARR.set(row.id, row.arr);
    }

    for (const product of PRODUCTS) {
      const arr = currentData.get(product) || 0;
      const prevArr = previousData?.get(product) || 0;
      const existing = existingARR.get(product) ?? 0;

      // Never overwrite a valid ARR with 0
      if (arr === 0 && existing > 0) {
        console.log(`[Cron] ${product}: Holistics returned $0 but existing ARR is $${existing.toFixed(0)} — skipping`);
        skipped.push(product);
        continue;
      }

      const monthGrowth = arr - prevArr;

      // Calculate annual growth rate from month-over-month change
      let growth = FALLBACK_GROWTH_RATE;
      if (prevArr > 0) {
        const monthlyRate = monthGrowth / prevArr;
        growth = Math.pow(1 + monthlyRate, 12) - 1;
        growth = Math.max(0, Math.min(2, growth)); // Clamp 0-200%
      }

      items.push({
        operation: "upsert",
        key: product,
        value: {
          arr: Math.round(arr * 100) / 100,
          growth: Math.round(growth * 1000) / 1000,
          monthGrowth: Math.round(monthGrowth * 100) / 100,
          updatedAt: now,
        },
      });

      console.log(`[Cron] ${product}: $${arr.toFixed(0)} (growth: ${(growth * 100).toFixed(1)}%)`);
    }

    if (items.length === 0) {
      const msg = "Holistics returned $0 for all products — no data was saved";
      console.warn(`[Cron] ${msg}`);
      return NextResponse.json({
        success: false,
        error: msg,
        currentMonth,
        previousMonth,
        skipped,
        timestamp: new Date().toISOString(),
      }, { status: 422 });
    }

    // Store in Supabase
    console.log("[Cron] Saving to Supabase...");
    const rows = items.map((item) => ({
      id: item.key,
      arr: item.value.arr,
      growth: item.value.growth,
      month_growth: item.value.monthGrowth,
      updated_at: item.value.updatedAt,
    }));

    const { error: upsertError } = await getSupabase()
      .from("products")
      .upsert(rows, { onConflict: "id" });

    if (upsertError) {
      throw new Error(`Failed to save to Supabase: ${upsertError.message}`);
    }

    console.log("[Cron] Holistics data refresh completed successfully");

    // Build full config to return (include existing values for skipped products)
    const freshConfig: Record<string, ProductConfig> = {};
    for (const item of items) {
      freshConfig[item.key] = item.value;
    }

    return NextResponse.json({
      success: true,
      message: skipped.length > 0
        ? `Synced ${items.length} products, skipped ${skipped.length} (Holistics returned $0)`
        : "Holistics data saved to Supabase",
      updated: items.length,
      currentMonth,
      previousMonth,
      products: items.map((i) => ({ key: i.key, arr: i.value.arr, monthGrowth: i.value.monthGrowth })),
      skipped,
      config: freshConfig,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Holistics refresh error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
