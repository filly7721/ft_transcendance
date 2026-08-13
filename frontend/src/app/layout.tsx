import type { Metadata } from "next";
import { Geist, Geist_Mono, Press_Start_2P } from "next/font/google";
import "./globals.css";
import TopBar from "@/components/layout/TopBar";
import Footer from "@/components/layout/Footer";
import AuthProvider from "@/components/auth/AuthProvider";
import NotificationProvider from "@/components/NotificationProvider";

// Kept available as `font-sans` / `--font-geist-sans`, but not preloaded:
// nothing renders in it today, so the browser fetched the file on every page
// load and then reported an unused preload. Without the preload it costs
// nothing until something actually asks for it — at which point it loads
// normally, and preloading is worth reconsidering.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: false,
});
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const pressStart = Press_Start_2P({
  weight: "400",
  variable: "--font-press-start",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ARCADE — Mini Games",
  description: "A collection of classic arcade mini games",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${pressStart.variable} h-full antialiased`}
    >
      <body className="flex min-h-screen flex-col">
        <AuthProvider>
          <NotificationProvider>
            <TopBar />
            {/* Pages provide their own <main>; (with-sidebar)/layout.tsx adds the sidebar */}
            <div className="flex flex-1">{children}</div>
            <Footer />
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
