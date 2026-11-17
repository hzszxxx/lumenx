"use client";

import { useState, useEffect } from "react";
import { useSettingsStore, type ThemePreset } from "@/store/settingsStore";
import { publicAssetPath } from "@/lib/publicAsset";

interface LumenXBrandingProps {
  size?: "sm" | "md" | "lg";
  showSlogan?: boolean;
}

// Logo 变体按主题映射
const LOGO_SRC: Record<ThemePreset, string> = {
  "atelier-dark": "/yingban-logo.png",
  "bridge-dark": "/yingban-logo.png",
  "brand-dark": "/yingban-logo.png",
  "atelier-light": "/yingban-logo.png",
  "brand-light": "/yingban-logo.png",
};

export default function LumenXBranding({ size = "md" }: LumenXBrandingProps) {
  const logoSize = size === "sm" ? "w-24 h-24" : size === "lg" ? "w-44 h-44" : "w-36 h-36";
  const theme = useSettingsStore((s) => s.theme);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const activeTheme: ThemePreset = mounted ? theme : "atelier-dark";
  const logoSrc = publicAssetPath(LOGO_SRC[activeTheme] ?? "/yingban-logo.png");

  return (
    <div className="flex justify-center">
      <img
        src={logoSrc}
        alt="YingBan"
        className={`${logoSize} aspect-square object-contain drop-shadow-sm`}
      />
    </div>
  );
}
