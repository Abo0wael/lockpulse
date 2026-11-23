import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const manrope = localFont({
  src: "../public/fonts/manrope-variable.ttf",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
});

const plusJakartaSans = localFont({
  src: "../public/fonts/plus-jakarta-sans-latin.woff2",
  variable: "--font-plus-jakarta-sans",
  weight: "400",
  display: "swap",
});

const ibmPlexMono = localFont({
  src: [
    { path: "../public/fonts/ibm-plex-mono-regular-latin.woff2", weight: "400" },
    { path: "../public/fonts/ibm-plex-mono-medium-latin.woff2", weight: "500" },
    { path: "../public/fonts/ibm-plex-mono-semibold-latin.woff2", weight: "600" },
  ],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LockPulse — System Hang Detection",
  description:
    "Explore LockPulse benchmark results and interactive analysis of system hangs in multithreaded Linux programs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${plusJakartaSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `let savedTheme = ""; try { savedTheme = window.localStorage.getItem("lockpulse-theme") || ""; } catch {} if (!savedTheme) savedTheme = document.cookie.match(/(?:^|; )lockpulse-theme=(light|dark)/)?.[1] || ""; if (savedTheme === "light") document.documentElement.dataset.theme = "light";`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
