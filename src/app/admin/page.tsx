"use client";

import { useEffect, useState } from "react";

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

const PRODUCTS = [
  { key: "lemlist", label: "lemlist" },
  { key: "lemwarm", label: "lemwarm" },
  { key: "lemcal", label: "lemcal" },
  { key: "claap", label: "Claap" },
  { key: "taplio", label: "Taplio" },
  { key: "tweethunter", label: "Tweet Hunter" },
] as const;

type ProductKey = (typeof PRODUCTS)[number]["key"];

const GROUPS = [
  {
    name: "Sales Engagement",
    products: ["lemlist", "lemwarm", "lemcal"] as ProductKey[],
  },
  {
    name: "Conversation Intelligence",
    products: ["claap"] as ProductKey[],
  },
  {
    name: "Social Selling",
    products: ["taplio", "tweethunter"] as ProductKey[],
  },
];

function formatCurrency(value: number): string {
  return "$" + Math.round(value).toLocaleString("en-US");
}

function formatPercent(value: number, decimals = 1): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export default function AdminPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      setConfig(data);
    } catch (e) {
      console.error("Failed to fetch config:", e);
    }
    setLoading(false);
  }

  async function refreshFromHolistics() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/cron/refresh-holistics", {
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        console.error("Failed to refresh from Holistics:", error);
      } else {
        await fetchData();
      }
    } catch (e) {
      console.error("Failed to refresh from Holistics:", e);
    }
    setRefreshing(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  if (loading || !config) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <span className="text-zinc-500">Loading...</span>
      </div>
    );
  }

  // Calculate totals
  const totalARR = PRODUCTS.reduce((sum, p) => sum + config[p.key].arr, 0);
  const totalMonthGrowth = PRODUCTS.reduce((sum, p) => sum + config[p.key].monthGrowth, 0);
  const totalPrevARR = totalARR - totalMonthGrowth;
  const totalMoM = totalPrevARR > 0 ? (totalMonthGrowth / totalPrevARR) * 100 : 0;
  const totalYoY = (Math.pow(1 + totalMoM / 100, 12) - 1) * 100;

  return (
    <div className="fixed inset-0 bg-zinc-950 text-white p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">ARR Dashboard - Debug View</h1>
          <div className="flex items-center gap-4">
            <span className="text-zinc-500 text-sm">
              Last Holistics sync:{" "}
              {new Date(config.lemlist.updatedAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            <button
              onClick={refreshFromHolistics}
              disabled={refreshing}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm transition-colors flex items-center gap-2"
            >
              {refreshing && (
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              {refreshing ? "Syncing..." : "Sync from Holistics"}
            </button>
          </div>
        </div>

        {/* TOTAL */}
        <div className="border border-green-900 bg-green-950/30 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 text-green-400">
            Total lempire
          </h2>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-3xl font-bold text-white mb-2">
                {formatCurrency(totalARR)}
              </div>
              <div className="text-green-400 font-mono">
                {formatCurrency(totalMonthGrowth)} ({formatPercent(totalMoM)} MoM · {formatPercent(totalYoY, 0)} YoY)
              </div>
            </div>
            <div className="text-sm text-zinc-400 font-mono space-y-1">
              <div>Current ARR: {formatCurrency(totalARR)}</div>
              <div>Previous ARR: {formatCurrency(totalPrevARR)}</div>
              <div>Month Growth: {formatCurrency(totalMonthGrowth)}</div>
              <div>MoM: {totalMonthGrowth.toFixed(2)} / {totalPrevARR.toFixed(2)} = {formatPercent(totalMoM)}</div>
              <div>YoY: (1 + {(totalMoM / 100).toFixed(4)})^12 - 1 = {formatPercent(totalYoY)}</div>
            </div>
          </div>
        </div>

        {/* GROUPS */}
        {GROUPS.map((group) => {
          const groupARR = group.products.reduce((sum, p) => sum + config[p].arr, 0);
          const groupMonthGrowth = group.products.reduce((sum, p) => sum + config[p].monthGrowth, 0);
          const groupPrevARR = groupARR - groupMonthGrowth;
          const groupMoM = groupPrevARR > 0 ? (groupMonthGrowth / groupPrevARR) * 100 : 0;
          const groupYoY = (Math.pow(1 + groupMoM / 100, 12) - 1) * 100;

          return (
            <div key={group.name} className="border border-zinc-800 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 text-zinc-200">
                {group.name}
              </h2>

              {/* Group total */}
              <div className="bg-zinc-900/50 rounded p-4 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xl font-bold text-white">
                      {formatCurrency(groupARR)}
                    </div>
                    <div className={`font-mono text-sm ${groupMonthGrowth >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {formatCurrency(groupMonthGrowth)} ({formatPercent(groupMoM)} MoM · {formatPercent(groupYoY, 0)} YoY)
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500 font-mono text-right space-y-0.5">
                    <div>Sum of: {group.products.join(" + ")}</div>
                    <div>Prev: {formatCurrency(groupPrevARR)}</div>
                  </div>
                </div>
              </div>

              {/* Individual products */}
              <div className="space-y-3">
                {group.products.map((productKey) => {
                  const p = config[productKey];
                  const prevARR = p.arr - p.monthGrowth;
                  const mom = prevARR > 0 ? (p.monthGrowth / prevARR) * 100 : 0;
                  const yoy = (Math.pow(1 + mom / 100, 12) - 1) * 100;
                  const perSec = (p.arr * p.growth) / (365.25 * 24 * 3600);

                  const product = PRODUCTS.find((x) => x.key === productKey)!;

                  return (
                    <div
                      key={productKey}
                      className="border border-zinc-800 rounded p-4"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-medium text-zinc-300">
                            {product.label}
                          </div>
                          <div className="text-lg font-bold text-white">
                            {formatCurrency(p.arr)}
                          </div>
                          <div
                            className={`font-mono text-sm ${
                              p.monthGrowth >= 0 ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {formatCurrency(p.monthGrowth)} ({formatPercent(mom)} MoM · {formatPercent(yoy, 0)} YoY)
                          </div>
                        </div>
                      </div>

                      <div className="bg-zinc-900 rounded p-3 font-mono text-xs text-zinc-500 space-y-1">
                        <div className="text-zinc-400 font-semibold mb-2">Calculation details:</div>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                          <div>Current ARR (Feb):</div>
                          <div className="text-zinc-300">{formatCurrency(p.arr)}</div>

                          <div>Previous ARR (Jan):</div>
                          <div className="text-zinc-300">{formatCurrency(prevARR)}</div>

                          <div>Month Growth:</div>
                          <div className="text-zinc-300">
                            {formatCurrency(p.arr)} - {formatCurrency(prevARR)} = {formatCurrency(p.monthGrowth)}
                          </div>

                          <div>MoM %:</div>
                          <div className="text-zinc-300">
                            {p.monthGrowth.toFixed(2)} / {prevARR.toFixed(2)} = {formatPercent(mom)}
                          </div>

                          <div>YoY % (annualized):</div>
                          <div className="text-zinc-300">
                            (1 + {(mom / 100).toFixed(4)})^12 - 1 = {formatPercent(yoy)}
                          </div>

                          <div>Ticker growth rate:</div>
                          <div className="text-zinc-300">{(p.growth * 100).toFixed(1)}% / year</div>

                          <div>Ticker speed:</div>
                          <div className="text-zinc-300">${perSec.toFixed(4)} / second</div>

                          <div>Last updated:</div>
                          <div className="text-zinc-300">{new Date(p.updatedAt).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <div className="mt-8 pt-8 border-t border-zinc-800 flex gap-4">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm transition-colors"
          >
            Open Dashboard
          </a>
          <a
            href="/api/config"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm transition-colors"
          >
            View Raw API Response
          </a>
        </div>
      </div>
    </div>
  );
}
