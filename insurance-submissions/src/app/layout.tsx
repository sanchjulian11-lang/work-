import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Underwriting Desk",
  description:
    "Ontario contractor intake and broker-reviewed submission preparation",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
