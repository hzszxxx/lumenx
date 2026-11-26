"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { BriefcaseBusiness, GraduationCap, KeyRound, LogIn, ShieldCheck, Sparkles, Trophy, UserRound, Users } from "lucide-react";
import { formatPlatformError, platformApi } from "@/lib/platformApi";
import { readAppAccessSession } from "@/lib/appAccess";
import { usePlatformStore } from "@/store/platformStore";
import ComputeHub, { type ComputeSubTab } from "@/components/platform/ComputeHub";
import SkillSettings from "@/components/platform/SkillSettings";
import CompetitionSettings from "@/components/platform/CompetitionSettings";
import CertificationSettings from "@/components/platform/CertificationSettings";
import TaskSettings from "@/components/platform/TaskSettings";
import AcademySettings from "@/components/platform/AcademySettings";
import UserSettings from "@/components/platform/UserSettings";
import AgentCenter from "@/components/platform/AgentCenter";
import WalletSettings from "@/components/platform/WalletSettings";
import PlatformFooter from "@/components/platform/PlatformFooter";
import LumenXBranding from "@/components/layout/LumenXBranding";
import { Building2, Wallet } from "lucide-react";

type Section = "users" | "compute" | "skills" | "agent" | "competitions" | "certification" | "tasks" | "wallet" | "academy";

const sections: Array<{ id: Section; label: string; icon: typeof Users }> = [
  { id: "academy", label: "课程培训", icon: GraduationCap },
  { id: "certification", label: "考核认证", icon: ShieldCheck },
  { id: "tasks", label: "任务市场", icon: BriefcaseBusiness },
  { id: "competitions", label: "赛事活动", icon: Trophy },
  { id: "users", label: "个人中心", icon: UserRound },
  { id: "wallet", label: "收益与钱包", icon: Wallet },
  { id: "compute", label: "算力与凭证", icon: KeyRound },
  { id: "skills", label: "我的视频 Skill", icon: Sparkles },
  { id: "agent", label: "渠道代理", icon: Building2 },
];

