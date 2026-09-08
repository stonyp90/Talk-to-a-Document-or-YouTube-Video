import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Talk to a Document",
  description: "Ask questions about a PDF or YouTube transcript with voice or text.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
