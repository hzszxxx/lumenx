"use client";

import { useEffect, useState } from "react";
import { KeyRound, Save, Loader2, CheckCircle2, ShieldCheck, Cpu, Sparkles, ExternalLink, Eye, EyeOff, Film, Video, Database } from "lucide-react";
import { api, type EnvConfigPayload, type ProviderMode } from "@/lib/api";

export default function ApiKeySettings() {
  const [config, setConfig] = useState<EnvConfigPayload>({
    DASHSCOPE_API_KEY: "",
    MULEROUTER_API_KEY: "",
    MINIMAX_API_KEY: "",
    VIDU_API_KEY: "",
    KLING_ACCESS_KEY: "",
    KLING_SECRET_KEY: "",
    KLING_PROVIDER_MODE: "dashscope",
    VIDU_PROVIDER_MODE: "dashscope",
    OSS_ENABLE: true,
    OSS_BUCKET_NAME: "",
    OSS_ENDPOINT: "",
    OSS_BASE_PATH: "",
    ALIBABA_CLOUD_ACCESS_KEY_ID: "",
    ALIBABA_CLOUD_ACCESS_KEY_SECRET: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});

  const toggleVisibility = (field: string) => {
    setVisibleFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const loadConfig = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await api.getEnvConfig();
      setConfig((prev) => ({
        ...prev,
        ...data,
      }));
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "获取服务端大模型配置失败，请确认后端服务运行状态。",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  const handleChange = (key: string, value: string | boolean | undefined) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.saveEnvConfig(config);
      setMessage({
        text: "大模型 API-Key 与服务配置已成功保存！后端模型路由已即刻热重载生效。",
        type: "success",
      });
      // 重新读取以获取最新的掩码与配置状态
      await loadConfig();
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "保存配置失败，请检查网络或配置项。",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const secrets = config.secrets_configured || {};
  const hasDashScope = Boolean(secrets.DASHSCOPE_API_KEY || (typeof config.DASHSCOPE_API_KEY === "string" && config.DASHSCOPE_API_KEY.trim()));
  const hasMuleRouter = Boolean(secrets.MULEROUTER_API_KEY || (typeof config.MULEROUTER_API_KEY === "string" && config.MULEROUTER_API_KEY.trim()));
  const hasMiniMax = Boolean(secrets.MINIMAX_API_KEY || (typeof config.MINIMAX_API_KEY === "string" && config.MINIMAX_API_KEY.trim()));

  return (
    <div className="space-y-6">
      {/* 顶部标题与说明卡片 */}
      <div className="glass-panel p-6 sm:p-7 rounded-2xl border-glass-border/80 bg-surface/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/15 text-primary">
              <Cpu size={26} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">大模型 API-Key 配置中枢</h2>
              <p className="text-xs text-text-secondary mt-1">
                统一配置服务端的百炼大模型、Seedance 2.0、可灵、Vidu 与对象存储密钥。配置后全站 Studio 漫剧工坊与 Atelier 画布自动调用。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadConfig()}
              disabled={loading}
              className="glass-button text-xs font-medium"
            >
              刷新配置
            </button>
            <button
              type="button"
              onClick={() => { window.location.hash = "#/settings"; }}
              className="glass-button text-xs font-medium !border-primary/40 text-primary hover:!bg-primary/10"
            >
              系统完整设置
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div
          role="status"
          className={`p-4 rounded-xl border flex items-center justify-between shadow-lg backdrop-blur-md text-sm ${
            message.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-status-failed-border bg-status-failed-bg text-status-failed-fg"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="shrink-0 text-primary" />
            <p className="font-medium">{message.text}</p>
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

      {loading ? (
        <div className="glass-panel p-16 text-center text-text-muted flex flex-col items-center justify-center gap-3">
          <Loader2 size={26} className="animate-spin text-primary" />
          <span className="text-sm font-medium">正在读取服务端 API-Key 状态…</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* 1. 阿里百炼 DashScope 核心配置 */}
          <div className="glass-panel p-6 sm:p-7 rounded-2xl border-glass-border/80 bg-surface/60 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold text-xs">
                  QS
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    阿里云百炼 · DashScope API-Key（核心主干）
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    驱动通义千问大模型（剧本分析、分镜编排、对白润色）、通义万相 Wanx 2.1/2.6 分镜图及 Qwen-VL 多模态视觉理解。
                  </p>
                </div>
              </div>

              <span
                className={`text-xs px-2.5 py-0.5 rounded-md border font-semibold ${
                  hasDashScope
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                }`}
              >
                {hasDashScope ? "已配置生效" : "尚未配置"}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="text-text-muted font-medium font-mono">DASHSCOPE_API_KEY</label>
                <a
                  href="https://bailian.console.aliyun.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  前往百炼控制台获取密钥 <ExternalLink size={11} />
                </a>
              </div>
              <div className="relative">
                <input
                  type={visibleFields.DASHSCOPE_API_KEY ? "text" : "password"}
                  className="glass-input w-full pr-10 font-mono text-xs"
                  placeholder="sk-..."
                  value={config.DASHSCOPE_API_KEY || ""}
                  onChange={(e) => handleChange("DASHSCOPE_API_KEY", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => toggleVisibility("DASHSCOPE_API_KEY")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground"
                >
                  {visibleFields.DASHSCOPE_API_KEY ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          {/* 2. 字节跳动 Seedance 2.0 / MuleRouter */}
          <div className="glass-panel p-6 sm:p-7 rounded-2xl border-glass-border/80 bg-surface/60 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  SD
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    字节跳动 Seedance 2.0 · MuleRouter API-Key
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    驱动极具电影质感的 Seedance 2.0 视频生成模型及 GPT-Image-2 高写实风格分镜图生成。
                  </p>
                </div>
              </div>

              <span
                className={`text-xs px-2.5 py-0.5 rounded-md border font-semibold ${
                  hasMuleRouter
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-surface-inset border-glass-border text-text-muted"
                }`}
              >
                {hasMuleRouter ? "已配置生效" : "选填 (未配置)"}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="text-text-muted font-medium font-mono">MULEROUTER_API_KEY</label>
                <span className="text-text-muted">支持标准 Bearer Token 或 MuleRouter 凭证</span>
              </div>
              <div className="relative">
                <input
                  type={visibleFields.MULEROUTER_API_KEY ? "text" : "password"}
                  className="glass-input w-full pr-10 font-mono text-xs"
                  placeholder="如: mr-..."
                  value={(config as Record<string, string>).MULEROUTER_API_KEY || ""}
                  onChange={(e) => handleChange("MULEROUTER_API_KEY", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => toggleVisibility("MULEROUTER_API_KEY")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground"
                >
                  {visibleFields.MULEROUTER_API_KEY ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          {/* MiniMax 开放平台 (H3-Image & Image-01) */}
          <div className="glass-panel p-6 sm:p-7 rounded-2xl border-glass-border/80 bg-surface/60 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-bold text-xs">
                  MM
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      MiniMax 开放平台 · 图像大模型
                    </h3>
                    <a
                      href="https://platform.minimaxi.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      获取 Key <ExternalLink size={12} />
                    </a>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">
                    支持 MiniMax H3-Image (原生 4K / 多图参考) 与 Image-01 (¥0.025/张极致性价比)。
                  </p>
                </div>
              </div>

              <span
                className={`text-xs px-2.5 py-0.5 rounded-md border font-semibold ${
                  hasMiniMax
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-surface-inset border-glass-border text-text-muted"
                }`}
              >
                {hasMiniMax ? "已配置生效" : "选填 (未配置)"}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="text-text-muted font-medium font-mono">MINIMAX_API_KEY</label>
                <span className="text-text-muted">MiniMax 开放平台 API 密钥</span>
              </div>
              <div className="relative">
                <input
                  type={visibleFields.MINIMAX_API_KEY ? "text" : "password"}
                  className="glass-input w-full pr-10 font-mono text-xs"
                  placeholder="如: eyJhbGciOi..."
                  value={(config as Record<string, string>).MINIMAX_API_KEY || ""}
                  onChange={(e) => handleChange("MINIMAX_API_KEY", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => toggleVisibility("MINIMAX_API_KEY")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground"
                >
                  {visibleFields.MINIMAX_API_KEY ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p className="text-[0.6875rem] text-text-muted mt-1">
                💡 多用户隔离说明：此处为主站全局兜底密钥。若各用户需使用个人 MiniMax 额度，请在【
                <a href="#/platform?section=compute" className="text-primary hover:underline font-medium">
                  算力与凭证 (BYOK)
                </a>
                】中录入自备 Key，系统按登录账号严格物理隔离。
              </p>
            </div>
          </div>

          {/* 3. 快手可灵 Kling 视频大模型 */}
          <div className="glass-panel p-6 sm:p-7 rounded-2xl border-glass-border/80 bg-surface/60 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold text-xs">
                  KL
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    快手可灵 Kling · 视频大模型
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    支持 1.5 / 2.0 电影运镜，可选阿里百炼统一托管代理或厂商官方直接对接。
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 p-1 bg-surface-inset rounded-xl border border-glass-border text-xs">
                <button
                  type="button"
                  onClick={() => handleChange("KLING_PROVIDER_MODE", "dashscope")}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    config.KLING_PROVIDER_MODE === "dashscope"
                      ? "bg-primary text-white shadow-sm"
                      : "text-text-secondary hover:text-foreground"
                  }`}
                >
                  百炼代理 (推荐)
                </button>
                <button
                  type="button"
                  onClick={() => handleChange("KLING_PROVIDER_MODE", "vendor")}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    config.KLING_PROVIDER_MODE === "vendor"
                      ? "bg-primary text-white shadow-sm"
                      : "text-text-secondary hover:text-foreground"
                  }`}
                >
                  可灵官方直连
                </button>
              </div>
            </div>

            {config.KLING_PROVIDER_MODE === "vendor" ? (
              <div className="grid md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs text-text-muted mb-1 block font-mono">KLING_ACCESS_KEY</label>
                  <input
                    type="password"
                    className="glass-input w-full font-mono text-xs"
                    placeholder="可灵 Access Key"
                    value={config.KLING_ACCESS_KEY || ""}
                    onChange={(e) => handleChange("KLING_ACCESS_KEY", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block font-mono">KLING_SECRET_KEY</label>
                  <input
                    type="password"
                    className="glass-input w-full font-mono text-xs"
                    placeholder="可灵 Secret Key"
                    value={config.KLING_SECRET_KEY || ""}
                    onChange={(e) => handleChange("KLING_SECRET_KEY", e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-muted bg-surface-inset p-3 rounded-xl border border-glass-border">
                当前选用百炼托管模式，可灵模型将复用上方填写的【DashScope API-Key】进行统一计费与鉴权，无需填写独立可灵密钥。
              </p>
            )}
          </div>

          {/* 4. 生数科技 Vidu 视频大模型 */}
          <div className="glass-panel p-6 sm:p-7 rounded-2xl border-glass-border/80 bg-surface/60 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center font-bold text-xs">
                  VD
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    生数科技 Vidu · 视频大模型
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    擅长多风格动态转场、角色连贯性与特写动作生成。
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 p-1 bg-surface-inset rounded-xl border border-glass-border text-xs">
                <button
                  type="button"
                  onClick={() => handleChange("VIDU_PROVIDER_MODE", "dashscope")}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    config.VIDU_PROVIDER_MODE === "dashscope"
                      ? "bg-primary text-white shadow-sm"
                      : "text-text-secondary hover:text-foreground"
                  }`}
                >
                  百炼代理 (推荐)
                </button>
                <button
                  type="button"
                  onClick={() => handleChange("VIDU_PROVIDER_MODE", "vendor")}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    config.VIDU_PROVIDER_MODE === "vendor"
                      ? "bg-primary text-white shadow-sm"
                      : "text-text-secondary hover:text-foreground"
                  }`}
                >
                  Vidu 官方直连
                </button>
              </div>
            </div>

            {config.VIDU_PROVIDER_MODE === "vendor" ? (
              <div className="pt-2">
                <label className="text-xs text-text-muted mb-1 block font-mono">VIDU_API_KEY</label>
                <input
                  type="password"
                  className="glass-input w-full font-mono text-xs"
                  placeholder="Vidu API Key"
                  value={config.VIDU_API_KEY || ""}
                  onChange={(e) => handleChange("VIDU_API_KEY", e.target.value)}
                />
              </div>
            ) : (
              <p className="text-xs text-text-muted bg-surface-inset p-3 rounded-xl border border-glass-border">
                当前选用百炼托管模式，Vidu 模型将复用上方填写的【DashScope API-Key】进行统一调度，无需填写独立 Vidu 密钥。
              </p>
            )}
          </div>

          {/* 5. 阿里云 OSS 对象存储 (可选) */}
          <div className="glass-panel p-6 sm:p-7 rounded-2xl border-glass-border/80 bg-surface/60 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center font-bold text-xs">
                  OSS
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    阿里云 OSS · 云端媒体对象存储
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    开启后分镜画面与成片视频将自动异步镜像存储至专属阿里云 OSS 空间，降低本地磁盘压力。
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                <input
                  type="checkbox"
                  checked={Boolean(config.OSS_ENABLE)}
                  onChange={(e) => handleChange("OSS_ENABLE", e.target.checked)}
                  className="rounded border-glass-border text-primary focus:ring-primary w-4 h-4"
                />
                <span>启用 OSS 镜像</span>
              </label>
            </div>

            {config.OSS_ENABLE && (
              <div className="grid md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs text-text-muted mb-1 block font-mono">OSS_BUCKET_NAME</label>
                  <input
                    className="glass-input w-full font-mono text-xs"
                    placeholder="Bucket 名称，如: yingban-media"
                    value={config.OSS_BUCKET_NAME || ""}
                    onChange={(e) => handleChange("OSS_BUCKET_NAME", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block font-mono">OSS_ENDPOINT</label>
                  <input
                    className="glass-input w-full font-mono text-xs"
                    placeholder="如: oss-cn-hangzhou.aliyuncs.com"
                    value={config.OSS_ENDPOINT || ""}
                    onChange={(e) => handleChange("OSS_ENDPOINT", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block font-mono">ALIBABA_CLOUD_ACCESS_KEY_ID</label>
                  <input
                    type="password"
                    className="glass-input w-full font-mono text-xs"
                    placeholder="RAM 用户 AccessKey ID"
                    value={config.ALIBABA_CLOUD_ACCESS_KEY_ID || ""}
                    onChange={(e) => handleChange("ALIBABA_CLOUD_ACCESS_KEY_ID", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block font-mono">ALIBABA_CLOUD_ACCESS_KEY_SECRET</label>
                  <input
                    type="password"
                    className="glass-input w-full font-mono text-xs"
                    placeholder="RAM 用户 AccessKey Secret"
                    value={config.ALIBABA_CLOUD_ACCESS_KEY_SECRET || ""}
                    onChange={(e) => handleChange("ALIBABA_CLOUD_ACCESS_KEY_SECRET", e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 底部悬浮保存栏 */}
          <div className="pt-2 flex items-center justify-between gap-4">
            <p className="text-xs text-text-muted">
              保存后设置即刻写入服务端配置文件，正在运行的后台服务无需重启即可生效。
            </p>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold hover:bg-primary/90 transition-all shadow-md flex items-center gap-2 disabled:opacity-50 shrink-0"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>保存大模型 API-Key 配置</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
