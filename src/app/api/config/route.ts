import { NextResponse } from "next/server";
import { get } from "@vercel/edge-config";

type ProductConfig = {
  arr: number;
  growth: number;
  monthGrowth: number;
  updatedAt: number;
};

type Config = {
  lemlist: ProductConfig;
  lemwarm: ProductConfig;
  lemcal: ProductConfig;
  claap: ProductConfig;
  taplio: ProductConfig;
  tweethunter: ProductConfig;
};

const PRODUCTS = ["lemlist", "lemwarm", "lemcal", "claap", "taplio", "tweethunter"] as const;

// Fallback growth rates if we can't calculate from data
const FALLBACK_GROWTH_RATE = 0.15;

const DEFAULT_CONFIG: Config = {
  lemlist: { arr: 37649178, growth: 0.20, monthGrowth: 0, updatedAt: Date.now() },
  lemwarm: { arr: 1675328, growth: 0.15, monthGrowth: 0, updatedAt: Date.now() },
  lemcal: { arr: 71508, growth: 0.20, monthGrowth: 0, updatedAt: Date.now() },
  claap: { arr: 2148558, growth: 0.35, monthGrowth: 0, updatedAt: Date.now() },
  taplio: { arr: 3261632, growth: 0.25, monthGrowth: 0, updatedAt: Date.now() },
  tweethunter: { arr: 1162042, growth: 0.20, monthGrowth: 0, updatedAt: Date.now() },
};

const HOLISTICS_HOST = process.env.HOLISTICS_HOST || "https://eu.holistics.io";
const HOLISTICS_API_KEY = process.env.HOLISTICS_API_KEY;
const HOLISTICS_REPORT_ID = process.env.HOLISTICS_REPORT_ID || "2199023346927";

type HolisticsQueryResult = {
  status: "success" | "failure" | "running";
  values?: (string | null)[][];
  paginated?: { num_pages: number };
  error?: string;
};

async function fetchFromHolistics(): Promise<Config | null> {
  if (!HOLISTICS_API_KEY) return null;

  try {
    // Submit query
    const submitRes = await fetch(
      `${HOLISTICS_HOST}/queries/${HOLISTICS_REPORT_ID}/submit_query.json`,
      { headers: { "X-Holistics-Key": HOLISTICS_API_KEY } }
    );

    if (!submitRes.ok) return null;
    const { job_id } = await submitRes.json();

    // Poll for results (max 30 attempts)
    let result: HolisticsQueryResult | null = null;
    for (let i = 0; i < 30; i++) {
      const pollRes = await fetch(
        `${HOLISTICS_HOST}/queries/get_query_results.json?job_id=${job_id}`,
        { headers: { "X-Holistics-Key": HOLISTICS_API_KEY } }
      );

      if (!pollRes.ok) return null;
      result = await pollRes.json();

      if (result?.status === "success") break;
      if (result?.status === "failure") return null;

      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!result?.values || !result?.paginated) return null;

    // Fetch last pages to get recent data
    const allValues = [...result.values];
    const totalPages = result.paginated.num_pages;

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

    const months = Array.from(arrByMonth.keys()).sort();
    const currentMonth = months[months.length - 1];
    const previousMonth = months[months.length - 2];
    const currentData = arrByMonth.get(currentMonth);
    const previousData = arrByMonth.get(previousMonth);

    if (!currentData) return null;

    const now = Date.now();
    const config: Partial<Config> = {};

    for (const product of PRODUCTS) {
      const arr = currentData.get(product) || 0;
      const prevArr = previousData?.get(product) || 0;
      const monthGrowth = arr - prevArr;

      // Calculate annual growth rate from month-over-month change
      // growth = (1 + monthlyRate)^12 - 1
      let growth = FALLBACK_GROWTH_RATE;
      if (prevArr > 0) {
        const monthlyRate = monthGrowth / prevArr;
        growth = Math.pow(1 + monthlyRate, 12) - 1;
        // Clamp to reasonable bounds (0% to 200%)
        growth = Math.max(0, Math.min(2, growth));
      }

      config[product] = {
        arr: Math.round(arr * 100) / 100,
        growth: Math.round(growth * 1000) / 1000, // 3 decimal places
        monthGrowth: Math.round(monthGrowth * 100) / 100,
        updatedAt: now,
      };
    }

    return config as Config;
  } catch (error) {
    console.error("Holistics fetch error:", error);
    return null;
  }
}

export async function GET() {
  // Try Holistics first if configured
  const holisticsConfig = await fetchFromHolistics();
  if (holisticsConfig) {
    return NextResponse.json(holisticsConfig);
  }

  // Fallback to Edge Config
  try {
    const config: Partial<Config> = {};
    let hasData = false;

    for (const product of PRODUCTS) {
      const data = await get<ProductConfig>(product);
      if (data) {
        config[product] = data;
        hasData = true;
      }
    }

    if (hasData) {
      for (const product of PRODUCTS) {
        if (!config[product]) {
          config[product] = DEFAULT_CONFIG[product];
        }
      }
      return NextResponse.json(config);
    }

    return NextResponse.json(DEFAULT_CONFIG);
  } catch {
    return NextResponse.json(DEFAULT_CONFIG);
  }
}

export async function POST(request: Request) {
  const body: Config = await request.json();

  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const vercelApiToken = process.env.VERCEL_API_TOKEN;

  if (!edgeConfigId || !vercelApiToken) {
    return NextResponse.json(
      { error: "Edge Config not configured (missing EDGE_CONFIG_ID or VERCEL_API_TOKEN)" },
      { status: 500 }
    );
  }

  const now = Date.now();
  const items = PRODUCTS.map((product) => ({
    operation: "upsert" as const,
    key: product,
    value: {
      arr: body[product].arr,
      growth: body[product].growth,
      monthGrowth: body[product].monthGrowth,
      updatedAt: now,
    },
  }));

  const res = await fetch(
    `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${vercelApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items }),
    }
  );

  if (!res.ok) {
    const error = await res.json();
    return NextResponse.json({ error }, { status: res.status });
  }

  return NextResponse.json({ status: "ok" });
}
