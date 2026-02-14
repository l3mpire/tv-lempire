import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireAdmin, requireSession } from "@/lib/auth";
import type { ProductConfig, Config } from "@/lib/types";

const PRODUCTS = ["lemlist", "lemwarm", "lemcal", "claap", "taplio", "tweethunter"] as const;

// Default values (used if Supabase is empty or unreachable)
const DEFAULT_CONFIG: Config = {
  lemlist: { arr: 0, growth: 0, monthGrowth: 0, updatedAt: 0 },
  lemwarm: { arr: 0, growth: 0, monthGrowth: 0, updatedAt: 0 },
  lemcal: { arr: 0, growth: 0, monthGrowth: 0, updatedAt: 0 },
  claap: { arr: 0, growth: 0, monthGrowth: 0, updatedAt: 0 },
  taplio: { arr: 0, growth: 0, monthGrowth: 0, updatedAt: 0 },
  tweethunter: { arr: 0, growth: 0, monthGrowth: 0, updatedAt: 0 },
};

export async function GET() {
  const user = await requireSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
