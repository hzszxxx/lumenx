"use client";

import { useEffect, useState } from "react";
import { Trophy, Calendar, Award, CheckCircle2, ChevronRight, FileText, Users, Sparkles, Loader2 } from "lucide-react";
import { platformApi, type PlatformCompetition } from "@/lib/platformApi";
import { usePlatformStore } from "@/store/platformStore";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  enrolling: { label: "报名中", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  ongoing: { label: "进行中", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  judging: { label: "评审中", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
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
      setMessage(`恭喜！您已成功报名【${comp.title}】，赛事创作算力已就绪。`);
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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-500/15 p-3 text-amber-400">
              <Trophy size={26} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">赛事活动中心</h2>
              <p className="text-sm text-text-secondary mt-1">
                参与全球 AI 影视短片大赛与限时创作挑战，瓜分官方高额算力奖池与商业签约机会。
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadCompetitions()}
              className="glass-button text-xs font-medium"
            >
              刷新赛事
            </button>
          </div>
        </div>

        {!user && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-xs text-text-secondary leading-relaxed">
              💡 <span className="font-semibold text-foreground">公开赛事大厅</span>：任何人均可查看赛事赛程与评选规则。报名参赛并锁定大赛创作算力需登录创作者账号。
            </div>
            <button
              type="button"
              onClick={() => { window.location.hash = "#/platform?section=users"; }}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 shrink-0 cursor-pointer"
            >
              登录创作者账号
            </button>
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-glass-border">
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
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                filter === tab.id
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-secondary hover:text-foreground hover:bg-hover-bg"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
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

      {/* Competitions Grid */}
      {loading ? (
        <div className="glass-panel p-12 text-center text-text-muted flex flex-col items-center justify-center gap-3">
          <Loader2 size={24} className="animate-spin text-primary" />
          <span className="text-sm">正在加载赛事列表…</span>
        </div>
      ) : filteredCompetitions.length === 0 ? (
        <div className="glass-panel p-12 text-center text-text-muted">
          暂无对应状态的赛事活动
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredCompetitions.map(comp => {
            const statusConfig = STATUS_MAP[comp.status] || STATUS_MAP.draft;
            const isSelected = selectedComp?.id === comp.id;

            return (
              <div
                key={comp.id}
                className={`glass-panel p-6 transition-all border ${
                  isSelected ? "border-primary/50 shadow-md" : "border-glass-border hover:border-primary/30"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-lg text-foreground">{comp.title}</span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-md border font-medium ${statusConfig.color}`}
                      >
                        {statusConfig.label}
                      </span>
                      {comp.allocated_credits > 0 && (
                        <span className="text-xs px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono font-medium flex items-center gap-1">
                          <Award size={12} /> 奖池 {comp.allocated_credits.toLocaleString()} 算力
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-text-secondary leading-relaxed max-w-4xl">
                      {comp.description}
                    </p>

                    <div className="flex items-center gap-5 text-xs text-text-muted pt-1 flex-wrap">
                      {comp.enroll_deadline && (
                        <span className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-text-muted" />
                          报名截止：{new Date(comp.enroll_deadline).toLocaleDateString()}
                        </span>
                      )}
                      {comp.submit_deadline && (
                        <span className="flex items-center gap-1.5">
                          <FileText size={13} className="text-text-muted" />
                          截稿时间：{new Date(comp.submit_deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedComp(isSelected ? null : comp)}
                      className="glass-button text-xs font-medium"
                    >
                      {isSelected ? "收起赛制" : "赛制与要求"}
                    </button>
                    {(comp.status === "enrolling" || comp.status === "ongoing") && (
                      <button
                        type="button"
                        disabled={enrollingId === comp.id}
                        onClick={() => void handleEnroll(comp)}
                        className="bg-primary text-white text-xs px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition-opacity flex items-center gap-1.5 shadow-sm disabled:opacity-50"
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
                  <div className="mt-5 pt-5 border-t border-glass-border">
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                      详细赛制指南
                    </h4>
                    <div className="bg-surface-inset/60 rounded-xl p-4 text-xs text-text-secondary leading-relaxed whitespace-pre-line border border-glass-border font-sans">
                      {comp.rules_markdown}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => { window.location.hash = "#/atelier"; }}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        使用画布置入张导分镜流开始创作 <ChevronRight size={12} />
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
