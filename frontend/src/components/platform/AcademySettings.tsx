"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Play, FileBox, CheckCircle2, Video, Sparkles, ExternalLink, ChevronRight, Loader2 } from "lucide-react";
import { platformApi, type PlatformCourse, type PlatformTemplate } from "@/lib/platformApi";
import { usePlatformStore } from "@/store/platformStore";

export default function AcademySettings() {
  const [courses, setCourses] = useState<PlatformCourse[]>([]);
  const [templates, setTemplates] = useState<PlatformTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<"courses" | "templates">("courses");
  const [loading, setLoading] = useState(true);
  const [playingCourse, setPlayingCourse] = useState<PlatformCourse | null>(null);
  const [forkingId, setForkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { user } = usePlatformStore();

  const loadData = async () => {
    setLoading(true);
    try {
      const [courseItems, templateItems] = await Promise.all([
        platformApi.courses().catch(() => []),
        platformApi.templates().catch(() => []),
      ]);
      setCourses(courseItems);
      setTemplates(templateItems);
    } catch {
      setMessage("获取培训学院资源失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleFork = async (tmpl: PlatformTemplate) => {
    if (!user) {
      setMessage("克隆模板到工作区需要登录创作者账号，请先登录。");
      return;
    }
    setForkingId(tmpl.id);
    setMessage(null);
    try {
      await platformApi.forkTemplate(tmpl.id);
      setMessage(`模板【${tmpl.title}】已成功克隆到您的工作区！`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "克隆模板失败");
    } finally {
      setForkingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/15 p-3 text-primary">
              <GraduationCap size={26} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">创作者培训学院</h2>
              <p className="text-sm text-text-secondary mt-1">
                系统掌握 AIGC 影视工业化流水线核心方法论、张导镜头语言实战与官方高分工程模板。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="glass-button text-xs font-medium self-start md:self-auto"
          >
            刷新资源
          </button>
        </div>

        {!user && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-xs text-text-secondary leading-relaxed">
              💡 <span className="font-semibold text-foreground">公开学习模式</span>：所有人均可直接学习官方实战课程。若需将工程模板克隆到工作区实操，请先登录创作者账号。
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

        {/* Tab switch */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-glass-border">
          <button
            type="button"
            onClick={() => setActiveTab("courses")}
            className={`text-xs px-4 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === "courses"
                ? "bg-primary text-foreground shadow-sm"
                : "text-text-secondary hover:text-foreground hover:bg-hover-bg"
            }`}
          >
            精品实战课程 ({courses.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            className={`text-xs px-4 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === "templates"
                ? "bg-primary text-foreground shadow-sm"
                : "text-text-secondary hover:text-foreground hover:bg-hover-bg"
            }`}
          >
            官方工程模板库 ({templates.length})
          </button>
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

      {/* Courses Grid */}
      {activeTab === "courses" && (
        <>
          {loading ? (
            <div className="glass-panel p-12 text-center text-text-muted flex flex-col items-center justify-center gap-3">
              <Loader2 size={24} className="animate-spin text-primary" />
              <span className="text-sm">正在加载课程列表…</span>
            </div>
          ) : courses.length === 0 ? (
            <div className="glass-panel p-12 text-center text-text-muted">暂无课程上线</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {courses.map(course => (
                <div
                  key={course.id}
                  className="glass-panel p-5 space-y-3 border border-glass-border hover:border-primary/40 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[0.6875rem] font-medium bg-primary/10 text-primary border border-primary/20">
                        官方精选
                      </span>
                      <span className="text-xs text-text-muted">45分钟完整实操</span>
                    </div>
                    <h3 className="font-bold text-base text-foreground leading-snug">
                      {course.title}
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                      {course.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-glass-border flex items-center justify-between">
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Video size={13} /> 随课附带张导专属工程配置
                    </span>
                    <button
                      type="button"
                      onClick={() => setPlayingCourse(course)}
                      className="bg-primary text-foreground text-xs px-3.5 py-1.5 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm"
                    >
                      <Play size={12} fill="currentColor" />
                      开始学习
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Templates Grid */}
      {activeTab === "templates" && (
        <>
          {loading ? (
            <div className="glass-panel p-12 text-center text-text-muted flex flex-col items-center justify-center gap-3">
              <Loader2 size={24} className="animate-spin text-primary" />
              <span className="text-sm">正在加载模板工程…</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="glass-panel p-12 text-center text-text-muted">暂无公开模板</div>
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              {templates.map(tmpl => {
                let meta = { shots: 8, style: "影视写实", ratio: "16:9", duration: "45s" };
                try {
                  if (tmpl.metadata_json) meta = { ...meta, ...JSON.parse(tmpl.metadata_json) };
                } catch {
                  // ignore
                }

                return (
                  <div
                    key={tmpl.id}
                    className="glass-panel p-5 space-y-3 border border-glass-border hover:border-primary/40 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[0.6875rem] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {meta.style}
                        </span>
                        <span className="text-xs font-mono text-text-muted">v{tmpl.version}</span>
                      </div>
                      <h3 className="font-bold text-sm text-foreground leading-snug">
                        {tmpl.title}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-text-muted font-mono pt-1">
                        <span>{meta.shots} 个镜头</span>
                        <span>·</span>
                        <span>{meta.ratio}</span>
                        <span>·</span>
                        <span>{meta.duration}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-glass-border flex items-center justify-between">
                      <span className="text-xs text-text-muted flex items-center gap-1">
                        <FileBox size={13} /> 完整分镜资产包
                      </span>
                      <button
                        type="button"
                        disabled={forkingId === tmpl.id}
                        onClick={() => void handleFork(tmpl)}
                        className="glass-button text-xs font-medium hover:border-primary flex items-center gap-1.5"
                      >
                        {forkingId === tmpl.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Sparkles size={12} />
                        )}
                        克隆模板
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Video Modal Player */}
      {playingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass-panel max-w-3xl w-full p-6 space-y-4 border-primary/40 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-foreground">{playingCourse.title}</h3>
                <p className="text-xs text-text-secondary mt-1">{playingCourse.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setPlayingCourse(null)}
                className="text-text-muted hover:text-foreground text-sm px-2 py-1"
              >
                ✕ 关闭
              </button>
            </div>
            <div className="aspect-video bg-black rounded-xl overflow-hidden border border-glass-border">
              <video
                src={playingCourse.video_url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-text-muted pt-2">
              <span>配套资源：张导专属提示词已在画布中自动挂载。</span>
              <button
                type="button"
                onClick={() => { setPlayingCourse(null); window.location.hash = "#/atelier"; }}
                className="text-primary hover:underline flex items-center gap-1 font-medium"
              >
                进入画布实操 <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
