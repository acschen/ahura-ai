import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ahura - Adaptive Learning Platform",
  description:
    "AI-powered workforce development with real-time comprehension monitoring",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-primary antialiased">
        {/* Load OpenCV.js globally — used for all computer vision / emotion detection */}
        <Script
          src="https://docs.opencv.org/4.10.0/opencv.js"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  );
}
