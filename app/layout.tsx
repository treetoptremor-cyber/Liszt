import type { Metadata, Viewport } from "next";
import { SWRegister } from "@/components/SWRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Liszt",
  description:
    "Shared grocery lists, to-dos and notes for families and couples.",
  applicationName: "Liszt",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Liszt",
  },
};

export const viewport: Viewport = {
  themeColor: "#F7F5F1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  // Android: shrink the layout viewport when the keyboard opens so the
  // bottom-fixed add bar and sheets stay visible above it.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <SWRegister />
      </body>
    </html>
  );
}
