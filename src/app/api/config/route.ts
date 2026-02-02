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
  claap: ProductConfig;
  taplio: ProductConfig;
  tweethunter: ProductConfig;
};

const PRODUCTS = ["lemlist", "claap", "taplio", "tweethunter"] as const;

const DEFAULT_CONFIG: Config = {
  lemlist: { arr: 80000000, growth: 0.25, monthGrowth: 0, updatedAt: Date.now() },
  claap: { arr: 5000000, growth: 0.4, monthGrowth: 0, updatedAt: Date.now() },
  taplio: { arr: 3000000, growth: 0.3, monthGrowth: 0, updatedAt: Date.now() },
  tweethunter: { arr: 2000000, growth: 0.3, monthGrowth: 0, updatedAt: Date.now() },
};

export async function GET() {
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
      // Fill missing products with defaults
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
