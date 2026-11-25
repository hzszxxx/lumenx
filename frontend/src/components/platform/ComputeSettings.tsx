"use client";

import { useEffect, useState } from "react";
import { KeyRound, Settings, ShieldCheck, Sparkles, AlertCircle, CheckCircle2, ChevronRight, Coins } from "lucide-react";
import { platformApi } from "@/lib/platformApi";
import { getBillingMode, getCredentialRef, saveComputePreference, type BillingMode } from "@/lib/computePreference";

type Credential = {
  id: string;
  provider: string;
  label: string;
  masked_key: string;
  status: string;
  last_verified_at?: string | null;
};

export default function ComputeSettings({
  onOpenGlobalKeys,
}: {
  onOpenGlobalKeys?: () => void;
} = {}) {
  const [mode, setMode] = useState<BillingMode>(getBillingMode());
  const [credentialRef, setCredentialRef] = useState(getCredentialRef() || "");
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [provider, setProvider] = useState("dashscope");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const refresh = () =>
    Promise.all([platformApi.credentials(), platformApi.creditBalance()])
      .then(([items, wallet]) => {
        setCredentials(items);
        setBalance(wallet.available_credits);
      })
      .catch(() => setMessage("算力配置读取失败"));

  useEffect(() => {
    void refresh();
  }, []);

  const save = () => {
    saveComputePreference(mode, credentialRef || null);
    setMessage("算力来源已保存；下一次生成请求开始生效。");
  };

  const addCredential = async () => {
    if (!apiKey || !label) return;
    try {
      const created = (await platformApi.createCredential({
        provider,
        label,
        api_key: apiKey,
      })) as Credential;
      setApiKey("");
      setLabel("");
      setCredentialRef(created.id);
      setMode("byok");
      await refresh();
      setMessage("API-Key 已加密保存并切换为默认自备凭证。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "API-Key 保存失败");
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. 顶置引导卡片：区分“系统级 API-Key”与“个人自备 Key (BYOK)” */}
      <div className="rounded-2xl border border-primary/35 bg-gradient-to-r from-primary/15 via-primary/10 to-surface-inset p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-semibold">
            <KeyRound size={13} />
            <span>对接大模型 API-Key 完整指引</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-foreground">
            找不到大模型 API-Key 的配置入口？
          </h3>
          <p className="text-xs text-text-secondary leading-relaxed max-w-2xl">
            • <strong className="text-foreground">系统全局 API-Key</strong>：整站默认使用的阿里百炼（DashScope / Qwen / 万相）、MiniMax 开放平台（H3-Image / Image-01）、快手可灵（Kling）、生数科技（Vidu）、MuleRouter（Seedance / GPT-Image-2）以及阿里云 OSS 存储密钥，位于【系统设置】中统一配置。
            <br />
            • <strong className="text-foreground">创作者自备 Key (BYOK)</strong>：如果您希望使用个人账户的 API-Key 自行承担生成调用成本，可在下方【添加自备凭证】中录入。
          </p>
        </div>

        {onOpenGlobalKeys && (
          <button
            type="button"
            onClick={onOpenGlobalKeys}
            className="px-5 py-3 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold hover:bg-primary/90 transition-all shadow-md shrink-0 flex items-center gap-2 cursor-pointer"
          >
            <Settings size={16} />
            <span>打开系统全局密钥 (管理员)</span>
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {message && (
        <div
          role="status"
          className="p-4 rounded-xl border border-primary/40 bg-primary/10 text-sm text-foreground flex items-center justify-between shadow-lg backdrop-blur-md"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-primary shrink-0" />
            <p className="font-medium">{message}</p>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-xs text-text-muted hover:text-foreground px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. 算力来源模式切换 */}
      <div className="glass-panel p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Coins size={18} className="text-amber-400" />
            生成算力扣除偏好
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            在 Studio 漫剧流水线与 Atelier 节点画布提交生成任务时，优先读取此处的扣除策略。
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <button
            type="button"
            className={`rounded-xl border p-4 text-left transition-all ${
              mode === "platform_credits"
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-glass-border hover:border-primary/30 bg-surface/50"
            }`}
            onClick={() => setMode("platform_credits")}
          >
            <div className="flex items-center justify-between mb-1">
              <strong className="text-foreground text-sm">平台官方算力积分池</strong>
              {mode === "platform_credits" && (
                <span className="text-[0.625rem] px-2 py-0.5 rounded bg-primary text-white font-semibold">当前生效</span>
              )}
            </div>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              由平台按统一汇率承担 Provider 调用费用。您当前账户可用余额：
              <span className="font-mono font-bold text-amber-400 ml-1">
                {balance != null ? balance.toLocaleString() : "—"} 算力
              </span>
            </p>
          </button>

          <button
            type="button"
            className={`rounded-xl border p-4 text-left transition-all ${
              mode === "byok"
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-glass-border hover:border-primary/30 bg-surface/50"
            }`}
            onClick={() => setMode("byok")}
          >
            <div className="flex items-center justify-between mb-1">
              <strong className="text-foreground text-sm">我的自备凭证 (BYOK)</strong>
              {mode === "byok" && (
                <span className="text-[0.625rem] px-2 py-0.5 rounded bg-primary text-white font-semibold">当前生效</span>
              )}
            </div>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              使用您自己保存的 MiniMax / 百炼 DashScope / Vidu / Kling 独立凭证，多用户完全隔离，不扣减平台账户算力。
            </p>
          </button>
        </div>

        {mode === "byok" && (
          <div className="pt-2 space-y-2">
            <label className="text-xs text-text-muted font-medium">选择激活的自备 API-Key</label>
            <select
              className="glass-input w-full"
              value={credentialRef}
              onChange={event => setCredentialRef(event.target.value)}
            >
              <option value="">选择已保存的 API-Key 凭证</option>
              {credentials
                .filter(item => item.status === "active")
                .map(item => (
                  <option key={item.id} value={item.id}>
                    {item.label} · {item.provider} · {item.masked_key}
                  </option>
                ))}
            </select>
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            className="bg-primary text-white text-xs px-5 py-2.5 rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-md disabled:opacity-50"
            onClick={save}
            disabled={mode === "byok" && !credentialRef}
          >
            保存算力来源偏好
          </button>
        </div>
      </div>

      {/* 3. 添加创作者自备 API-Key */}
      <div className="glass-panel p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-400" />
            添加创作者自备凭证 (BYOK)
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            API-Key 明文仅在提交时通过加密通道写入服务器凭据库，与您的登录账号严格物理隔离，前端仅展示脱敏指纹，保障个人密钥安全。
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-text-muted mb-1 block">Provider 供应商</label>
            <select
              className="glass-input w-full cursor-pointer"
              value={["dashscope", "minimax", "kling", "vidu", "mulerouter"].includes(provider) ? provider : "custom"}
              onChange={event => {
                const val = event.target.value;
                setProvider(val === "custom" ? "" : val);
              }}
            >
              <option value="minimax">MiniMax 开放平台 (H3-Image / Image-01)</option>
              <option value="dashscope">阿里百炼 (DashScope / 万相 / Qwen)</option>
              <option value="kling">快手可灵 (Kling 视频大模型)</option>
              <option value="vidu">生数科技 (Vidu 视频大模型)</option>
              <option value="mulerouter">MuleRouter (Seedance 2.0 / GPT-Image-2)</option>
              <option value="custom">其他自定义 Provider</option>
            </select>
            {!["dashscope", "minimax", "kling", "vidu", "mulerouter"].includes(provider) && (
              <input
                className="glass-input w-full mt-2"
                placeholder="输入自定义 Provider 名称"
                value={provider}
                onChange={event => setProvider(event.target.value)}
              />
            )}
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">凭证备注名称</label>
            <input
              className="glass-input w-full"
              placeholder={provider === "minimax" ? "例如: 我的个人 MiniMax 密钥" : "例如: 我的专属账号"}
              value={label}
              onChange={event => setLabel(event.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">API-Key 密钥明文</label>
            <input
              className="glass-input w-full font-mono text-xs"
              type="password"
              placeholder={provider === "minimax" ? "eyJhbGciOi..." : "sk-..."}
              value={apiKey}
              onChange={event => setApiKey(event.target.value)}
            />
          </div>
        </div>

        {provider === "minimax" && (
          <div className="text-xs text-text-muted flex items-center gap-1.5 bg-surface-inset/60 p-2.5 rounded-lg border border-glass-border">
            <span className="text-primary font-semibold">MiniMax 独立隔离凭证：</span>
            <span>已支持 H3-Image 旗舰图像模型与 Image-01，调用直接扣减您个人的 MiniMax 账户额度。</span>
            <a
              href="https://platform.minimaxi.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline ml-auto shrink-0"
            >
              前往 MiniMax 控制台获取 Key →
            </a>
          </div>
        )}

        <button
          type="button"
          className="glass-button text-xs font-semibold px-4 py-2 hover:border-primary disabled:opacity-50"
          onClick={() => void addCredential()}
          disabled={!label || !apiKey}
        >
          加密保存此凭证
        </button>

        {credentials.length > 0 && (
          <div className="mt-5 space-y-2 border-t border-glass-border pt-4">
            <h4 className="text-xs font-semibold text-text-secondary">已保存的自备凭证列表</h4>
            {credentials.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between border border-glass-border rounded-xl px-4 py-2.5 text-xs bg-surface/40"
              >
                <div className="flex items-center gap-2 font-mono">
                  <span className="font-semibold text-foreground font-sans">{item.label}</span>
                  <span className="text-text-muted">·</span>
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px]">
                    {item.provider}
                  </span>
                  <span className="text-text-muted">{item.masked_key}</span>
                </div>
                <button
                  type="button"
                  className="text-status-failed-fg hover:underline font-medium text-xs ml-3"
                  onClick={() => void platformApi.revokeCredential(item.id).then(refresh)}
                >
                  撤销
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
