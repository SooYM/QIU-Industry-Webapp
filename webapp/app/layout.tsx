import type { Metadata } from "next";
import { AuthGate, AuthProvider } from "./auth-context";
import "./globals.css";

const geistSans = { variable: "--font-geist-sans" };
const geistMono = { variable: "--font-geist-mono" };

const title = "QIU Industry Day 2026";
const description = "Explore QIU Industry Day 2026 — attending companies, vacancies matched to your course, events and attendance.";
export const metadata: Metadata = {
  title,
  description,
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-MY">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider><AuthGate>{children}</AuthGate></AuthProvider>
      </body>
    </html>
  );
}
