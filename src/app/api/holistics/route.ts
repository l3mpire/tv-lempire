import { NextResponse } from "next/server";

const HOLISTICS_HOST = process.env.HOLISTICS_HOST || "https://eu.holistics.io";
const HOLISTICS_API_KEY = process.env.HOLISTICS_API_KEY;
const HOLISTICS_REPORT_ID = process.env.HOLISTICS_REPORT_ID || "2199023346927";

type HolisticsQueryResult = {
  status: "success" | "failure" | "running";
  values?: (string | null)[][];
  paginated?: {
    num_pages: number;
    page: number;
  };
  error?: string;
};

type ProductARR = {
  arr: number;
  monthGrowth: number;
  updatedAt: number;
};

type HolisticsResponse = {
  lemlist: ProductARR;
  claap: ProductARR;
  taplio: ProductARR;
  tweethunter: ProductARR;
  lemwarm?: ProductARR;
  lemcal?: ProductARR;
};

const PRODUCT_MAPPING: Record<string, keyof HolisticsResponse> = {
  lemlist: "lemlist",
  claap: "claap",
  taplio: "taplio",
  tweethunter: "tweethunter",
  lemwarm: "lemwarm",
  lemcal: "lemcal",
};

async function submitQuery(): Promise<string> {
  const res = await fetch(
    `${HOLISTICS_HOST}/queries/${HOLISTICS_REPORT_ID}/submit_query.json`,
    {
      headers: { "X-Holistics-Key": HOLISTICS_API_KEY! },
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to submit query: ${res.status}`);
  }

  const data = await res.json();
  return data.job_id;
}

async function pollResults(jobId: string, page = 1): Promise<HolisticsQueryResult> {
  const res = await fetch(
    `${HOLISTICS_HOST}/queries/get_query_results.json?job_id=${jobId}&_page=${page}`,
    {
      headers: { "X-Holistics-Key": HOLISTICS_API_KEY! },
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to get results: ${res.status}`);
  }

  return res.json();
}

async function waitForResults(jobId: string, maxAttempts = 30): Promise<HolisticsQueryResult> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await pollResults(jobId);

    if (result.status === "success") {
      return result;
    }

    if (result.status === "failure") {
      throw new Error(result.error || "Query failed");
    }

    // Still running, wait 1 second
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Query timeout");
}

function parseARRData(values: (string | null)[][]): Map<string, Map<string, number>> {
  // Map<month, Map<product, arr>>
  const data = new Map<string, Map<string, number>>();

  for (const row of values) {
    const [date, product, arrStr] = row;

    // Skip header rows (date is null) and null products
    if (!date || !product || !arrStr) continue;

    const month = date.substring(0, 7); // "2026-02-01" -> "2026-02"
    const arr = parseFloat(arrStr);

    if (!data.has(month)) {
      data.set(month, new Map());
    }
    data.get(month)!.set(product, arr);
  }

  return data;
}

export async function GET() {
  if (!HOLISTICS_API_KEY) {
    return NextResponse.json(
      { error: "HOLISTICS_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    // Submit query
    const jobId = await submitQuery();

    // Wait for first page results
    const firstResult = await waitForResults(jobId);

    if (!firstResult.values || !firstResult.paginated) {
      throw new Error("Invalid response format");
    }

    // Collect all pages
    const allValues = [...firstResult.values];
    const totalPages = firstResult.paginated.num_pages;

    // Fetch remaining pages (we need last 2 months, so fetch last few pages)
    // Start from page totalPages-1 to get the most recent data
    for (let page = Math.max(2, totalPages - 2); page <= totalPages; page++) {
      const pageResult = await pollResults(jobId, page);
      if (pageResult.values) {
        allValues.push(...pageResult.values);
      }
    }

    // Parse data
    const arrByMonth = parseARRData(allValues);

    // Get sorted months
    const months = Array.from(arrByMonth.keys()).sort();
    const currentMonth = months[months.length - 1];
    const previousMonth = months[months.length - 2];

    const currentData = arrByMonth.get(currentMonth);
    const previousData = arrByMonth.get(previousMonth);

    if (!currentData) {
      throw new Error("No current month data found");
    }

    const now = Date.now();

    // Build response
    const response: Partial<HolisticsResponse> = {};

    for (const [holisticsName, configKey] of Object.entries(PRODUCT_MAPPING)) {
      const currentARR = currentData.get(holisticsName) || 0;
      const previousARR = previousData?.get(holisticsName) || 0;
      const monthGrowth = currentARR - previousARR;

      response[configKey] = {
        arr: Math.round(currentARR * 100) / 100,
        monthGrowth: Math.round(monthGrowth * 100) / 100,
        updatedAt: now,
      };
    }

    return NextResponse.json({
      data: response,
      meta: {
        currentMonth,
        previousMonth,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Holistics API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
