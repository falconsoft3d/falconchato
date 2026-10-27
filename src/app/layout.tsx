import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { I18nProvider } from "@/components/I18nProvider";
import { ThemeSync } from "@/components/ThemeSwitch";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "falconchato",
  description: "Chat en vivo para tus sitios web",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Aplica el tema antes de pintar para que no parpadee (el widget y la demo siempre en claro). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=location.pathname;if(p.indexOf("/widget")===0||p.indexOf("/demo")===0)return;var t=localStorage.getItem("fc_theme")||"system";if(t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`,
          }}
        />
        <script defer data-project="xpwlquenhuwslqdzgudl" src="http://falcondatabase.com/a.js"></script>
      </head>
      <body className="min-h-full flex flex-col">
        <I18nProvider>{children}</I18nProvider>
        <Suspense>
          <ThemeSync />
        </Suspense>
      </body>
    </html>
  );
}
