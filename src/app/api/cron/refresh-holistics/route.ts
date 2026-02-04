import { NextResponse } from "next/server";

const HOLISTICS_HOST = process.env.HOLISTICS_HOST || "https://eu.holistics.io";
const HOLISTICS_API_KEY = process.env.HOLISTICS_API_KEY;
const HOLISTICS_REPORT_ID = process.env.HOLISTICS_REPORT_ID || "2199023346927";

type HolisticsQueryResult = {
  status: "success" | "failure" | "running";
  values?: (string | null)[][];
  paginated?: { num_pages: number };
  error?: string;
};

// This endpoint is called by Vercel Cron every 6 hours
// It pre-warms the Holistics cache so dashboard loads are fast
export async function GET(request: Request) {
  // Verify this is a legitimate cron request (Vercel adds this header)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // In production, verify the cron secret if set
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    // Fetch all pages to warm the cache
    const totalPages = result.paginated.num_pages;
    console.log(`[Cron] Fetching ${totalPages} pages to warm cache...`);

    for (let page = 2; page <= totalPages; page++) {
      await fetch(
        `${HOLISTICS_HOST}/queries/get_query_results.json?job_id=${job_id}&_page=${page}`,
        { headers: { "X-Holistics-Key": HOLISTICS_API_KEY } }
      );
    }

    console.log("[Cron] Holistics data refresh completed successfully");

    return NextResponse.json({
      success: true,
      message: "Holistics data refreshed",
      pages: totalPages,
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
