"use client";

import { useEffect, useState } from "react";

type ProductConfig = {
  arr: string;
  growth: string;
  monthGrowth: string;
};

const PRODUCTS = [
  { key: "lemlist", label: "lemlist" },
  { key: "claap", label: "Claap" },
  { key: "taplio", label: "Taplio" },
  { key: "tweethunter", label: "Tweet Hunter" },
] as const;

type ProductKey = (typeof PRODUCTS)[number]["key"];

const emptyProduct = (): ProductConfig => ({
  arr: "",
  growth: "",
  monthGrowth: "0",
});

export default function AdminPage() {
  const [products, setProducts] = useState<Record<ProductKey, ProductConfig>>({
    lemlist: emptyProduct(),
    claap: emptyProduct(),
    taplio: emptyProduct(),
    tweethunter: emptyProduct(),
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        const loaded: Record<string, ProductConfig> = {};
        for (const p of PRODUCTS) {
          if (data[p.key]) {
            loaded[p.key] = {
              arr: String(data[p.key].arr),
              growth: String(data[p.key].growth),
              monthGrowth: String(data[p.key].monthGrowth ?? 0),
            };
          }
        }
        setProducts((prev) => ({ ...prev, ...loaded }));
      });
  }, []);

  function updateField(
    key: ProductKey,
    field: keyof ProductConfig,
    value: string
  ) {
    setProducts((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const body: Record<string, { arr: number; growth: number; monthGrowth: number }> = {};
    for (const p of PRODUCTS) {
      body[p.key] = {
        arr: Number(products[p.key].arr),
        growth: Number(products[p.key].growth),
        monthGrowth: Number(products[p.key].monthGrowth),
      };
    }

    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setMessage("Saved!");
    } else {
      // Fallback: save to localStorage for local dev
      const now = Date.now();
      const localConfig: Record<string, unknown> = {};
      for (const p of PRODUCTS) {
        localConfig[p.key] = { ...body[p.key], updatedAt: now };
      }
      localStorage.setItem("arr-config", JSON.stringify(localConfig));
      setMessage("Saved to localStorage (Edge Config not available)");
    }

    setSaving(false);
  }

  function formatPreview(key: ProductKey) {
    const p = products[key];
    const arr = Number(p.arr);
    const growth = Number(p.growth);
    const perSec = (arr * growth) / (365.25 * 24 * 3600);
    return {
      arrFormatted: "$" + arr.toLocaleString("en-US"),
      yoy: (growth * 100).toFixed(0) + "% YoY",
      perSec: "$" + perSec.toFixed(2) + "/sec",
    };
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">Admin - ARR Dashboard</h1>

        <div className="space-y-8">
          {PRODUCTS.map((p) => {
            const preview = formatPreview(p.key);
            return (
              <div
                key={p.key}
                className="border border-zinc-800 rounded-lg p-6"
              >
                <h2 className="text-lg font-semibold mb-4 text-zinc-200">
                  {p.label}
                </h2>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-zinc-400 text-xs mb-1">
                      ARR ($)
                    </label>
                    <input
                      type="number"
                      value={products[p.key].arr}
                      onChange={(e) => updateField(p.key, "arr", e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500"
                    />
                    <p className="text-zinc-600 text-xs mt-1">
                      {preview.arrFormatted}
                    </p>
                  </div>

                  <div>
                    <label className="block text-zinc-400 text-xs mb-1">
                      Growth annuel
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={products[p.key].growth}
                      onChange={(e) =>
                        updateField(p.key, "growth", e.target.value)
                      }
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500"
                    />
                    <p className="text-zinc-600 text-xs mt-1">
                      {preview.yoy} &mdash; {preview.perSec}
                    </p>
                  </div>

                  <div>
                    <label className="block text-zinc-400 text-xs mb-1">
                      Croissance mois ($)
                    </label>
                    <input
                      type="number"
                      value={products[p.key].monthGrowth}
                      onChange={(e) =>
                        updateField(p.key, "monthGrowth", e.target.value)
                      }
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500"
                    />
                    <p className="text-zinc-600 text-xs mt-1">
                      {Number(products[p.key].monthGrowth) >= 0 ? "+" : ""}
                      ${Number(products[p.key].monthGrowth).toLocaleString("en-US")}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded text-sm font-medium transition-colors"
          >
            {saving ? "Saving..." : "Save all"}
          </button>
          {message && (
            <span
              className={
                message.startsWith("Error")
                  ? "text-red-400 text-sm"
                  : "text-green-400 text-sm"
              }
            >
              {message}
            </span>
          )}
        </div>

        <div className="mt-8 pt-8 border-t border-zinc-800">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm transition-colors inline-block"
          >
            Ouvrir le dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
