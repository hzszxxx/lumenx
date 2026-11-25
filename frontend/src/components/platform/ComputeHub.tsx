"use client";

import { useEffect, useState } from "react";
import { Cpu, KeyRound, ShieldCheck } from "lucide-react";
import ComputeSettings from "@/components/platform/ComputeSettings";
import XiangongyunSettings from "@/components/platform/XiangongyunSettings";
import SettingsPage from "@/components/settings/SettingsPage";

export type ComputeSubTab = "byok" | "xiangongyun" | "apikeys";

interface ComputeHubProps {
  initialTab?: ComputeSubTab;
  isAdmin?: boolean;
}

export default function ComputeHub({ initialTab = "byok", isAdmin = false }: ComputeHubProps) {
  const resolveTab = (tab: ComputeSubTab): ComputeSubTab =>
    tab === "apikeys" && !isAdmin ? "byok" : tab;

  const [activeTab, setActiveTab] = useState<ComputeSubTab>(() => resolveTab(initialTab));

  useEffect(() => {
    setActiveTab(resolveTab(initialTab));
  }, [initialTab, isAdmin]);

  const tabs: Array<{ id: ComputeSubTab; label: string; desc: string; icon: typeof KeyRound }> = [
    {
      id: "byok",
      label: "个人凭证与积分 (BYOK)",
      desc: "积分余额与个人自备模型 API-Key",
      icon: KeyRound,
    },
    {
      id: "xiangongyun",
      label: "仙宫云 H3 GPU 算力",
      desc: "仙宫云账号绑定与实例调度策略",
      icon: Cpu,
    },
    ...(isAdmin
      ? [
          {
            id: "apikeys" as const,
            label: "系统全局密钥（管理员）",
            desc: "服务端 .env 全局默认密钥与 OSS 配置",
            icon: ShieldCheck,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div
        role="tablist"
        aria-label="算力与凭证管理"
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-glass-border bg-surface/60 p-1.5 backdrop-blur-sm"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
                isActive
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-secondary hover:bg-hover-bg hover:text-foreground"
              }`}
              title={tab.desc}
            >
              <Icon size={14} className={isActive ? "text-white" : "text-primary"} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      <div>
        {activeTab === "byok" && (
          <ComputeSettings onOpenGlobalKeys={isAdmin ? () => setActiveTab("apikeys") : undefined} />
        )}
        {activeTab === "xiangongyun" && <XiangongyunSettings />}
        {activeTab === "apikeys" && isAdmin && <SettingsPage embeddedApikeysOnly />}
      </div>
    </div>
  );
}
