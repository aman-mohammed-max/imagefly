import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image Fixer — thoughtful edits, pixel by pixel",
  description: "Remove, replace, and repair image regions with AI while preserving the rest of your photo.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
