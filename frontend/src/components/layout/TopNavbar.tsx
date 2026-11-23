"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  GraduationCap,
  ShieldCheck,
  BriefcaseBusiness,
  Trophy,
  UserRound,
  LogIn,
  LogOut,
  Plus,
  LayoutGrid,
} from "lucide-react";
import clsx from "clsx";
import LumenXBranding from "./LumenXBranding";
import { usePlatformStore } from "@/store/platformStore";
import { type GlobalTab } from "./GlobalSidebar";

interface TopNavbarProps {
  activeTab: GlobalTab;
  onTabChange: (tab: GlobalTab) => void;
  onRequestCreate?: () => void;
  onRequestAuth?: (title?: string, description?: string) => void;
  onLogout?: () => void;
}

export type TopNavSection = "workspace" | "academy" | "competitions" | "certification" | "tasks" | "profile";

export default function TopNavbar({
  activeTab,
  onTabChange,
  onRequestCreate,
  onRequestAuth,
  onLogout,
}: TopNavbarProps) {
  const [currentSection, setCurrentSection] = useState<TopNavSection>("workspace");
  const { user } = usePlatformStore();

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash || "#/";
      if (hash.startsWith("#/academy") || hash.includes("section=academy")) {
        setCurrentSection("academy");
      } else if (hash.startsWith("#/competitions") || hash.includes("section=competitions")) {
        setCurrentSection("competitions");
      } else if (hash.startsWith("#/certification") || hash.includes("section=certification")) {
        setCurrentSection("certification");
      } else if (hash.startsWith("#/tasks") || hash.includes("section=tasks")) {
        setCurrentSection("tasks");
      } else if (hash.startsWith("#/profile") || hash.includes("section=users") || hash.includes("section=wallet")) {
        setCurrentSection("profile");
      } else if (hash === "#/" || hash.startsWith("#/project") || hash.startsWith("#/series")) {
        setCurrentSection("workspace");
      }
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const handleNavClick = (section: TopNavSection) => {
    setCurrentSection(section);
    if (section === "workspace") {
      onTabChange("workspace");
      window.location.hash = "#/";
    } else if (section === "academy") {
      onTabChange("platform");
      window.location.hash = "#/platform?section=academy";
    } else if (section === "competitions") {
      onTabChange("platform");
      window.location.hash = "#/platform?section=competitions";
    } else if (section === "certification") {
      onTabChange("platform");
      window.location.hash = "#/platform?section=certification";
    } else if (section === "tasks") {
      onTabChange("platform");
      window.location.hash = "#/platform?section=tasks";
    } else if (section === "profile") {
      onTabChange("platform");
      window.location.hash = "#/platform?section=users";
    }
  };

  const navItems: Array<{ id: TopNavSection; label: string; icon: typeof LayoutGrid }> = [
    { id: "academy", label: "课程培训", icon: GraduationCap },
    { id: "certification", label: "考核认证", icon: ShieldCheck },
    { id: "tasks", label: "任务市场", icon: BriefcaseBusiness },
    { id: "workspace", label: "创作工作区", icon: LayoutGrid },
    { id: "competitions", label: "赛事活动", icon: Trophy },
    { id: "profile", label: "个人中心", icon: UserRound },
  ];

  return (
    <header className="sticky top-0 z-40 w-full h-14 border-b border-glass-border bg-surface backdrop-blur-xl px-4 md:px-6 flex items-center justify-between transition-colors">
      {/* 左侧：Logo 与品牌 */}
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={() => handleNavClick("workspace")}
          className="flex items-center gap-2 text-left hover:opacity-90 transition-opacity focus:outline-none"
        >
          <LumenXBranding size="xs" showSlogan={false} />
        </button>

        {/* 顶部主导航菜单项 */}
        <nav className="hidden md:flex items-center gap-1.5" aria-label="顶部栏目导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={clsx(
                  "relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary font-semibold"
                    : "text-text-secondary hover:text-foreground hover:bg-hover-bg"
                )}
              >
                <Icon size={16} className={isActive ? "text-primary" : "text-text-muted"} />
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 右侧：开始创作按钮 & 用户登录状态 */}
      <div className="flex items-center gap-3">
        {/* 高亮开始创作按钮 */}
        <button
          type="button"
          onClick={() => {
            if (!user && onRequestAuth) {
              onRequestAuth("开始创作需要登录创作者账号", "登录后即可创建剧本分镜、进入节点画布并生成 AI 视频");
              return;
            }
            if (onRequestCreate) {
              onRequestCreate();
            } else {
              window.location.hash = "#/new-project";
            }
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs sm:text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors"
        >
          <Plus size={15} />
          <span>开始创作</span>
        </button>

        {/* 用户态 */}
        {user ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleNavClick("profile")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-glass-border bg-hover-bg/40 text-xs text-foreground hover:bg-hover-bg transition-colors"
              title="进入个人中心"
            >
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">
                {user.username.slice(0, 1).toUpperCase()}
              </span>
              <span className="max-w-[80px] truncate">{user.username}</span>
            </button>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 rounded-lg text-text-muted hover:text-foreground hover:bg-hover-bg transition-colors"
                title="退出登录"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onRequestAuth && onRequestAuth("登录影伴创作者平台", "登录后查看完整栏目权限、参与认证与任务接单")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-glass-border text-xs sm:text-sm font-medium text-foreground hover:bg-hover-bg transition-colors"
            >
              <LogIn size={14} className="text-primary" />
              <span>登录 / 注册</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
