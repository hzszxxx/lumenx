"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, Calendar, Coins, CheckCircle2, ChevronRight, FileText, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { platformApi, type PlatformTask } from "@/lib/platformApi";
import { usePlatformStore } from "@/store/platformStore";

export default function TaskSettings() {
  const { user } = usePlatformStore();
  const [tasks, setTasks] = useState<PlatformTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<PlatformTask | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const items = await platformApi.tasks();
      setTasks(items);
    } catch {
      setMessage("获取商业任务列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  const handleClaim = async (task: PlatformTask) => {
    setClaimingId(task.id);
    setMessage(null);
    try {
      await platformApi.claimTask(task.id);
      setMessage(`接单成功！已锁定商业任务【${task.title}】，请按交付规范在截止日前提交成片。`);
      await loadTasks();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "接单失败。商业任务广场仅限官方认证创作者（Certified Creator）接单。");
    } finally {
      setClaimingId(null);
    }
  };

  const categories = ["all", ...Array.from(new Set(tasks.map(t => t.category)))];

  const filteredTasks = tasks.filter(t => {
    if (categoryFilter === "all") return true;
    return t.category === categoryFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/15 p-3 text-primary">
              <BriefcaseBusiness size={26} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">商业任务广场</h2>
              <p className="text-sm text-text-secondary mt-1">
                承接影视制片厂、头部 MCN 与商业品牌定制需求，利用工业级分镜流高效交付，获取高额赏金收益。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadTasks()}
            className="glass-button text-xs font-medium self-start md:self-auto"
          >
            刷新任务
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-glass-border flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                categoryFilter === cat
                  ? "bg-primary text-foreground shadow-sm"
                  : "text-text-secondary hover:text-foreground hover:bg-hover-bg"
              }`}
            >
              {cat === "all" ? "全部任务" : cat}
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

      {/* Task List */}
      {loading ? (
        <div className="glass-panel p-12 text-center text-text-muted flex flex-col items-center justify-center gap-3">
          <Loader2 size={24} className="animate-spin text-primary" />
          <span className="text-sm">正在加载商业任务广场…</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="glass-panel p-12 text-center text-text-muted">
          当前暂无可接商业任务，敬请期待新需求发布
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTasks.map(task => {
            const isSelected = selectedTask?.id === task.id;
            const bountyYuan = (task.bounty_cents / 100).toLocaleString();

            return (
              <div
                key={task.id}
                className={`glass-panel p-6 transition-all border ${
                  isSelected ? "border-primary/50 shadow-md" : "border-glass-border hover:border-primary/30"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-lg text-foreground">{task.title}</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary font-medium">
                        {task.category}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono font-bold flex items-center gap-1">
                        <Coins size={12} /> 赏金 ¥{bountyYuan}
                      </span>
                    </div>

                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 max-w-4xl">
                      {task.brief_markdown.replace(/^[#\s\-*]+/gm, " ").slice(0, 160)}…
                    </p>

                    <div className="flex items-center gap-5 text-xs text-text-muted pt-1">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-text-muted" />
                        交付截止：{new Date(task.deadline).toLocaleDateString()}
                      </span>
                      <span>要求等级：{task.required_level.toUpperCase()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedTask(isSelected ? null : task)}
                      className="glass-button text-xs font-medium"
                    >
                      {isSelected ? "收起需求" : "查看 Brief 简报"}
                    </button>
                    <button
                      type="button"
                      disabled={claimingId === task.id}
                      onClick={() => void handleClaim(task)}
                      className="bg-primary text-foreground text-xs px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {claimingId === task.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Sparkles size={13} />
                      )}
                      立即接单
                    </button>
                  </div>
                </div>

                {/* Expanded Brief Markdown */}
                {isSelected && (
                  <div className="mt-5 pt-5 border-t border-glass-border">
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                      商业需求详细简报 (Brief)
                    </h4>
                    <div className="bg-surface-inset/60 rounded-xl p-4 text-xs text-text-secondary leading-relaxed whitespace-pre-line border border-glass-border font-sans">
                      {task.brief_markdown}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
                      <span>接单后任务将专属于您，进入创作台或画布导入分镜流即刻开始制作。</span>
                      <button
                        type="button"
                        onClick={() => { window.location.hash = "#/atelier"; }}
                        className="text-primary hover:underline flex items-center gap-1 font-medium"
                      >
                        前往画布开始分镜制作 <ChevronRight size={12} />
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
