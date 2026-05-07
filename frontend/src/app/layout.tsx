import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_Kannada } from "next/font/google";
import { SWRConfig } from "swr";
import "./globals.css";
import { ZoneProvider } from "@/context/ZoneContext";
import { LanguageProvider } from "@/context/LanguageContext";
import SystemHealthProvider from "@/components/layout/SystemHealthProvider";
import ChromeShell from "@/components/layout/ChromeShell";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const notoKannada = Noto_Sans_Kannada({
  variable: "--font-kannada",
  subsets: ["kannada", "latin"],
  weight: ["400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: "GridWise | BESCOM EV Grid Intelligence",
  description: "AI-powered EV grid intelligence dashboard for BESCOM operators",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${notoKannada.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col font-sans bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
        <SWRConfig
          value={{
            dedupingInterval: 5000,
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
            shouldRetryOnError: false,
            errorRetryCount: 2,
          }}
        >
          <SystemHealthProvider>
            <LanguageProvider>
              <ZoneProvider>
                <ChromeShell>{children}</ChromeShell>
              </ZoneProvider>
            </LanguageProvider>
          </SystemHealthProvider>
        </SWRConfig>
      </body>
    </html>
  );
}
