import { NextResponse } from "next/server";
import { get } from "@vercel/edge-config";

const DEFAULT_CONFIG = { arr: 108000000, growth: 0.3 };

// Read config from Edge Config
export async function GET() {
  try {
    const arr = await get<number>("arr");
    const growth = await get<number>("growth");

    if (arr !== undefined && growth !== undefined) {
      return NextResponse.json({ arr, growth });
    }

    return NextResponse.json(DEFAULT_CONFIG);
  } catch {
    // Edge Config not set up yet, return defaults
    return NextResponse.json(DEFAULT_CONFIG);
  }
}

// Write config to Edge Config via Vercel REST API
export async function POST(request: Request) {
  const { arr, growth } = await request.json();

  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const vercelApiToken = process.env.VERCEL_API_TOKEN;

  if (!edgeConfigId || !vercelApiToken) {
    return NextResponse.json(
      { error: "Edge Config not configured (missing EDGE_CONFIG_ID or VERCEL_API_TOKEN)" },
      { status: 500 }
    );
  }

  const res = await fetch(
    `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${vercelApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          { operation: "upsert", key: "arr", value: arr },
          { operation: "upsert", key: "growth", value: growth },
        ],
      }),
    }
  );

  if (!res.ok) {
    const error = await res.json();
    return NextResponse.json({ error }, { status: res.status });
  }

  return NextResponse.json({ status: "ok" });
}
