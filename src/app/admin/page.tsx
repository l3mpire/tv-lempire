"use client";

import { useEffect, useState } from "react";

export default function AdminPage() {
  const [arr, setArr] = useState("");
  const [growth, setGrowth] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Load current config
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        setArr(String(data.arr));
        setGrowth(String(data.growth));
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        arr: Number(arr),
        growth: Number(growth),
      }),
    });

    if (res.ok) {
      setMessage("Saved!");
    } else {
      const data = await res.json();
      setMessage(`Error: ${JSON.stringify(data.error)}`);
    }

    setSaving(false);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-8">Admin - ARR Dashboard</h1>

        <div className="space-y-6">
          <div>
            <label className="block text-zinc-400 text-sm mb-2">
              ARR de base ($)
            </label>
            <input
              type="number"
              value={arr}
              onChange={(e) => setArr(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-4 py-3 text-white text-lg focus:outline-none focus:border-green-500"
            />
            <p className="text-zinc-600 text-sm mt-1">
              ${Number(arr).toLocaleString("en-US")}
            </p>
          </div>

          <div>
            <label className="block text-zinc-400 text-sm mb-2">
              Taux de croissance annuel
            </label>
            <input
              type="number"
              step="0.01"
              value={growth}
              onChange={(e) => setGrowth(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-4 py-3 text-white text-lg focus:outline-none focus:border-green-500"
            />
            <p className="text-zinc-600 text-sm mt-1">
              {(Number(growth) * 100).toFixed(0)}% YoY &mdash; ~$
              {((Number(arr) * Number(growth)) / 365.25 / 24 / 3600).toFixed(2)}
              /sec
            </p>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded text-sm font-medium transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {message && (
            <span className={message.startsWith("Error") ? "text-red-400 text-sm" : "text-green-400 text-sm"}>
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
