const fs = require('fs');
const path = require('path');

console.log("🛠️ Replit Shell Super Command running...");

// 1. Create/Update Auth Modal / Role Selection Logic
const authCode = `'use client';
import { useState } from 'react';

export default function AuthModal({ isOpen, onClose }) {
  const [role, setRole] = useState(null); // 'farmer' or 'buyer'
  const [phone, setPhone] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [pan, setPan] = useState('');
  const [businessName, setBusinessName] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-emerald-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-emerald-900">स्मार्ट किसान - प्रवेश / लॉगिन</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-xl">✕</button>
        </div>

        {!role ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center mb-4">कृपया अपना खाता प्रकार चुनें:</p>
            <button 
              onClick={() => setRole('farmer')}
              className="w-full p-4 border-2 border-emerald-500 rounded-xl hover:bg-emerald-50 text-left transition flex items-center space-x-3 group"
            >
              <span className="text-3xl">🌾</span>
              <div>
                <div className="font-bold text-emerald-900 group-hover:text-emerald-700">मैं किसान हूँ (Farmer Entry)</div>
                <div className="text-xs text-gray-500">फसल बेचने, भाव देखने व खेत-खाता हेतु</div>
              </div>
            </button>

            <button 
              onClick={() => setRole('buyer')}
              className="w-full p-4 border-2 border-amber-500 rounded-xl hover:bg-amber-50 text-left transition flex items-center space-x-3 group"
            >
              <span className="text-3xl">💼</span>
              <div>
                <div className="font-bold text-amber-900 group-hover:text-amber-700">मैं खरीदार / व्यापारी हूँ (Buyer Entry)</div>
                <div className="text-xs text-gray-500">फसल व नर्सरी की बोली (Bidding) लगाने हेतु</div>
              </div>
            </button>
          </div>
        ) : role === 'farmer' ? (
          <form onSubmit={(e) => { e.preventDefault(); alert("किसान लॉगिन सफल!"); onClose(); }} className="space-y-4">
            <button type="button" onClick={() => setRole(null)} className="text-xs text-emerald-600 underline">← दूसरा रोल चुनें</button>
            <h3 className="font-bold text-emerald-800">🌾 किसान ऑनबोर्डिंग (OTP + विवरण)</h3>
            
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">मोबाइल नंबर</label>
              <input type="tel" required placeholder="10 अंकों का मोबाइल नंबर" value={phone} onChange={(e)=>setPhone(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">आधार कार्ड नंबर (सत्यापन हेतु)</label>
              <input type="text" placeholder="12 अंकों का आधार नंबर" value={aadhaar} onChange={(e)=>setAadhaar(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm" maxLength={12} />
            </div>

            <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-emerald-700">OTP भेजें व आगे बढ़ें</button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); alert("व्यापारी रजिस्ट्रेशन सफल!"); onClose(); }} className="space-y-4">
            <button type="button" onClick={() => setRole(null)} className="text-xs text-amber-600 underline">← दूसरा रोल चुनें</button>
            <h3 className="font-bold text-amber-800">💼 खरीदार / कॉर्पोरेट रजिस्ट्रेशन</h3>
            
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">व्यापार / फर्म का नाम</label>
              <input type="text" required placeholder="जैसे: श्री राम ट्रेडिंग कं." value={businessName} onChange={(e)=>setBusinessName(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">मोबाइल नंबर</label>
              <input type="tel" required placeholder="10 अंकों का मोबाइल नंबर" value={phone} onChange={(e)=>setPhone(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">पैन कार्ड नंबर (PAN Card)</label>
              <input type="text" required placeholder="ABCDE1234F" value={pan} onChange={(e)=>setPan(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm uppercase" maxLength={10} />
            </div>

            <button type="submit" className="w-full bg-amber-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-amber-700">रजिस्टर करें व बीडिंग शुरू करें</button>
          </form>
        )}
      </div>
    </div>
  );
}
`;

// Determine directory target
const targetDir = fs.existsSync('src/components') ? 'src/components' : fs.existsSync('components') ? 'components' : 'src';
if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

fs.writeFileSync(path.join(targetDir, 'AuthModal.jsx'), authCode);
console.log(`✅ AuthModal successfully created at ${targetDir}/AuthModal.jsx`);