export default function PlatformPortal() {
  const tn = useTranslations("nav");
  const locale = useLocale();
  const isZh = locale.startsWith("zh");
  const [section, setSection] = useState<Section>("tasks");
  const [computeSubTab, setComputeSubTab] = useState<ComputeSubTab>("byok");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [registerMode, setRegisterMode] = useState(false);
  const [appAccessUnlocked, setAppAccessUnlocked] = useState(false);
  const [inviteRequired, setInviteRequired] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ competitions: number; tasks: number; courses: number } | null>(null);
  const [tokenUsage, setTokenUsage] = useState<{ prompt_tokens: number; completion_tokens: number; total_tokens: number } | null>(null);
  const { user, walletCents, loading, error, initialize, login, register, logout } = usePlatformStore();

  useEffect(() => { void initialize(); }, [initialize]);

  useEffect(() => {
    platformApi.authConfig()
      .then((cfg) => setInviteRequired(Boolean(cfg.registration_invite_required)))
      .catch(() => setInviteRequired(true));
  }, []);

  useEffect(() => { void readAppAccessSession().then(session => setAppAccessUnlocked(session.auth_required && session.authenticated)).catch(() => setAppAccessUnlocked(false)); }, []);

  useEffect(() => {
    const syncSection = () => {
      const match = window.location.hash.match(/^#\/platform\?section=([^&]+)/);
      if (match && match[1] === "apikeys") {
        setSection("compute");
        setComputeSubTab("apikeys");
      } else if (match && match[1] === "xiangongyun") {
        setSection("compute");
        setComputeSubTab("xiangongyun");
      } else if (match && sections.some(item => item.id === match[1])) {
        setSection(match[1] as Section);
      } else if (window.location.hash === "#/tasks" || !window.location.hash || window.location.hash === "#/" || window.location.hash === "#") {
        setSection("tasks");
      } else if (window.location.hash === "#/academy" || window.location.hash === "#/courses") {
        setSection("academy");
      } else if (window.location.hash === "#/competitions" || window.location.hash === "#/events") {
        setSection("competitions");
      } else if (window.location.hash === "#/certification") {
        setSection("certification");
      } else if (window.location.hash === "#/profile" || window.location.hash === "#/users") {
        setSection("users");
      } else if (window.location.hash === "#/apikeys" || window.location.hash === "#/api-key" || window.location.hash === "#/apikey") {
        setSection("compute");
        setComputeSubTab("apikeys");
      } else if (window.location.hash.startsWith("#/platform")) {
        setSection("tasks");
      }
    };
    syncSection(); window.addEventListener("hashchange", syncSection);
    return () => window.removeEventListener("hashchange", syncSection);
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all([platformApi.competitions(), platformApi.tasks(), platformApi.courses(), platformApi.tokenUsage()])
      .then(([competitions, tasks, courses, usage]) => { setSummary({ competitions: competitions.length, tasks: tasks.length, courses: courses.length }); setTokenUsage(usage); })
      .catch(() => setSummary(null));
  }, [user]);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault(); setMessage(null);
    try { if (registerMode) await register(username, password, email || undefined, inviteCode); else await login(username, password); setPassword(""); setMessage(registerMode ? "账户已创建并登录" : "登录成功"); }
    catch { /* store exposes the error */ }
  };

  const isPublicSection = ["academy", "certification", "tasks", "competitions"].includes(section);

  const renderAuthForm = () => (
    <div className="w-full max-w-md mx-auto my-10 flex flex-col items-center">
      <div className="mb-6 flex flex-col items-center text-center">
        <LumenXBranding size="md" />
        <p className="font-display atelier-display text-[0.875rem] italic text-text-muted tracking-wide mt-2">
          {tn("brandSlogan")}
        </p>
      </div>
      <div className="bg-surface border border-glass-border rounded-2xl p-6 sm:p-8 w-full shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-xl bg-primary/15 p-3 text-primary">
            <LogIn size={22} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {registerMode ? (appAccessUnlocked ? "创建测试账户" : (inviteRequired ? "邀请码注册" : "新用户注册")) : "登录创作者平台"}
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              登录后进入个人中心、算力钱包与创作工作台
            </p>
          </div>
        </div>
        <form onSubmit={submitAuth} className="space-y-4">
          <input
            className="glass-input w-full"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            className="glass-input w-full"
            type="password"
            placeholder="密码（至少 12 位）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={12}
            required
          />
          {registerMode && (
            <>
              <input
                className="glass-input w-full"
                type="email"
                placeholder="邮箱（可选）"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {appAccessUnlocked ? (
                <p className="text-xs text-text-muted">当前测试会话已解锁，注册时无需再次输入邀请码。</p>
              ) : inviteRequired ? (
                <>
                  <input
                    className="glass-input w-full"
                    placeholder="邀请码 (必填)"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    minLength={6}
                    maxLength={64}
                    required
                  />
                  <p className="text-xs text-text-muted">当前平台开启了邀请码限制，请输入有效邀请码完成注册。</p>
                </>
              ) : (
                <>
                  <input
                    className="glass-input w-full"
                    placeholder="邀请码 / 代理码（选填）"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    maxLength={64}
                  />
                  <p className="text-xs text-text-muted">当前为开放注册模式。若持有导师或代理商邀请码，输入可绑定分销权益与专属折扣。</p>
                </>
              )}
            </>
          )}
          <button
            className="bg-primary text-white rounded-lg px-4 py-3 w-full font-semibold disabled:opacity-50 transition-opacity hover:opacity-95"
            disabled={loading}
          >
            {loading ? "处理中…" : registerMode ? "注册并登录" : "登录"}
          </button>
        </form>
        <button
          type="button"
          className="text-sm text-primary mt-4 hover:underline"
          onClick={() => setRegisterMode((v) => !v)}
        >
          {registerMode ? "已有账户？返回登录" : "还没有账户？注册"}
        </button>
        {(error || message) && (
          <p role="status" className={`mt-4 text-sm ${error ? "text-status-failed-fg" : "text-status-success-fg"}`}>
            {error ? formatPlatformError(error) : message}
          </p>
        )}
      </div>
    </div>
  );

  const accountSections = sections.filter((s) =>
    ["users", "wallet", "compute", "skills", "agent"].includes(s.id)
  );

  // 公共门户频道（任务市场、课程培训、考核认证、赛事活动）全宽沉浸展示，无内部冗余标题
  if (section === "tasks") {
    return (
      <div className="min-h-full flex flex-col justify-between bg-background">
        <main className="py-6 md:py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <TaskSettings />
          </div>
        </main>
        <PlatformFooter />
      </div>
    );
  }

  if (section === "academy") {
    return (
      <div className="min-h-full flex flex-col justify-between bg-background">
        <main className="py-6 md:py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <AcademySettings />
          </div>
        </main>
        <PlatformFooter />
      </div>
    );
  }

  if (section === "certification") {
    return (
      <div className="min-h-full flex flex-col justify-between bg-background">
        <main className="py-6 md:py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <CertificationSettings />
          </div>
        </main>
        <PlatformFooter />
      </div>
    );
  }

  if (section === "competitions") {
    return (
      <div className="min-h-full flex flex-col justify-between bg-background">
        <main className="py-6 md:py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <CompetitionSettings />
          </div>
        </main>
        <PlatformFooter />
      </div>
    );
  }

  if (!user && !isPublicSection) {
    return (
      <div className="min-h-full flex flex-col justify-between bg-background">
        <main className="p-6 md:p-10">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {accountSections.map(item => {
                const Icon = item.icon;
                const isActive = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSection(item.id);
                      window.location.hash = `#/platform?section=${item.id}`;
                    }}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                      isActive
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "glass-panel text-text-secondary hover:text-foreground hover:bg-hover-bg border-glass-border"
                    }`}
                  >
                    <Icon size={14} className={isActive ? "text-white" : "text-primary"} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            {renderAuthForm()}
          </div>
        </main>
        <PlatformFooter />
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col justify-between bg-background">
      <main className="p-6 md:p-10">
        <header className="max-w-6xl mx-auto mb-8 flex items-start justify-between gap-6">
          <div>
            <p className="font-mono text-xs tracking-[0.28em] text-primary uppercase">
              {isZh ? "创作者中心 · 账户与资产" : "Creator Center · Account & Assets"}
            </p>
            <h1 className="text-3xl font-display text-foreground mt-2">个人与资产管理</h1>
            <p className="text-text-secondary mt-1 text-sm">个人资料、签约认证、算力钱包与渠道代理设置</p>
          </div>
          <div className="flex gap-2">
            {user?.role === "admin" && (
              <button type="button" onClick={() => { window.location.hash = "#/admin"; }} className="glass-button">
                管理后台
              </button>
            )}
            {user ? (
              <button type="button" onClick={() => void logout()} className="glass-button">
                退出登录
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setSection("users"); window.location.hash = "#/platform?section=users"; }}
                className="glass-button !bg-primary !text-white"
              >
                登录账号
              </button>
            )}
          </div>
        </header>
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Account Sub-sections Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {accountSections.map(item => {
              const Icon = item.icon;
              const isActive = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSection(item.id);
                    window.location.hash = `#/platform?section=${item.id}`;
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                    isActive
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "glass-panel text-text-secondary hover:text-foreground hover:bg-hover-bg border-glass-border"
                  }`}
                >
                  <Icon size={14} className={isActive ? "text-white" : "text-primary"} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Section View */}
          <div>
            {section === "users" && <UserSettings />}
            {section === "compute" && (
              <ComputeHub initialTab={computeSubTab} isAdmin={user?.role === "admin"} />
            )}
            {section === "skills" && <SkillSettings />}
            {section === "agent" && <AgentCenter />}
            {section === "wallet" && <WalletSettings />}
          </div>
        </div>
      </main>
      <PlatformFooter />
    </div>
  );
}

