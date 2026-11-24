"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Award, CheckCircle2, Clock, FileText, Send, Sparkles, AlertCircle, ChevronRight, Loader2, Zap, Star, Video, Layers } from "lucide-react";
import { platformApi, type PlatformCertification, type PlatformExam } from "@/lib/platformApi";
import { usePlatformStore } from "@/store/platformStore";

export default function CertificationSettings() {
  const [cert, setCert] = useState<PlatformCertification | null>(null);
  const [exam, setExam] = useState<PlatformExam | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [submissionDesc, setSubmissionDesc] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const { user } = usePlatformStore();

  const loadData = async () => {
    setLoading(true);
    try {
      const [certStatus, examPrompt] = await Promise.all([
        platformApi.certification().catch(() => null),
        platformApi.activeExam().catch(() => null),
      ]);
      setCert(certStatus);
      setExam(examPrompt);
    } catch {
      setMessage("获取创作者认证信息失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSubmitExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setMessage("提交考核申请需要先登录创作者账号，请点击右上角登录。");
      return;
    }
    if (!exam) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const artifactPayload = {
        product: "atelier",
        artifact_id: `exam-${Date.now()}`,
        artifact_version: "1.0",
        sha256: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join(""),
        media_type: "video/mp4",
        project_id: "exam-project-direct",
        project_title_snapshot: projectTitle || "实操考核提交作品",
        title: projectTitle || "实操考核提交作品",
        description: submissionDesc || "遵循张导分镜流规范制作的实操考题样片",
      };
      await platformApi.applyCertification({
        exam_id: exam.id,
        artifact: artifactPayload,
      });
      setMessage("考核作品提交成功！官方评审团队将在 1-3 个工作日内完成综合评审。");
      await loadData();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "提交考核申请失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const isCertified = cert?.status === "certified";
  const isReviewing = cert?.status === "reviewing";

  return (
    <div className="space-y-8 pb-12">
      {/* 1. 认证 Hero Banner · 专业资历与商业权限 */}
      <div className="relative overflow-hidden rounded-3xl border border-glass-border/70 bg-gradient-to-br from-surface via-surface/80 to-surface-inset p-6 sm:p-8 md:p-10 shadow-2xl backdrop-blur-xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-8">
          <div className="space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold tracking-wide">
              <ShieldCheck size={13} className="animate-pulse" />
              <span>影伴认证 · 官方专业创作者资质评审体系</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight leading-tight">
              创作者等级认证 · 解锁商业大单接单权与导演特权
            </h1>

            <p className="text-sm md:text-base text-text-secondary leading-relaxed">
              通过张导分镜流、视听语言一致性与动态掌控力实操考核，获得官方认证创作者徽章（Certified Creator），尊享商业任务广场优先认领权、极速算力通道与官方商单派发。
            </p>

            <div className="flex items-center gap-4 pt-1 flex-wrap text-xs text-text-muted">
              <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                <CheckCircle2 size={14} className="text-emerald-400" />
                商业任务广场优先接单权
              </span>
              <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                <CheckCircle2 size={14} className="text-emerald-400" />
                极速算力优先队列 (提速 60%)
              </span>
              <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                <CheckCircle2 size={14} className="text-emerald-400" />
                张导镜头参数深度微调权
              </span>
              <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                <CheckCircle2 size={14} className="text-emerald-400" />
                平台首页年度推荐展映
              </span>
            </div>
          </div>

          {/* 实时认证指标卡片 */}
          <div className="flex flex-col gap-4 shrink-0 xl:w-80">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-surface-inset/70 border border-glass-border shadow-inner">
              <div className="p-2">
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <Award size={12} className="text-primary" /> 等级体系
                </p>
                <p className="text-xl font-bold text-foreground font-mono mt-1">
                  PRO <span className="text-xs font-normal text-text-muted">导演级</span>
                </p>
              </div>

              <div className="p-2">
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <Star size={12} className="text-amber-400" /> 认证创作者
                </p>
                <p className="text-xl font-bold text-amber-400 font-mono mt-1">
                  240+ <span className="text-xs font-normal text-text-muted">位</span>
                </p>
              </div>

              <div className="p-2 border-t border-glass-border/60">
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <Zap size={12} /> 商单接单率
                </p>
                <p className="text-base font-bold text-emerald-400 font-mono mt-0.5">94.2%</p>
              </div>

              <div className="p-2 border-t border-glass-border/60">
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <Layers size={12} /> 质检维度
                </p>
                <p className="text-base font-bold text-foreground font-mono mt-0.5">3 层把控</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => { window.location.hash = "#/tasks"; }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <Sparkles size={13} />
                查阅商业任务广场
              </button>
              <button
                type="button"
                onClick={() => void loadData()}
                className="glass-button text-xs font-medium px-3.5 py-2.5"
              >
                刷新状态
              </button>
            </div>
          </div>
        </div>

        {/* 访客模式引导 */}
        {!user && (
          <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="text-xs text-text-secondary leading-relaxed">
              💡 <span className="font-semibold text-foreground">访客浏览模式</span>：您当前可以公开查阅创作者认证权益、要求与考题示例。在准备好提交认证作品时，请先登录创作者账号。
            </div>
            <button
              type="button"
              onClick={() => { window.location.hash = "#/platform?section=users"; }}
              className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 shrink-0 cursor-pointer shadow-sm"
            >
              登录创作者账号
            </button>
          </div>
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

      {/* 2. 我的认证状态 & 专属特权 */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass-panel p-6 sm:p-7 rounded-2xl lg:col-span-1 flex flex-col justify-between border-glass-border/80 bg-surface/60">
          <div>
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-5 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-primary" /> 我的创作者认证状态
            </h3>
            <div className="flex items-center gap-4 mb-5">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  isCertified
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-md"
                    : isReviewing
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-md"
                    : "bg-surface-inset text-text-muted border border-glass-border"
                }`}
              >
                <Award size={28} />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">
                  {isCertified
                    ? "官方认证创作者"
                    : isReviewing
                    ? "认证作品审核中"
                    : "尚未提交认证"}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  资历等级：{cert?.level ? cert.level.toUpperCase() : "STANDARD"}
                </p>
              </div>
            </div>

            {cert?.score != null && (
              <div className="p-3.5 rounded-xl bg-surface-inset border border-glass-border text-xs mb-3 flex items-center justify-between">
                <span className="text-text-muted">综合实操专家评分：</span>
                <span className="font-mono font-bold text-primary text-sm">{cert.score} 分</span>
              </div>
            )}

            {cert?.feedback && (
              <div className="p-3.5 rounded-xl bg-surface-inset border border-glass-border text-xs text-text-secondary leading-relaxed mb-3">
                <span className="text-text-muted font-medium block mb-1">专家评审导师评语：</span>
                {cert.feedback}
              </div>
            )}
          </div>

          <div className="text-[0.6875rem] text-text-muted border-t border-glass-border pt-4">
            {cert?.certified_at
              ? `认证通过时间: ${new Date(cert.certified_at).toLocaleDateString()}`
              : "通过实操考核后自动点亮平台认证标识与商业接单徽章"}
          </div>
        </div>

        {/* 专属权益卡片 */}
        <div className="glass-panel p-6 sm:p-7 rounded-2xl lg:col-span-2 border-glass-border/80 bg-surface/60">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-5 flex items-center gap-1.5">
            <Star size={14} className="text-amber-400" /> 认证创作者尊享 4 大特权
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                title: "商业任务广场接单权",
                desc: "解锁头部短剧编排、商业品牌宣传片等高客单任务接单资格，单笔赏金高达 ¥2,000~¥10,000。",
                active: isCertified,
              },
              {
                title: "极速算力优先队列",
                desc: "专享 Wan 2.6 / 可灵 / Sora 视频生成高峰期并发加速通道，排队等待耗时减少 60%。",
                active: isCertified,
              },
              {
                title: "张导专家级 Skill 解锁",
                desc: "独家访问 35mm 胶片镜头深度物理参数微调权与防漂移视觉母版底层控制矩阵。",
                active: isCertified,
              },
              {
                title: "平台首页年度作品展映",
                desc: "优秀成片作品入选官方推荐展位与年度榜单，直接对接知名影视机构与商业客户签约合作。",
                active: isCertified,
              },
            ].map(item => (
              <div
                key={item.title}
                className="rounded-xl border border-glass-border bg-surface/50 p-4 space-y-2 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    size={16}
                    className={item.active ? "text-emerald-400" : "text-text-muted"}
                  />
                  <span className="font-semibold text-sm text-foreground">{item.title}</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed pl-6">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. 实操考核考题与提交模块 */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border-glass-border/80 bg-surface/60 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/15 text-primary">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">认证实操考题</h3>
              <p className="text-xs text-text-secondary mt-0.5">请遵循张导分镜流规范完成样片并在此提交验收</p>
            </div>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-surface-inset border border-glass-border text-text-muted">
            期次：2026-Q4 实操考卷
          </span>
        </div>

        {exam ? (
          <div className="space-y-5">
            <div className="bg-surface-inset/80 border border-glass-border rounded-2xl p-5 text-xs text-text-secondary leading-relaxed whitespace-pre-line font-sans shadow-inner">
              {exam.prompt}
            </div>

            {!isCertified && !isReviewing && (
              <form onSubmit={handleSubmitExam} className="space-y-4 pt-3 border-t border-glass-border/70">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Video size={14} className="text-primary" /> 提交考核实操作品
                </h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-text-muted mb-1.5 block font-medium">考核作品名称</label>
                    <input
                      className="glass-input w-full"
                      placeholder="例如: 雨夜刀客分镜实操考核样片"
                      value={projectTitle}
                      onChange={e => setProjectTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted mb-1.5 block font-medium">创作说明与使用模型</label>
                    <input
                      className="glass-input w-full"
                      placeholder="简述创作思路，如: 使用张导分镜流 + 6:3:1 镜头层次"
                      value={submissionDesc}
                      onChange={e => setSubmissionDesc(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <p className="text-xs text-text-muted">
                    提交后系统将指派平台评审导师进行专业三层质检（视听、动量与角色一致性）。
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-primary text-white text-xs px-6 py-2.5 rounded-xl font-semibold hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 shrink-0"
                  >
                    {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    提交认证考核
                  </button>
                </div>
              </form>
            )}

            {isReviewing && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-xs text-amber-300">
                <Clock size={18} className="shrink-0" />
                <span>您的考核作品正在由官方评审导师进行审片与打分，评审结果将在 1-3 个工作日内公布，请耐心等待通知。</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-text-muted py-2">暂无开放的考题或正在筹备新一期认证。</p>
        )}
      </div>
    </div>
  );
}
