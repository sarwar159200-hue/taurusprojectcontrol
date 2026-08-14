import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Controls Intelligence",
  description: "Secure document control, progress, and integrated schedule portal"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
