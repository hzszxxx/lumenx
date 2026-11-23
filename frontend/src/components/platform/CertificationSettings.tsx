"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Award, CheckCircle2, Clock, FileText, Send, Sparkles, AlertCircle, ChevronRight, Loader2 } from "lucide-react";
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
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/15 p-3 text-primary">
              <ShieldCheck size={26} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">创作者专业等级认证</h2>
              <p className="text-sm text-text-secondary mt-1">
                认证创作者享有商业任务广场高额接单、官方算力优先保障与专属导演署名特权。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="glass-button text-xs font-medium self-start md:self-auto"
          >
            刷新状态
          </button>
        </div>
      </div>

      {!user && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-text-secondary leading-relaxed">
            💡 <span className="font-semibold text-foreground">访客浏览模式</span>：您当前可以公开查阅创作者认证权益、要求与考题示例。在准备好提交认证作品时，请先登录创作者账号。
          </div>
          <button
            type="button"
            onClick={() => { window.location.hash = "#/platform?section=users"; }}
            className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 shrink-0"
          >
            登录创作者账号
          </button>
        </div>
      )}

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

      {/* Status Card & Privileges */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass-panel p-6 lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
              我的认证状态
            </h3>
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  isCertified
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : isReviewing
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    : "bg-surface-inset text-text-muted border border-glass-border"
                }`}
              >
                <Award size={24} />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">
                  {isCertified
                    ? "官方认证创作者"
                    : isReviewing
                    ? "认证审核中"
                    : "尚未认证"}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  等级：{cert?.level ? cert.level.toUpperCase() : "STANDARD"}
                </p>
              </div>
            </div>

            {cert?.score != null && (
              <div className="p-3 rounded-lg bg-surface-inset border border-glass-border text-xs mb-3">
                <span className="text-text-muted">综合实操评分：</span>
                <span className="font-mono font-bold text-primary ml-1">{cert.score} 分</span>
              </div>
            )}

            {cert?.feedback && (
              <div className="p-3 rounded-lg bg-surface-inset border border-glass-border text-xs text-text-secondary leading-relaxed mb-3">
                <span className="text-text-muted block mb-1">专家评审评语：</span>
                {cert.feedback}
              </div>
            )}
          </div>

          <div className="text-[0.6875rem] text-text-muted border-t border-glass-border pt-3">
            {cert?.certified_at
              ? `认证通过时间: ${new Date(cert.certified_at).toLocaleDateString()}`
              : "通过实操考核后自动点亮平台认证标识"}
          </div>
        </div>

        {/* Privileges */}
        <div className="glass-panel p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            认证创作者专属权益
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                title: "商业任务广场接单权",
                desc: "解锁头部短剧编排、商业品牌宣传片等高佣任务接单资格，订单佣金高达 ¥2,000~¥10,000。",
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
                title: "平台首页创作者展映",
                desc: "优秀成片作品入选官方推荐展位与年度榜单，直接对接影视公司与商业客户签约合作。",
                active: isCertified,
              },
            ].map(item => (
              <div
                key={item.title}
                className="rounded-xl border border-glass-border bg-surface/50 p-4 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    size={16}
                    className={item.active ? "text-emerald-400" : "text-text-muted"}
                  />
                  <span className="font-medium text-sm text-foreground">{item.title}</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed pl-6">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Exam Application Section */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <FileText size={20} className="text-primary" />
          <h3 className="text-base font-semibold text-foreground">认证实操考题</h3>
        </div>

        {exam ? (
          <div className="space-y-4">
            <div className="bg-surface-inset/70 border border-glass-border rounded-xl p-4 text-xs text-text-secondary leading-relaxed whitespace-pre-line font-sans">
              {exam.prompt}
            </div>

            {!isCertified && !isReviewing && (
              <form onSubmit={handleSubmitExam} className="space-y-4 pt-2">
                <h4 className="text-sm font-medium text-foreground">提交考核实操作品</h4>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">考核作品名称</label>
                    <input
                      className="glass-input w-full"
                      placeholder="例如: 雨夜刀客分镜实操考核"
                      value={projectTitle}
                      onChange={e => setProjectTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">创作说明与使用模型</label>
                    <input
                      className="glass-input w-full"
                      placeholder="简述创作思路，如: 使用张导分镜流 + 6:3:1 层次"
                      value={submissionDesc}
                      onChange={e => setSubmissionDesc(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-text-muted">
                    提交后系统将指派平台评审导师进行专业三层质检（视听、动量与一致性）。
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-primary text-white text-xs px-5 py-2.5 rounded-lg font-medium hover:bg-primary-hover transition-opacity flex items-center gap-1.5 shadow-sm disabled:opacity-50"
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
                <span>您的考核作品正在由官方评审导师进行审片与打分，请耐心等待结果通知。</span>
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
