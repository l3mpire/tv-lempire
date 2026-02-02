"use client";

import { useEffect, useState } from "react";

export default function AdminPage() {
  const [arr, setArr] = useState("108000000");
  const [growth, setGrowth] = useState("0.30");
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const dashboardUrl = `${baseUrl}/?arr=${arr}&growth=${growth}`;

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

        <div className="mt-10 p-4 bg-zinc-900 border border-zinc-800 rounded">
          <p className="text-zinc-400 text-sm mb-2">URL du dashboard :</p>
          <code className="text-green-400 text-sm break-all block">
            {dashboardUrl}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(dashboardUrl)}
            className="mt-3 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm transition-colors"
          >
            Copier le lien
          </button>
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-3 px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-sm transition-colors inline-block"
          >
            Ouvrir le dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
