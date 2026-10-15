import "../artifacts/smart-kisan/src/index.css";

export const metadata = {
  title: "Smart Kisan (स्मार्ट किसान)",
  applicationName: "Smart Kisan",
  description:
    "Smart Kisan Bharat - Modern Agri Ecosystem (By Smart Star Solutions)",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Smart Kisan",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#174d36",
};

export default function RootLayout({ children }) {
  return (
    <html lang="hi-IN">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
