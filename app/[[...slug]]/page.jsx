"use client";

import dynamic from "next/dynamic";

const SmartKisanApp = dynamic(
  () => import("../../artifacts/smart-kisan/src/App"),
  {
    ssr: false,
    loading: () => (
      <main className="grid min-h-screen place-items-center bg-[#f7f5ec] p-6 text-center text-[#174d36]">
        <div>
          <img
            src="/icon-192.png"
            alt=""
            className="mx-auto mb-4 h-16 w-16 rounded-2xl"
          />
          <p className="font-semibold">स्मार्ट किसान</p>
          <p className="mt-1 text-sm">Smart Kisan is loading…</p>
        </div>
      </main>
    ),
  },
);

export default function SmartKisanRoute() {
  return <SmartKisanApp />;
}
