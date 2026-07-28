import type { Metadata } from "next";
import { AuthGate, AuthProvider } from "./auth-context";
import "./globals.css";

const geistSans = { variable: "--font-geist-sans" };
const geistMono = { variable: "--font-geist-mono" };

const title = "VacancyPortal — Browse Opportunities";
const description = "Browse vacancies, compare listed salaries with official Malaysian market context, and view grounded job details.";
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
