import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ROM - Resort Operations Manager",
  description: "Hệ thống quản lý vận hành resort đa chi nhánh",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
