"use client";

import { useState, type FormEvent } from "react";
import { LogIn, UserPlus, X, Sparkles } from "lucide-react";
import { usePlatformStore } from "@/store/platformStore";
import LumenXBranding from "@/components/layout/LumenXBranding";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  onSuccess?: () => void;
}

export default function AuthModal({
  isOpen,
  onClose,
  title,
  description,
  onSuccess,
}: AuthModalProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const { login, register, loading, error: storeError, devLogin } = usePlatformStore();

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      if (isRegister) {
        await register(username, password, email || undefined, inviteCode || undefined);
      } else {
        await login(username, password);
      }
      setPassword("");
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "登录或注册失败，请检查账号密码");
    }
  };

  const currentError = localError || storeError;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-glass-border bg-surface p-6 sm:p-8 shadow-2xl">
        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="absolute right-4 top-4 p-1 rounded-lg text-text-muted hover:text-foreground hover:bg-hover-bg transition-colors"
        >
          <X size={20} />
        </button>

        {/* 品牌与标题 */}
        <div className="mb-6 flex flex-col items-center text-center">
          <LumenXBranding size="sm" showSlogan={false} />
          <h2 className="mt-4 text-xl font-bold text-foreground">
            {title || (isRegister ? "注册创作者账号" : "登录影伴平台")}
          </h2>
          <p className="mt-1 text-xs text-text-secondary">
            {description || (isRegister ? "创建您的独立创作者身份，开启 AI 漫影创作之旅" : "登录后即可开始创作、提交认证或认领任务")}
          </p>
        </div>

        {/* 错误提示 */}
        {currentError && (
          <div role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-200">
            {currentError}
          </div>
        )}

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">用户名</label>
            <input
              type="text"
              required
              autoFocus
              className="glass-input w-full text-sm text-foreground placeholder:text-text-muted"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">密码</label>
            <input
              type="password"
              required
              className="glass-input w-full text-sm text-foreground placeholder:text-text-muted"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {isRegister && (
            <>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">电子邮箱（选填）</label>
                <input
                  type="email"
                  className="glass-input w-full text-sm text-foreground placeholder:text-text-muted"
                  placeholder="用于找回凭据"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">邀请码（选填）</label>
                <input
                  type="text"
                  className="glass-input w-full text-sm text-foreground placeholder:text-text-muted"
                  placeholder="如有内测邀请码请输入"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 rounded-xl bg-primary py-2.5 px-4 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="inline-block animate-spin mr-1">⏳</span>
            ) : isRegister ? (
              <UserPlus size={16} />
            ) : (
              <LogIn size={16} />
            )}
            <span>{loading ? "处理中…" : isRegister ? "立即注册并登录" : "登录"}</span>
          </button>
        </form>

        {/* 底部切换模式 */}
        <div className="mt-5 text-center text-xs text-text-secondary border-t border-glass-border pt-4">
          {isRegister ? (
            <span>
              已有账号？{" "}
              <button
                type="button"
                onClick={() => { setIsRegister(false); setLocalError(null); }}
                className="text-primary font-medium hover:underline ml-1"
              >
                直接登录
              </button>
            </span>
          ) : (
            <span>
              还没有账号？{" "}
              <button
                type="button"
                onClick={() => { setIsRegister(true); setLocalError(null); }}
                className="text-primary font-medium hover:underline ml-1"
              >
                免费注册
              </button>
            </span>
          )}
        </div>

        {/* 本地开发模式快捷免密通道（仅在开发模式生效，便于 T3 内置预览及自动化验收） */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-4 pt-3 border-t border-dashed border-amber-500/30 bg-amber-500/5 rounded-xl p-3 text-center">
            <div className="text-[11px] font-medium text-amber-500 flex items-center justify-center gap-1 mb-2">
              <Sparkles size={12} /> 本地开发快捷免密登录
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (devLogin) await devLogin("admin");
                  onSuccess?.();
                  onClose();
                }}
                className="flex-1 py-1.5 px-2 text-xs rounded-lg bg-surface hover:bg-hover-bg border border-glass-border text-foreground hover:border-primary/50 transition-colors"
              >
                管理员 (Admin)
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (devLogin) await devLogin("creator");
                  onSuccess?.();
                  onClose();
                }}
                className="flex-1 py-1.5 px-2 text-xs rounded-lg bg-surface hover:bg-hover-bg border border-glass-border text-foreground hover:border-primary/50 transition-colors"
              >
                创作者 (Creator)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
