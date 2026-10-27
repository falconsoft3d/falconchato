import Script from "next/script";
import Landing from "@/components/Landing";

export default function Home() {
  return (
    <>
      <Landing />
      {/* Soporte de falconchato con su propio widget (sitio "home", atendido por IA). */}
      <Script src="/widget.js" data-site={process.env.HOME_SITE_KEY ?? "home"} strategy="afterInteractive" />
    </>
  );
}
