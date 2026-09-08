import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ursly.io"),
  title: { default: "Ursly — The joy of understanding", template: "%s | Ursly" },
  applicationName: "Ursly",
  description: "Your sources. Your questions. A real conversation. Explore PDFs and captioned YouTube videos with voice or text.",
  appleWebApp: { capable: true, title: "Ursly", statusBarStyle: "default" },
  openGraph: {
    type: "website", siteName: "Ursly", title: "Ursly — The joy of understanding",
    description: "Explore your documents and videos through conversation.",
    images: [{ url: "/brand/social-card.png", width: 1200, height: 630, alt: "Ursly — The joy of understanding" }],
  },
  twitter: { card: "summary_large_image", images: ["/brand/social-card.png"] },
};

export const viewport: Viewport = { themeColor: "#F8F5EF" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
