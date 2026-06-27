import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Đọc Giúp — Trợ lý đọc hiểu cho người Việt",
  description:
    "Chụp văn bản, nghe giải thích đơn giản bằng tiếng Việt. Dành cho người lớn tuổi.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={inter.variable}>
      <head>
        <meta name="theme-color" content="#0a0a14" />
      </head>
      <body>{children}</body>
    </html>
  );
}
