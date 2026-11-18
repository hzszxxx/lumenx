"use client";

import { useEffect, useState } from "react";
import { UserRound, Shield, Coins, Activity, LogOut, LayoutDashboard, KeyRound, CheckCircle2 } from "lucide-react";
import { usePlatformStore } from "@/store/platformStore";
import { platformApi } from "@/lib/platformApi";

export default function UserSettings() {
  const { user, walletCents, logout } = usePlatformStore();
  const [tokenUsage, setTokenUsage] = useState<{ prompt_tokens: number; completion_tokens: number; total_tokens: number; records: any[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void platformApi.tokenUsage(20).then(setTokenUsage).catch(() => null);
  }, []);

  if (!user) return null;

  return (
    <div className="space-y-6">
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
              <p className="text-xs text-text-secondary mt-1">
                {user.email || "未绑定邮箱"} · 创作者平台统一账户
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user.role === "admin" && (
              <button
                type="button"
                onClick={() => { window.location.hash = "#/admin"; }}
                className="bg-primary text-foreground text-xs px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm"
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
    </div>
  );
}
