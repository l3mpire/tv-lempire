import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "lempire ARR",
  description: "Live ARR Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-black text-white overflow-hidden">
        {children}
      </body>
    </html>
  );
}
