import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "Splitka — ділимо витрати разом",
  description:
    "Спрощений Splitwise: створіть групу, поділіться лінком з друзями і ведіть спільні витрати без реєстрації.",
  appleWebApp: {
    capable: true,
    title: "Splitka",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#14a085",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
