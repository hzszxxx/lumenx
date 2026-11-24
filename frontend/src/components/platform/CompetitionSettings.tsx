"use client";

import { useEffect, useState } from "react";
import { Trophy, Calendar, Award, CheckCircle2, ChevronRight, FileText, Users, Sparkles, Loader2, Zap, Flame, ShieldCheck } from "lucide-react";
import { platformApi, type PlatformCompetition } from "@/lib/platformApi";
import { usePlatformStore } from "@/store/platformStore";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  enrolling: { label: "报名中", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  ongoing: { label: "进行中", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  judging: { label: "评审中", color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  ended: { label: "已完结", color: "text-text-muted bg-surface-inset border-glass-border" },
  draft: { label: "预热筹备", color: "text-text-muted bg-surface-inset border-glass-border" },
};

export default function CompetitionSettings() {
  const [competitions, setCompetitions] = useState<PlatformCompetition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedComp, setSelectedComp] = useState<PlatformCompetition | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { user } = usePlatformStore();

  const loadCompetitions = async () => {
    setLoading(true);
    try {
      const items = await platformApi.competitions();
      setCompetitions(items);
    } catch {
      setMessage("获取赛事列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCompetitions();
  }, []);

  const handleEnroll = async (comp: PlatformCompetition) => {
    if (!user) {
      setMessage("报名参赛需要先登录创作者账号，请先登录。");
      return;
    }
    setEnrollingId(comp.id);
    setMessage(null);
    try {
      await platformApi.enrollCompetition(comp.id);
      setMessage(`恭喜！您已成功报名【${comp.title}】，赛事创作算力已锁定至您的账户。`);
      await loadCompetitions();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "报名失败，请稍后重试");
    } finally {
      setEnrollingId(null);
    }
  };

  const filteredCompetitions = competitions.filter(item => {
    if (filter === "all") return true;
    return item.status === filter;
  });

  const totalPoolCredits = competitions.reduce((sum, c) => sum + (c.allocated_credits || 0), 0);
  const activeComps = competitions.filter(c => c.status === "enrolling" || c.status === "ongoing").length;

  return (
    <div className="space-y-8 pb-12">
      {/* 1. 赛事大厅 Hero Banner · 荣耀挑战与算力奖池 */}
      <div className="relative overflow-hidden rounded-3xl border border-glass-border/70 bg-gradient-to-br from-surface via-surface/80 to-surface-inset p-6 sm:p-8 md:p-10 shadow-2xl backdrop-blur-xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-8">
          <div className="space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold tracking-wide">
              <Trophy size={13} className="animate-pulse" />
              <span>影伴赛事 · 全球 AI 短剧与影视创作大赛</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight leading-tight">
              赛事活动中心 · 争夺百万算力奖池与官方 MCN 签约
            </h1>

            <p className="text-sm md:text-base text-text-secondary leading-relaxed">
              携手头部短剧机构、AI 算力联盟与知名影视制片方，定期举办主题短片创作赛与 48 小时极速冲刺赛。优秀创作者专享算力扶持、导师点评与商业定制签约通道。
            </p>

            <div className="flex items-center gap-4 pt-1 flex-wrap text-xs text-text-muted">
              <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                <CheckCircle2 size={14} className="text-emerald-400" />
                官方 600,000+ 算力奖池
              </span>
              <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                <CheckCircle2 size={14} className="text-emerald-400" />
                头部短剧机构 MCN 联合评审
              </span>
              <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                <CheckCircle2 size={14} className="text-emerald-400" />
                获奖作品官方保底宣发资源
              </span>
              <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                <CheckCircle2 size={14} className="text-emerald-400" />
                直通签约商业定制工作室
              </span>
            </div>
          </div>

          {/* 实时奖池指标卡片 */}
          <div className="flex flex-col gap-4 shrink-0 xl:w-80">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-surface-inset/70 border border-glass-border shadow-inner">
              <div className="p-2">
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <Award size={12} className="text-amber-400" /> 累计奖池算力
                </p>
                <p className="text-xl font-bold text-amber-400 font-mono mt-1">
                  {(totalPoolCredits || 600000).toLocaleString()} <span className="text-xs font-normal text-text-muted">点</span>
                </p>
              </div>

              <div className="p-2">
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <Flame size={12} className="text-primary" /> 进行中赛事
                </p>
                <p className="text-xl font-bold text-foreground font-mono mt-1">
                  {activeComps || 2} <span className="text-xs font-normal text-text-muted">场</span>
                </p>
              </div>

              <div className="p-2 border-t border-glass-border/60">
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <Users size={12} /> 参赛创作团队
                </p>
                <p className="text-base font-bold text-foreground font-mono mt-0.5">380+ 组</p>
              </div>

              <div className="p-2 border-t border-glass-border/60">
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <ShieldCheck size={12} /> 资深评审导师
                </p>
                <p className="text-base font-bold text-emerald-400 font-mono mt-0.5">12 位导演</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => { window.location.hash = "#/atelier"; }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <Sparkles size={13} />
                开启大赛创作工程
              </button>
              <button
                type="button"
                onClick={() => void loadCompetitions()}
                className="glass-button text-xs font-medium px-3.5 py-2.5"
              >
                刷新赛事
              </button>
            </div>
          </div>
        </div>

        {/* 访客参赛引导 */}
        {!user && (
          <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="text-xs text-text-secondary leading-relaxed">
              💡 <span className="font-semibold text-foreground">公开赛事大厅</span>：任何人均可查看赛事赛程与评选规则。报名参赛并锁定大赛创作算力需登录创作者账号。
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

      {/* 2. 赛事筛选 Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-glass-border pb-3">
        <div className="flex items-center gap-2">
          {[
            { id: "all", label: "全部赛事" },
            { id: "ongoing", label: "进行中" },
            { id: "enrolling", label: "报名中" },
            { id: "judging", label: "评审中" },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`text-xs px-4 py-2 rounded-xl font-semibold transition-all ${
                filter === tab.id
                  ? "bg-primary text-white shadow-md"
                  : "text-text-secondary hover:text-foreground hover:bg-hover-bg"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-text-muted hidden md:inline">
          参赛作品自动享有平台全网多端推荐曝光位
        </span>
      </div>

      {/* 3. 赛事列表 */}
      {loading ? (
        <div className="glass-panel p-16 text-center text-text-muted flex flex-col items-center justify-center gap-3">
          <Loader2 size={26} className="animate-spin text-primary" />
          <span className="text-sm font-medium">正在加载赛事列表…</span>
        </div>
      ) : filteredCompetitions.length === 0 ? (
        <div className="glass-panel p-16 text-center text-text-muted">
          暂无对应状态的赛事活动
        </div>
      ) : (
        <div className="grid gap-5">
          {filteredCompetitions.map(comp => {
            const statusConfig = STATUS_MAP[comp.status] || STATUS_MAP.draft;
            const isSelected = selectedComp?.id === comp.id;

            return (
              <div
                key={comp.id}
                className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 p-6 md:p-7 ${
                  isSelected
                    ? "border-primary/60 bg-surface/90 shadow-2xl"
                    : "border-glass-border/80 bg-surface/60 hover:border-primary/40 hover:shadow-xl"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-xl text-foreground group-hover:text-primary transition-colors">
                        {comp.title}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-md border font-semibold ${statusConfig.color}`}
                      >
                        {statusConfig.label}
                      </span>
                      {comp.allocated_credits > 0 && (
                        <span className="text-xs px-3 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono font-bold flex items-center gap-1.5 shadow-sm">
                          <Award size={13} /> 大赛总奖池 {comp.allocated_credits.toLocaleString()} 算力
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-text-secondary leading-relaxed max-w-4xl">
                      {comp.description}
                    </p>

                    <div className="flex items-center gap-6 text-xs text-text-muted pt-1 flex-wrap">
                      {comp.enroll_deadline && (
                        <span className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-primary" />
                          报名截止：{new Date(comp.enroll_deadline).toLocaleDateString()}
                        </span>
                      )}
                      {comp.submit_deadline && (
                        <span className="flex items-center gap-1.5">
                          <FileText size={13} className="text-primary" />
                          作品截稿时间：{new Date(comp.submit_deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedComp(isSelected ? null : comp)}
                      className="glass-button text-xs font-semibold px-4 py-2.5"
                    >
                      {isSelected ? "收起赛制" : "赛制与要求"}
                    </button>
                    {(comp.status === "enrolling" || comp.status === "ongoing") && (
                      <button
                        type="button"
                        disabled={enrollingId === comp.id}
                        onClick={() => void handleEnroll(comp)}
                        className="bg-primary text-white text-xs px-5 py-2.5 rounded-xl font-semibold hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
                      >
                        {enrollingId === comp.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Sparkles size={13} />
                        )}
                        立即报名
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Rules Details */}
                {isSelected && comp.rules_markdown && (
                  <div className="mt-6 pt-6 border-t border-glass-border/70">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <FileText size={13} /> 详细赛制指南与评选维度
                    </h4>
                    <div className="bg-surface-inset/80 rounded-2xl p-5 text-xs text-text-secondary leading-relaxed whitespace-pre-line border border-glass-border font-sans shadow-inner">
                      {comp.rules_markdown}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => { window.location.hash = "#/atelier"; }}
                        className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                      >
                        使用画布置入张导分镜流开始创作 <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
