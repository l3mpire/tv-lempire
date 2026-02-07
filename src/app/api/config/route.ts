import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

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

// Default values (used if Supabase is empty or unreachable)
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
    const { data, error } = await getSupabase()
      .from("products")
      .select("id, arr, growth, month_growth, updated_at");

    if (error) throw error;

    if (data && data.length > 0) {
      const config: Partial<Config> = {};
      for (const row of data) {
        config[row.id as keyof Config] = {
          arr: row.arr,
          growth: row.growth,
          monthGrowth: row.month_growth,
          updatedAt: row.updated_at,
        };
      }
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
  const now = Date.now();

  const rows = PRODUCTS.map((product) => ({
    id: product,
    arr: body[product].arr,
    growth: body[product].growth,
    month_growth: body[product].monthGrowth,
    updated_at: now,
  }));

  const { error } = await getSupabase()
    .from("products")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
