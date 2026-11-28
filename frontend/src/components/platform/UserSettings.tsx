"use client";

import { useEffect, useState, type FormEvent } from "react";
import { UserRound, Shield, Coins, Activity, LogOut, LayoutDashboard, KeyRound, CheckCircle2, Phone, Mail, Edit3, X, AlertCircle } from "lucide-react";
import { usePlatformStore } from "@/store/platformStore";
import { platformApi, type AgentProfile } from "@/lib/platformApi";

export default function UserSettings() {
  const { user, walletCents, logout, setUser } = usePlatformStore();
  const [tokenUsage, setTokenUsage] = useState<{ prompt_tokens: number; completion_tokens: number; total_tokens: number; records: any[] } | null>(null);
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void platformApi.tokenUsage(20).then(setTokenUsage).catch(() => null);
    void platformApi.agentProfile().then((p) => {
      setProfile(p);
      setPhoneInput(p.contact_phone || "");
      setNameInput(p.contact_name || "");
    }).catch(() => null);
  }, []);

  const handleSavePhone = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPhone(true);
    setErrorMessage(null);
    try {
      const updated = await platformApi.updateAgentProfile({
        agency_type: profile?.agency_type || "individual",
        institution_name: profile?.institution_name || "",
        contact_name: nameInput.trim() || user?.username,
        contact_phone: phoneInput.trim(),
        notes: profile?.notes || "",
      });
      setProfile(updated);
      setShowPhoneModal(false);
      setMessage("联系电话已更新成功");
      setTimeout(() => setMessage(null), 3500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "保存电话失败，请重试");
    } finally {
      setSavingPhone(false);
    }
  };

  const handleSaveEmail = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = emailInput.trim();
    if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setErrorMessage("请输入有效的电子邮箱格式");
      return;
    }
    setSavingEmail(true);
    setErrorMessage(null);
    try {
      const updatedUser = await platformApi.updateProfile({ email: trimmed });
      setUser(user ? { ...user, email: updatedUser.email } : updatedUser);
      setShowEmailModal(false);
      setMessage("电子邮箱已绑定更新成功");
      setTimeout(() => setMessage(null), 3500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "绑定邮箱失败，请重试");
    } finally {
      setSavingEmail(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      {message && (
        <div role="status" className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </div>
      )}

      {/* User Info Card */}
      <div className="glass-panel p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center border border-primary/20">
              <UserRound size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-foreground">{user.username}</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                  {user.role === "admin" ? "系统管理员" : user.role === "agent" ? "渠道代理商" : user.role === "creator" ? "认证创作者" : user.role === "reviewer" ? "审核验收员" : user.role === "client" ? "商单发包方" : "普通用户"}
                </span>
              </div>
              <div className="text-xs text-text-secondary mt-1 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <span className={user.email ? "text-foreground" : "text-amber-500 font-medium"}>
                    {user.email || "未绑定邮箱"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailInput(user.email || "");
                      setErrorMessage(null);
                      setShowEmailModal(true);
                    }}
                    className="text-primary hover:underline ml-0.5 inline-flex items-center gap-0.5 font-medium cursor-pointer"
                  >
                    <Edit3 size={11} />
                    {user.email ? "修改邮箱" : "绑定邮箱"}
                  </button>
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  联系电话：
                  <span className={profile?.contact_phone ? "text-foreground font-mono font-medium" : "text-amber-500 font-medium"}>
                    {profile?.contact_phone || "未设置"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneInput(profile?.contact_phone || "");
                      setNameInput(profile?.contact_name || user.username);
                      setShowPhoneModal(true);
                    }}
                    className="text-primary hover:underline ml-0.5 inline-flex items-center gap-0.5 font-medium cursor-pointer"
                  >
                    <Edit3 size={11} />
                    {profile?.contact_phone ? "修改" : "点击设置"}
                  </button>
                </span>
                <span>·</span>
                <span>创作者平台统一账户</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPhoneInput(profile?.contact_phone || "");
                setNameInput(profile?.contact_name || user.username);
                setShowPhoneModal(true);
              }}
              className="glass-button text-xs font-medium text-foreground hover:border-primary/50 flex items-center gap-1.5"
            >
              <Phone size={13} className="text-primary" />
              {profile?.contact_phone ? "修改联系电话" : "设置联系电话"}
            </button>
            {user.role === "admin" && (
              <button
                type="button"
                onClick={() => { window.location.hash = "#/admin"; }}
                className="bg-primary text-white text-xs px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition-opacity flex items-center gap-1.5 shadow-sm"
              >
                <LayoutDashboard size={14} />
                进入管理后台
              </button>
            )}
            <button
              type="button"
              onClick={() => void logout()}
              className="glass-button text-xs font-medium text-status-failed-fg hover:border-red-500/40"
            >
              <LogOut size={14} />
              退出当前账号
            </button>
          </div>
        </div>
      </div>

      {/* Wallet & Quota Breakdown */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="glass-panel p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">模拟账本可用余额</span>
            <Coins size={16} className="text-primary" />
          </div>
          <p className="text-3xl font-mono font-bold text-primary mt-2">
            ¥{(walletCents / 100).toFixed(2)}
          </p>
          <p className="text-[0.6875rem] text-text-muted mt-2">
            用于接单押金、商业结算及平台积分自动充正
          </p>
        </div>

        <div className="glass-panel p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">累计消耗算力 Tokens</span>
            <Activity size={16} className="text-emerald-400" />
          </div>
          <p className="text-3xl font-mono font-bold text-foreground mt-2">
            {tokenUsage?.total_tokens ? tokenUsage.total_tokens.toLocaleString() : "0"}
          </p>
          <p className="text-[0.6875rem] text-text-muted mt-2 font-mono">
            Prompt: {tokenUsage?.prompt_tokens ?? 0} · Completion: {tokenUsage?.completion_tokens ?? 0}
          </p>
        </div>

        <div className="glass-panel p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">平台权限与特权</span>
            <Shield size={16} className="text-amber-400" />
          </div>
          <p className="text-3xl font-display text-foreground mt-2">
            {user.role === "admin" ? "超管权限" : user.role === "creator" ? "认证创作者" : "标准用户"}
          </p>
          <p className="text-[0.6875rem] text-text-muted mt-2">
            {user.role === "admin" ? "拥有全部技能分发与用户运营权限" : "可通过创作者认证升级为商业签约导演"}
          </p>
        </div>
      </div>

      {/* Token Ledger Detail */}
      <div className="glass-panel p-6 space-y-4">
        <h3 className="text-base font-semibold text-foreground">最近算力调度与消耗明细</h3>
        {tokenUsage?.records && tokenUsage.records.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-glass-border text-left text-text-muted">
                  <th className="py-2.5">时间</th>
                  <th>模型</th>
                  <th>类型</th>
                  <th>Prompt Tokens</th>
                  <th>Completion Tokens</th>
                  <th>总计</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border/40 font-mono">
                {tokenUsage.records.map((r, i) => (
                  <tr key={i} className="hover:bg-hover-bg/30">
                    <td className="py-2 text-text-secondary">{new Date(r.created_at || Date.now()).toLocaleTimeString()}</td>
                    <td className="text-foreground">{r.model || "qwen-max"}</td>
                    <td>{r.product || "atelier"}</td>
                    <td>{r.prompt_tokens || 0}</td>
                    <td>{r.completion_tokens || 0}</td>
                    <td className="text-primary font-bold">{r.total_tokens || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-text-muted py-2">暂无消耗记录</p>
        )}
      </div>

      {/* Edit Phone Modal */}
      {showPhoneModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-md animate-fade-in"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-glass-border bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-glass-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Phone size={16} />
                </div>
                <h3 className="text-base font-bold text-foreground">填写与修改联系电话</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPhoneModal(false)}
                className="text-text-muted hover:text-foreground p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {errorMessage && (
              <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSavePhone} className="space-y-4">
              <div>
                <label className="text-xs text-text-secondary mb-1 block font-medium">称呼 / 姓名</label>
                <input
                  type="text"
                  className="glass-input w-full text-sm"
                  placeholder="请输入您的称呼"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs text-text-secondary mb-1 block font-medium">联系电话 / 手机号</label>
                <input
                  type="tel"
                  required
                  autoFocus
                  className="glass-input w-full text-sm"
                  placeholder="例如：13800000000"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                />
                <p className="text-[11px] text-text-muted mt-1">用于平台商单签约通知、赏金结算核对与紧急联络</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-glass-border">
                <button
                  type="button"
                  onClick={() => setShowPhoneModal(false)}
                  className="glass-button text-xs py-2 px-3"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={savingPhone}
                  className="bg-primary text-white text-xs px-4 py-2 rounded-xl font-semibold hover:bg-primary-hover transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {savingPhone ? "保存中..." : "保存联系电话"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Email Modal */}
      {showEmailModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-md animate-fade-in"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-glass-border bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-glass-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Mail size={16} />
                </div>
                <h3 className="text-base font-bold text-foreground">{user.email ? "修改绑定邮箱" : "绑定电子邮箱"}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="text-text-muted hover:text-foreground p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {errorMessage && (
              <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveEmail} className="space-y-4">
              <div>
                <label className="text-xs text-text-secondary mb-1 block font-medium">电子邮箱地址</label>
                <input
                  type="email"
                  required
                  autoFocus
                  className="glass-input w-full text-sm"
                  placeholder="例如：creator@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
                <p className="text-[11px] text-text-muted mt-1">用于接收账户安全提醒、商单签约回执及结算通知</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-glass-border">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="glass-button text-xs py-2 px-3"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={savingEmail}
                  className="bg-primary text-white text-xs px-4 py-2 rounded-xl font-semibold hover:bg-primary-hover transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {savingEmail ? "保存中..." : "保存邮箱"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
