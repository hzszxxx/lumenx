"use client";

import { useState, useEffect } from "react";
import { useSettingsStore, type ThemePreset } from "@/store/settingsStore";
import { publicAssetPath } from "@/lib/publicAsset";

interface LumenXBrandingProps {
  size?: "sm" | "md";
  showSlogan?: boolean;
}

// Logo 变体按主题映射（Tasty Sam 同形电路枫叶，透明底）。
// atelier-dark 复用蓝色 logo-dark.png，再用 CSS filter 着色为 teal。
const LOGO_SRC: Record<ThemePreset, string> = {
  "atelier-dark": "/yingban-logo.png",
  "bridge-dark": "/yingban-logo.png",
  "brand-dark": "/yingban-logo.png",
  "atelier-light": "/yingban-logo.png",
  "brand-light": "/yingban-logo.png",
};

export default function LumenXBranding({ size = "md" }: LumenXBrandingProps) {
  const logoSize = size === "sm" ? "w-28" : "w-40";
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
        className={`${logoSize} h-auto rounded-lg bg-white object-contain`}
      />
    </div>
  );
}
