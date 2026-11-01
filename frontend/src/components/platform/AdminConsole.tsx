"use client";

import { useEffect, useState } from "react";
import { Activity, Ban, CheckCircle2, KeyRound, Shield, Users, type LucideIcon } from "lucide-react";
import { platformApi, type AdminOverview, type AdminUser } from "@/lib/platformApi";
import { usePlatformStore } from "@/store/platformStore";

const roles = ["user", "creator", "reviewer", "client", "admin"];

export default function AdminConsole() {
  const { user, initialize, logout } = usePlatformStore();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [auditCount, setAuditCount] = useState(0);
  const [invite, setInvite] = useState<string | null>(null);

  const refresh = async () => {
    const [nextOverview, nextUsers, audit] = await Promise.all([
      platformApi.adminOverview(), platformApi.adminUsers({ query }), platformApi.adminAuditEvents(),
    ]);
    setOverview(nextOverview); setUsers(nextUsers.items); setAuditCount(audit.total);
  };

  useEffect(() => { void initialize(); }, [initialize]);
  useEffect(() => { if (user?.role === "admin") void refresh().catch(error => setMessage(error instanceof Error ? error.message : "读取管理数据失败")); }, [user, query]);

  if (!user) return <main className="min-h-full p-10 bg-background text-foreground"><div className="glass-panel max-w-xl mx-auto p-8"><h1 className="text-2xl font-display">管理后台</h1><p className="text-text-secondary mt-3">请先在创作者平台登录管理员账户。</p><button className="bg-primary rounded-lg px-4 py-2 mt-6" onClick={() => { window.location.hash = "#/platform"; }}>进入平台登录</button></div></main>;
  if (user.role !== "admin") return <main className="min-h-full p-10 bg-background text-foreground"><div className="glass-panel max-w-xl mx-auto p-8"><h1 className="text-2xl font-display">无权访问</h1><p className="text-text-secondary mt-3">当前账户角色为 {user.role}，管理后台仅限管理员。</p></div></main>;

  const updateRole = async (id: string, role: string) => { try { await platformApi.adminUpdateUser(id, { role }); setMessage("用户角色已更新"); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "更新失败"); } };
  const toggleActive = async (item: AdminUser) => { try { await platformApi.adminUpdateUser(item.id, { is_active: !Boolean(item.is_active) }); setMessage("用户状态已更新"); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "更新失败"); } };
  const createInvite = async () => { try { const result = await platformApi.createAdminInvite({ max_uses: 1 }); setInvite((result as { code: string }).code); setMessage("邀请码已创建"); } catch (error) { setMessage(error instanceof Error ? error.message : "邀请码创建失败"); } };

  const cards: Array<[string, number | string, LucideIcon]> = [["用户", overview?.users.total ?? "—", Users], ["活跃任务", overview?.tasks.open ?? "—", Activity], ["待审提交", overview?.submissions.pending ?? "—", CheckCircle2], ["审计事件", auditCount, Shield]];
  return <main className="min-h-full p-6 md:p-10 bg-background text-foreground"><header className="max-w-7xl mx-auto flex items-start justify-between gap-4 mb-8"><div><p className="font-mono text-xs tracking-[0.28em] text-primary uppercase">LumenX · Admin Console</p><h1 className="text-4xl font-display mt-3">管理后台</h1><p className="text-text-secondary mt-2">平台账户、业务状态与审计操作集中管理</p></div><div className="flex gap-2"><button className="glass-button" onClick={() => { window.location.hash = "#/platform"; }}>返回平台</button><button className="glass-button" onClick={() => void logout()}>退出登录</button></div></header><div className="max-w-7xl mx-auto space-y-6"><div className="grid md:grid-cols-4 gap-4">{cards.map(([label, value, Icon]) => <div className="glass-panel p-5" key={label}><div className="flex justify-between"><span className="text-text-secondary">{label}</span><Icon size={18} className="text-primary" /></div><p className="text-3xl font-mono mt-3">{value}</p></div>)}</div><section className="glass-panel p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">用户与权限</h2><p className="text-sm text-text-secondary mt-1">修改角色和启停状态会写入审计日志。</p></div><div className="flex gap-2"><input className="glass-input" placeholder="搜索用户名或邮箱" value={query} onChange={event => setQuery(event.target.value)} /><button className="glass-button" onClick={() => void createInvite()}><KeyRound size={16} />生成邀请码</button></div></div>{invite && <p className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-3 font-mono">新邀请码：{invite}</p>}<div className="overflow-x-auto mt-5"><table className="w-full text-sm"><thead><tr className="text-left text-text-muted border-b border-glass-border"><th className="py-3">用户</th><th>角色</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>{users.map(item => <tr key={item.id} className="border-b border-glass-border"><td className="py-3"><div>{item.username}</div><div className="text-xs text-text-muted">{item.email || "无邮箱"}</div></td><td><select className="glass-input py-1" value={item.role} onChange={event => void updateRole(item.id, event.target.value)}>{roles.map(role => <option key={role}>{role}</option>)}</select></td><td>{Boolean(item.is_active) ? <span className="text-status-success-fg">正常</span> : <span className="text-status-failed-fg">已停用</span>}</td><td className="text-text-secondary">{new Date(item.created_at).toLocaleString()}</td><td><button className="text-primary" onClick={() => void toggleActive(item)}>{Boolean(item.is_active) ? <><Ban size={15} className="inline mr-1" />停用</> : <><CheckCircle2 size={15} className="inline mr-1" />启用</>}</button></td></tr>)}</tbody></table></div></section>{message && <p role="status" className="text-sm text-text-secondary">{message}</p>}</div></main>;
}
