"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BriefcaseBusiness, GraduationCap, KeyRound, LogIn, ShieldCheck, Sparkles, Trophy, UserRound, Users, Cpu } from "lucide-react";
import { platformApi } from "@/lib/platformApi";
import { readAppAccessSession } from "@/lib/appAccess";
import { usePlatformStore } from "@/store/platformStore";
import ComputeSettings from "@/components/platform/ComputeSettings";
import SkillSettings from "@/components/platform/SkillSettings";
import XiangongyunSettings from "@/components/platform/XiangongyunSettings";
import CompetitionSettings from "@/components/platform/CompetitionSettings";
import CertificationSettings from "@/components/platform/CertificationSettings";
import TaskSettings from "@/components/platform/TaskSettings";
import AcademySettings from "@/components/platform/AcademySettings";
import UserSettings from "@/components/platform/UserSettings";
import AgentCenter from "@/components/platform/AgentCenter";
import LumenXBranding from "@/components/layout/LumenXBranding";
import { Building2 } from "lucide-react";

type Section = "users" | "compute" | "skills" | "xiangongyun" | "agent" | "competitions" | "certification" | "tasks" | "academy";

const sections: Array<{ id: Section; label: string; icon: typeof Users }> = [
  { id: "users", label: "用户管理", icon: Users },
  { id: "compute", label: "算力与凭证", icon: KeyRound },
  { id: "skills", label: "我的视频 Skill", icon: Sparkles },
  { id: "xiangongyun", label: "仙宫云 H3", icon: Cpu },
  { id: "agent", label: "渠道代理", icon: Building2 },
  { id: "competitions", label: "赛事活动", icon: Trophy },
  { id: "certification", label: "创作者认证", icon: ShieldCheck },
  { id: "tasks", label: "商业任务", icon: BriefcaseBusiness },
  { id: "academy", label: "培训学院", icon: GraduationCap },
];

export default function PlatformPortal() {
  const [section, setSection] = useState<Section>("users");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [registerMode, setRegisterMode] = useState(false);
  const [appAccessUnlocked, setAppAccessUnlocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ competitions: number; tasks: number; courses: number } | null>(null);
  const [tokenUsage, setTokenUsage] = useState<{ prompt_tokens: number; completion_tokens: number; total_tokens: number } | null>(null);
  const { user, walletCents, loading, error, initialize, login, register, logout } = usePlatformStore();

  useEffect(() => { void initialize(); }, [initialize]);

  useEffect(() => { void readAppAccessSession().then(session => setAppAccessUnlocked(session.auth_required && session.authenticated)).catch(() => setAppAccessUnlocked(false)); }, []);

  useEffect(() => {
    const syncSection = () => {
      const match = window.location.hash.match(/^#\/platform\?section=([^&]+)/);
      if (match && sections.some(item => item.id === match[1])) setSection(match[1] as Section);
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

  if (!user) {
    return (
      <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 md:p-8 bg-background">
        <div className="w-full max-w-md flex flex-col items-center">
          <div className="mb-6 flex flex-col items-center text-center">
            <LumenXBranding size="md" />
            <p className="font-display atelier-display text-[0.875rem] italic text-text-muted tracking-wide mt-2">
              Render Noise into Narrative
            </p>
          </div>
          <div className="glass-panel p-6 sm:p-8 w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-xl bg-primary/15 p-3 text-primary">
                <LogIn size={22} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {registerMode ? (appAccessUnlocked ? "创建测试账户" : "邀请码注册") : "登录创作者平台"}
                </h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  登录后进入 Studio / 画布 和平台业务
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
                  ) : (
                    <>
                      <input
                        className="glass-input w-full"
                        placeholder="邀请码"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        minLength={6}
                        maxLength={64}
                        required
                      />
                      <p className="text-xs text-text-muted">请输入有效邀请码，注册时会自动验证并消费。</p>
                    </>
                  )}
                </>
              )}
              <button
                className="bg-primary text-foreground rounded-lg px-4 py-3 w-full font-semibold disabled:opacity-50 transition-opacity hover:opacity-95"
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
                {error || message}
              </p>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full p-6 md:p-10 bg-background">
      <header className="max-w-6xl mx-auto mb-8 flex items-start justify-between gap-6">
        <div>
          <p className="font-mono text-xs tracking-[0.28em] text-primary uppercase">Creator Platform · Account & Operations</p>
          <h1 className="text-4xl font-display text-foreground mt-3">创作者平台</h1>
          <p className="text-text-secondary mt-2">用户、认证、赛事、培训与商业任务统一工作台</p>
        </div>
        <div className="flex gap-2">
          {user.role === "admin" && (
            <button type="button" onClick={() => { window.location.hash = "#/admin"; }} className="glass-button">
              管理后台
            </button>
          )}
          <button type="button" onClick={() => void logout()} className="glass-button">
            退出登录
          </button>
        </div>
      </header>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Platform Section Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {sections.map(item => {
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
                    ? "bg-primary text-foreground border-primary shadow-sm"
                    : "glass-panel text-text-secondary hover:text-foreground hover:bg-hover-bg border-glass-border"
                }`}
              >
                <Icon size={14} className={isActive ? "text-foreground" : "text-primary"} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Section View */}
        <div>
          {section === "users" && <UserSettings />}
          {section === "compute" && <ComputeSettings />}
          {section === "skills" && <SkillSettings />}
          {section === "xiangongyun" && <XiangongyunSettings />}
          {section === "agent" && <AgentCenter />}
          {section === "competitions" && <CompetitionSettings />}
          {section === "certification" && <CertificationSettings />}
          {section === "tasks" && <TaskSettings />}
          {section === "academy" && <AcademySettings />}
        </div>
      </div>
    </main>
  );
}

