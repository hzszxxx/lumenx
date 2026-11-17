"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  Ban,
  Building2,
  CheckCircle2,
  ClipboardList,
  Edit2,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Search,
  Shield,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  platformApi,
  type AdminOverview,
  type AdminUser,
  type AdminAgentItem,
} from "@/lib/platformApi";
import { usePlatformStore } from "@/store/platformStore";

type Section = "overview" | "users" | "agents" | "invites" | "audit";
type AuditEvent = { id: string; actor_id: string | null; event_type: string; entity_type: string; entity_id: string | null; created_at: string };
type Invite = { id: string; code: string; max_uses: number; used_count: number; expires_at?: string | null; created_at: string; student_note?: string | null; batch_title?: string | null };

const roles = ["user", "creator", "agent", "reviewer", "client", "admin"];
const navItems: Array<{ id: Section; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "运营概览", icon: LayoutDashboard },
  { id: "users", label: "用户与权限", icon: Users },
  { id: "agents", label: "渠道代理管理", icon: Building2 },
  { id: "invites", label: "邀请码管理", icon: KeyRound },
  { id: "audit", label: "审计日志", icon: ClipboardList },
];

export default function AdminConsole() {
  const { user, initialize, login, logout, loading, error } = usePlatformStore();
  const [section, setSection] = useState<Section>("overview");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [agents, setAgents] = useState<AdminAgentItem[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Edit agent modal / state
  const [editingAgent, setEditingAgent] = useState<AdminAgentItem | null>(null);
  const [editDiscountRate, setEditDiscountRate] = useState<string>("1.0");
  const [editCommissionRate, setEditCommissionRate] = useState<string>("0.0");
  const [editStatus, setEditStatus] = useState<string>("active");

  const refresh = async () => {
    const [nextOverview, nextUsers, nextAgents, nextInvites, audit] = await Promise.all([
      platformApi.adminOverview(),
      platformApi.adminUsers({ query }),
      platformApi.adminAgents(),
      platformApi.adminInvites(),
      platformApi.adminAuditEvents(),
    ]);
    setOverview(nextOverview);
    setUsers(nextUsers.items);
    setAgents(nextAgents);
    setInvites(nextInvites);
    setAuditEvents(audit.items);
  };

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (user?.role === "admin") {
      void refresh().catch((value) =>
        setMessage(value instanceof Error ? value.message : "读取管理数据失败")
      );
    }
  }, [user, query]);

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await login(username, password);
      setPassword("");
    } catch {
      /* store exposes the error */
    }
  };

  if (!user) {
    return (
      <main className="min-h-full p-10 bg-background text-foreground">
        <div className="glass-panel max-w-xl mx-auto p-8">
          <p className="font-mono text-xs tracking-[0.28em] text-primary uppercase">LumenX · Admin Console</p>
          <h1 className="text-2xl font-display mt-3">管理员登录</h1>
          <p className="text-text-secondary mt-3">使用平台管理员账户进入独立管理后台。</p>
          <form onSubmit={submitLogin} className="space-y-4 mt-6">
            <input
              className="glass-input w-full"
              placeholder="管理员用户名"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
            <input
              className="glass-input w-full"
              type="password"
              placeholder="管理员密码"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              className="bg-primary rounded-lg px-4 py-3 w-full font-semibold disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "登录中…" : "登录管理后台"}
            </button>
          </form>
          {error && <p role="alert" className="text-sm text-status-failed-fg mt-4">{error}</p>}
        </div>
      </main>
    );
  }

  if (user.role !== "admin") {
    return (
      <main className="min-h-full p-10 bg-background text-foreground">
        <div className="glass-panel max-w-xl mx-auto p-8">
          <h1 className="text-2xl font-display">无权访问</h1>
          <p className="text-text-secondary mt-3">当前账户角色为 {user.role}，管理后台仅限管理员。</p>
        </div>
      </main>
    );
  }

  const updateRole = async (id: string, role: string) => {
    try {
      await platformApi.adminUpdateUser(id, { role });
      setMessage("用户角色已更新");
      await refresh();
    } catch (value) {
      setMessage(value instanceof Error ? value.message : "更新失败");
    }
  };

  const toggleActive = async (item: AdminUser) => {
    try {
      await platformApi.adminUpdateUser(item.id, { is_active: !Boolean(item.is_active) });
      setMessage("用户状态已更新");
      await refresh();
    } catch (value) {
      setMessage(value instanceof Error ? value.message : "更新失败");
    }
  };

  const createInvite = async () => {
    try {
      await platformApi.createAdminInvite({ max_uses: 1 });
      setMessage("邀请码已创建");
      await refresh();
      setSection("invites");
    } catch (value) {
      setMessage(value instanceof Error ? value.message : "邀请码创建失败");
    }
  };

  const handleSaveAgentSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;
    try {
      await platformApi.adminUpdateAgent(editingAgent.id, {
        discount_rate: parseFloat(editDiscountRate) || 1.0,
        commission_rate: parseFloat(editCommissionRate) || 0.0,
        status: editStatus,
      });
      setMessage(`代理商 [${editingAgent.institution_name}] 配置已保存`);
      setEditingAgent(null);
      await refresh();
    } catch (value) {
      setMessage(value instanceof Error ? value.message : "更新代理商失败");
    }
  };

  const cards: Array<[string, number | string, LucideIcon]> = [
    ["用户总数", overview?.users.total ?? "—", Users],
    ["渠道代理", agents.length, Building2],
    ["活跃任务", overview?.tasks.open ?? "—", Activity],
    ["待审提交", overview?.submissions.pending ?? "—", ShieldCheck],
  ];

  return (
    <main className="min-h-full bg-background text-foreground">
      <div className="min-h-screen grid lg:grid-cols-[248px_1fr]">
        <aside className="border-r border-glass-border bg-surface/70 p-4 flex flex-col">
          <div className="px-3 py-4 mb-5">
            <p className="font-mono text-xs tracking-[0.28em] text-primary uppercase">LumenX</p>
            <h1 className="text-xl font-display mt-2">管理后台</h1>
            <p className="text-xs text-text-muted mt-1">Admin Console</p>
          </div>
          <nav aria-label="管理后台主导航" className="space-y-1">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                aria-current={section === id ? "page" : undefined}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                  section === id ? "bg-primary/15 text-foreground" : "text-text-secondary hover:bg-hover-bg"
                }`}
              >
                <Icon size={17} className={section === id ? "text-primary" : "text-text-muted"} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="mt-auto space-y-2 pt-6">
            <button
              type="button"
              className="w-full glass-button justify-start"
              onClick={() => {
                window.location.href = "/#/platform";
              }}
            >
              <Users size={16} />返回平台
            </button>
            <button type="button" className="w-full glass-button justify-start" onClick={() => void logout()}>
              <LogOut size={16} />退出登录
            </button>
          </div>
        </aside>

        <section className="p-6 md:p-10">
          <header className="max-w-7xl mx-auto mb-8">
            <p className="font-mono text-xs tracking-[0.28em] text-primary uppercase">Platform Operations</p>
            <div className="flex flex-wrap items-end justify-between gap-4 mt-3">
              <div>
                <h2 className="text-4xl font-display">{navItems.find((item) => item.id === section)?.label}</h2>
                <p className="text-text-secondary mt-2">管理员：{user.username} · 平台运营控制面板</p>
              </div>
              {message && <p role="status" className="text-sm text-status-success-fg">{message}</p>}
            </div>
          </header>

          <div className="max-w-7xl mx-auto space-y-6">
            {section === "overview" && (
              <>
                <div className="grid md:grid-cols-4 gap-4">
                  {cards.map(([label, value, Icon]) => (
                    <div className="glass-panel p-5" key={label}>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">{label}</span>
                        <Icon size={18} className="text-primary" />
                      </div>
                      <p className="text-3xl font-mono mt-3">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="glass-panel p-6">
                  <h3 className="text-xl font-semibold">管理入口</h3>
                  <p className="text-text-secondary mt-2">
                    从左侧导航进入用户权限、渠道代理商、邀请码和审计模块。
                  </p>
                </div>
              </>
            )}

            {section === "users" && (
              <section className="glass-panel p-6">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">用户与权限</h3>
                    <p className="text-sm text-text-secondary mt-1">角色和启停状态变更会写入审计日志。</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-3 text-text-muted" />
                      <input
                        className="glass-input pl-9"
                        placeholder="搜索用户名或邮箱"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </div>
                    <button className="glass-button" onClick={() => void createInvite()}>
                      <KeyRound size={16} />生成邀请码
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto mt-5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-text-muted border-b border-glass-border">
                        <th className="py-3">用户</th>
                        <th>角色</th>
                        <th>状态</th>
                        <th>创建时间</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((item) => (
                        <tr key={item.id} className="border-b border-glass-border">
                          <td className="py-3">
                            <div className="font-semibold text-foreground">{item.username}</div>
                            <div className="text-xs text-text-muted">{item.email || "无邮箱"}</div>
                          </td>
                          <td>
                            <select
                              className="glass-input py-1 text-xs"
                              value={item.role}
                              onChange={(event) => void updateRole(item.id, event.target.value)}
                            >
                              {roles.map((role) => (
                                <option key={role} value={role}>
                                  {role === "agent" ? "agent (代理商)" : role}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {Boolean(item.is_active) ? (
                              <span className="text-status-success-fg">正常</span>
                            ) : (
                              <span className="text-status-failed-fg">已停用</span>
                            )}
                          </td>
                          <td className="text-text-secondary">{new Date(item.created_at).toLocaleString()}</td>
                          <td>
                            <button className="text-primary hover:underline text-xs" onClick={() => void toggleActive(item)}>
                              {Boolean(item.is_active) ? (
                                <>
                                  <Ban size={13} className="inline mr-1" />停用
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={13} className="inline mr-1" />启用
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {section === "agents" && (
              <section className="glass-panel p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">渠道代理商与培训机构管理</h3>
                    <p className="text-sm text-text-secondary mt-1">
                      审核代理资格、配置批发折扣与分成比例，监控各代理商分发出码与学员激活情况。
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-text-muted border-b border-glass-border">
                        <th className="py-3">机构名称 / 代理用户</th>
                        <th>代理类型</th>
                        <th>负责人 / 电话</th>
                        <th>批采折扣</th>
                        <th>采购批次</th>
                        <th>总出码 / 已激活</th>
                        <th>学员数</th>
                        <th>状态</th>
                        <th className="text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-glass-border">
                      {agents.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-text-muted">
                            暂无代理商记录。可在「用户与权限」中将用户角色设置为 agent。
                          </td>
                        </tr>
                      ) : (
                        agents.map((ag) => (
                          <tr key={ag.id} className="hover:bg-hover-bg transition">
                            <td className="py-3">
                              <div className="font-semibold text-foreground">{ag.institution_name || ag.username}</div>
                              <div className="text-[11px] text-text-muted">账号: {ag.username}</div>
                            </td>
                            <td>
                              <span className="inline-flex px-2 py-0.5 rounded text-[11px] bg-primary/10 text-primary border border-primary/20">
                                {ag.agency_type === "institution" ? "培训机构" : "个人代理"}
                              </span>
                            </td>
                            <td className="text-text-secondary">
                              <div>{ag.contact_name || "—"}</div>
                              <div className="text-[10px] text-text-muted">{ag.contact_phone || "—"}</div>
                            </td>
                            <td>
                              <span className="font-mono font-semibold text-foreground">
                                {ag.discount_rate < 1.0 ? `${(ag.discount_rate * 10).toFixed(1)} 折` : "无折扣"}
                              </span>
                            </td>
                            <td className="font-mono">{ag.total_batches} 批</td>
                            <td className="font-mono">
                              {ag.total_invites} / <span className="text-status-success-fg">{ag.used_invites}</span>
                            </td>
                            <td className="font-mono text-status-success-fg font-semibold">{ag.total_students} 人</td>
                            <td>
                              {ag.status === "active" ? (
                                <span className="text-status-success-fg">正常合作</span>
                              ) : (
                                <span className="text-text-muted">{ag.status}</span>
                              )}
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAgent(ag);
                                  setEditDiscountRate(String(ag.discount_rate ?? 1.0));
                                  setEditCommissionRate(String(ag.commission_rate ?? 0.0));
                                  setEditStatus(ag.status ?? "active");
                                }}
                                className="glass-button text-xs py-1 px-2.5 inline-flex items-center gap-1 text-primary"
                              >
                                <Edit2 size={12} />
                                设置折扣
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Edit Agent Modal */}
                {editingAgent && (
                  <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-panel w-full max-w-md p-6 border-glass-border space-y-4 shadow-2xl">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-foreground">
                          配置代理商：{editingAgent.institution_name}
                        </h4>
                        <button
                          type="button"
                          onClick={() => setEditingAgent(null)}
                          className="text-text-muted hover:text-foreground text-sm"
                        >
                          ✕
                        </button>
                      </div>

                      <form onSubmit={handleSaveAgentSettings} className="space-y-4">
                        <div>
                          <label className="text-xs text-text-secondary block mb-1">
                            批采折扣率 (0.1 ~ 1.0，如 0.8 表示 8 折)
                          </label>
                          <input
                            type="number"
                            step="0.05"
                            min="0.1"
                            max="1.0"
                            className="glass-input w-full text-sm"
                            value={editDiscountRate}
                            onChange={(e) => setEditDiscountRate(e.target.value)}
                            required
                          />
                        </div>

                        <div>
                          <label className="text-xs text-text-secondary block mb-1">合作状态</label>
                          <select
                            className="glass-input w-full text-xs"
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                          >
                            <option value="active">正常合作 (active)</option>
                            <option value="pending">待审核 (pending)</option>
                            <option value="disabled">暂停合作 (disabled)</option>
                          </select>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setEditingAgent(null)}
                            className="glass-button text-xs py-2 px-4"
                          >
                            取消
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-foreground hover:bg-primary/90"
                          >
                            保存配置
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </section>
            )}

            {section === "invites" && (
              <section className="glass-panel p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">邀请码管理</h3>
                    <p className="text-sm text-text-secondary mt-1">创建和查看平台一次性或限次邀请码与代理码。</p>
                  </div>
                  <button className="glass-button" onClick={() => void createInvite()}>
                    <KeyRound size={16} />生成邀请码
                  </button>
                </div>
                <div className="overflow-x-auto mt-5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-text-muted border-b border-glass-border">
                        <th className="py-3">邀请码</th>
                        <th>备注/班级</th>
                        <th>使用次数</th>
                        <th>过期时间</th>
                        <th>创建时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map((item) => (
                        <tr key={item.id} className="border-b border-glass-border">
                          <td className="py-3 font-mono font-semibold text-foreground">{item.code}</td>
                          <td className="text-xs text-text-secondary">
                            {item.student_note || item.batch_title || "—"}
                          </td>
                          <td>
                            {item.used_count} / {item.max_uses}
                          </td>
                          <td className="text-text-secondary">{item.expires_at ? new Date(item.expires_at).toLocaleDateString() : "不设过期"}</td>
                          <td className="text-text-secondary">{new Date(item.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {section === "audit" && (
              <section className="glass-panel p-6">
                <div className="flex items-center gap-3">
                  <ClipboardList className="text-primary" />
                  <div>
                    <h3 className="text-xl font-semibold">审计日志</h3>
                    <p className="text-sm text-text-secondary mt-1">记录管理员和平台业务状态变化。</p>
                  </div>
                </div>
                <div className="overflow-x-auto mt-5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-text-muted border-b border-glass-border">
                        <th className="py-3">时间</th>
                        <th>事件</th>
                        <th>实体</th>
                        <th>操作者</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditEvents.map((item) => (
                        <tr key={item.id} className="border-b border-glass-border">
                          <td className="py-3 text-text-secondary">{new Date(item.created_at).toLocaleString()}</td>
                          <td>{item.event_type}</td>
                          <td>
                            {item.entity_type} {item.entity_id ? `· ${item.entity_id.slice(0, 8)}` : ""}
                          </td>
                          <td className="text-text-secondary">{item.actor_id ? item.actor_id.slice(0, 8) : "系统"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
