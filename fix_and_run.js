const fs = require('fs');
const path = require('path');

console.log("🛠️ Fixing project directory structure...");

// 1. Ensure 'app' directory exists with a basic layout & page if missing
const appDir = path.join(process.cwd(), 'app');
const srcAppDir = path.join(process.cwd(), 'src', 'app');

let targetAppPath = appDir;
if (fs.existsSync(path.join(process.cwd(), 'src')) && !fs.existsSync(appDir)) {
    targetAppPath = srcAppDir;
}

if (!fs.existsSync(targetAppPath)) {
    fs.mkdirSync(targetAppPath, { recursive: true });
}

// Check if page.js / page.tsx exists
const pageFiles = ['page.js', 'page.tsx', 'page.jsx', 'index.js', 'index.tsx'];
let hasPage = pageFiles.some(f => fs.existsSync(path.join(targetAppPath, f)) || fs.existsSync(path.join(process.cwd(), 'pages', f)));

if (!hasPage) {
    const defaultPage = `'use client';
import { useState } from 'react';
import AuthModal from '../components/AuthModal';

export default function Home() {
  const [authOpen, setAuthOpen] = useState(false);
  return (
    <main className="min-h-screen bg-emerald-50 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8 border border-emerald-100">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-black text-emerald-900">🌾 स्मार्ट किसान (Smart Kisan)</h1>
          <button onClick={() => setAuthOpen(true)} className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold shadow hover:bg-emerald-700">
            लॉगिन / ऑनबोर्डिंग (Login)
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 border-2 border-emerald-500 rounded-xl bg-emerald-50/50">
            <h2 className="text-lg font-bold text-emerald-900 mb-2">🚜 किसान पोर्टल (Farmer Portal)</h2>
            <p className="text-sm text-gray-600 mb-4">फसल की वॉयस लिस्टिंग, खेत-खाता और MSP सुरक्षा।</p>
            <button onClick={() => setAuthOpen(true)} className="text-emerald-700 font-bold underline">किसान एंट्री शुरू करें →</button>
          </div>
          <div className="p-6 border-2 border-amber-500 rounded-xl bg-amber-50/50">
            <h2 className="text-lg font-bold text-amber-900 mb-2">💼 खरीदार पोर्टल (Buyer Portal)</h2>
            <p className="text-sm text-gray-600 mb-4">लाइव बीडिंग, फसल व नर्सरी खरीद (PAN व GST आधारित)।</p>
            <button onClick={() => setAuthOpen(true)} className="text-amber-700 font-bold underline">व्यापारी लॉगिन करें →</button>
          </div>
        </div>
        <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      </div>
    </main>
  );
}
`;
    fs.writeFileSync(path.join(targetAppPath, 'page.js'), defaultPage);
    console.log("✅ Created default index page in app directory.");
}

console.log("📦 Installing required dependencies...");
