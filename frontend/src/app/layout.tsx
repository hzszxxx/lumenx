import "./globals.css";
import AppAccessGate from "@/components/AppAccessGate";
import { Providers } from "@/components/Providers";
import TauriDragBar from "@/components/layout/TauriDragBar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className="atelier-light" suppressHydrationWarning>
      <head>
        <title>YingBan Studio</title>
        <meta name="description" content="AI-Native Motion Comic Creation Platform" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var P=["atelier-dark","bridge-dark","brand-dark","atelier-light","brand-light"];var raw=localStorage.getItem("lumenx-settings");var d=JSON.parse(raw||"{}");var v=d.version||0;var t=d.state&&d.state.theme;if(v<2&&t==="atelier-dark"){t="atelier-light";}document.documentElement.className=(P.indexOf(t)>=0)?t:"atelier-light";}catch(e){document.documentElement.className="atelier-light";}})();`,
          }}
        />
        {/* Desktop app: compact font-size for embedded windows (Tauri / pywebview).
            Detection covers: Tauri protocol, Tauri global, pywebview global,
            and the production static/index.html served by backend (pywebview). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var p=window.location.protocol;var h=window.location.hostname;var isTauri=p==='tauri:'||window.__TAURI__||window.__TAURI_INTERNALS__||(p==='https:'&&h==='tauri.localhost');var isPywebview=!!window.pywebview||(p==='http:'&&(h==='127.0.0.1'||h==='localhost')&&window.location.pathname.indexOf('/static/')===0);if(isTauri||isPywebview){document.documentElement.style.fontSize='81.25%';}})();`,
          }}
        />
      </head>
      <body className="font-sans bg-background text-foreground antialiased">
        <Providers>
          <TauriDragBar />
          <AppAccessGate>
            {children}
          </AppAccessGate>
        </Providers>
      </body>
    </html>
  );
}
