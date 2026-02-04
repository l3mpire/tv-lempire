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

// Default values (used if Edge Config is empty or not configured)
const DEFAULT_CONFIG: Config = {
  lemlist: { arr: 37649178, growth: 0.10, monthGrowth: 297574, updatedAt: Date.now() },
  lemwarm: { arr: 1675328, growth: 0.10, monthGrowth: 13570, updatedAt: Date.now() },
  lemcal: { arr: 71508, growth: 0.10, monthGrowth: 3, updatedAt: Date.now() },
  claap: { arr: 2148558, growth: 0.10, monthGrowth: 11345, updatedAt: Date.now() },
  taplio: { arr: 3261632, growth: -0.06, monthGrowth: -17121, updatedAt: Date.now() },
  tweethunter: { arr: 1162042, growth: -0.11, monthGrowth: -11936, updatedAt: Date.now() },
};

export async function GET() {
  try {
    const config: Partial<Config> = {};
    let hasData = false;

    // Read from Edge Config (populated by cron every 6h)
    for (const product of PRODUCTS) {
      const data = await get<ProductConfig>(product);
      if (data) {
        config[product] = data;
        hasData = true;
      }
    }

    if (hasData) {
      // Fill missing products with defaults
      for (const product of PRODUCTS) {
        if (!config[product]) {
          config[product] = DEFAULT_CONFIG[product];
        }
      }
      return NextResponse.json(config);
    }

    // No Edge Config data, return defaults
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
