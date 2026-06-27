import './globals.css';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a14',
};

export const metadata = {
  title: 'Soi Thuốc — Trợ lý đọc hiểu văn bản',
  description: 'Ứng dụng AI giúp người cao tuổi Việt Nam đọc và hiểu văn bản: nhãn thuốc, hóa đơn, giấy tờ. Chỉ cần chụp ảnh, AI sẽ đọc giúp bạn.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Soi Thuốc',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body suppressHydrationWarning>
        <div className="app-container">
          <header className="app-header">
            <h1 className="app-header-title">🔍 Soi Thuốc</h1>
            <p className="app-header-subtitle">Trợ lý đọc hiểu cho người Việt</p>
          </header>
          <main className="screen">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
