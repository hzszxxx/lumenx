"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Play, FileBox, CheckCircle2, Video, Sparkles, ExternalLink, ChevronRight, Loader2, BookOpen, Layers, Users, Film } from "lucide-react";
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
      setMessage(`模板【${tmpl.title}】已成功克隆到您的工作区！可直接前往 Atelier 画布开始制作。`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "克隆模板失败");
    } finally {
      setForkingId(null);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* 1. 学院 Hero Banner · 影视工业实战与高分模板 */}
      <div className="relative overflow-hidden rounded-3xl border border-glass-border/70 bg-gradient-to-br from-surface via-surface/80 to-surface-inset p-6 sm:p-8 md:p-10 shadow-2xl backdrop-blur-xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-8">
          <div className="space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold tracking-wide">
              <Sparkles size={13} className="animate-pulse" />
              <span>影伴学院 · AIGC 影视工业化教学与工程模板中枢</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight leading-tight">
              创作者培训学院 · 掌握电影级短剧视听生产力
            </h1>

            <p className="text-sm md:text-base text-text-secondary leading-relaxed">
              系统掌握 AIGC 影视工业化流水线核心方法论、大师级镜头语言实战与官方高分工程模板。从分镜层次与轴线防漂移，到一键 Fork 模板到工作区开展工业化成片制作。
            </p>

            <div className="flex items-center gap-4 pt-1 flex-wrap text-xs text-text-muted">
              <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                <CheckCircle2 size={14} className="text-emerald-400" />
                官方导师实操样片录屏
              </span>
              <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                <CheckCircle2 size={14} className="text-emerald-400" />
                4K分镜母版工程一键克隆
              </span>
              <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                <CheckCircle2 size={14} className="text-emerald-400" />
                35mm胶片镜头提示词库
              </span>
              <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                <CheckCircle2 size={14} className="text-emerald-400" />
                直通商业大单实操认证
              </span>
            </div>
          </div>

          {/* 实时教学与模板指标卡片 */}
          <div className="flex flex-col gap-4 shrink-0 xl:w-80">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-surface-inset/70 border border-glass-border shadow-inner">
              <div className="p-2">
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <BookOpen size={12} className="text-primary" /> 精品实战课
                </p>
                <p className="text-xl font-bold text-foreground font-mono mt-1">
                  {courses.length} <span className="text-xs font-normal text-text-muted">门</span>
                </p>
              </div>

              <div className="p-2">
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <Layers size={12} className="text-emerald-400" /> 全套分镜模板
                </p>
                <p className="text-xl font-bold text-emerald-400 font-mono mt-1">
                  {templates.length} <span className="text-xs font-normal text-text-muted">套</span>
                </p>
              </div>

              <div className="p-2 border-t border-glass-border/60">
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <Users size={12} /> 累计研习人次
                </p>
                <p className="text-base font-bold text-foreground font-mono mt-0.5">1,280+ 人</p>
              </div>

              <div className="p-2 border-t border-glass-border/60">
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <Film size={12} /> 模板克隆转化
                </p>
                <p className="text-base font-bold text-amber-400 font-mono mt-0.5">86.4%</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => { window.location.hash = "#/atelier"; }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <Sparkles size={13} />
                进入 Atelier 画布实操
              </button>
              <button
                type="button"
                onClick={() => void loadData()}
                className="glass-button text-xs font-medium px-3.5 py-2.5"
              >
                刷新资源
              </button>
            </div>
          </div>
        </div>

        {/* 访客学习提示 */}
        {!user && (
          <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="text-xs text-text-secondary leading-relaxed">
              💡 <span className="font-semibold text-foreground">公开学习模式</span>：平台所有官方实操视频与分镜规范均向大众公开。若需将全套分镜工程模板一键克隆到个人工作区进行二次创作，请登录创作者账号。
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

      {/* 2. 频道 Tab 切换栏 */}
      <div className="flex items-center justify-between gap-4 border-b border-glass-border pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("courses")}
            className={`text-xs px-4 py-2 rounded-xl font-semibold transition-all ${
              activeTab === "courses"
                ? "bg-primary text-white shadow-md"
                : "text-text-secondary hover:text-foreground hover:bg-hover-bg"
            }`}
          >
            精品实战视频课程 ({courses.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            className={`text-xs px-4 py-2 rounded-xl font-semibold transition-all ${
              activeTab === "templates"
                ? "bg-primary text-white shadow-md"
                : "text-text-secondary hover:text-foreground hover:bg-hover-bg"
            }`}
          >
            官方高分工程模板库 ({templates.length})
          </button>
        </div>
        <span className="text-xs text-text-muted hidden md:inline">
          已挂载大师级镜头语言控制流
        </span>
      </div>

      {/* 3. 课程列表 Grid */}
      {activeTab === "courses" && (
        <>
          {loading ? (
            <div className="glass-panel p-16 text-center text-text-muted flex flex-col items-center justify-center gap-3">
              <Loader2 size={26} className="animate-spin text-primary" />
              <span className="text-sm font-medium">正在加载精品课程列表…</span>
            </div>
          ) : courses.length === 0 ? (
            <div className="glass-panel p-16 text-center text-text-muted">暂无课程上线</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-5">
              {courses.map((course, idx) => (
                <div
                  key={course.id}
                  className="group relative overflow-hidden rounded-2xl border border-glass-border/80 bg-surface/60 hover:border-primary/40 p-6 space-y-4 transition-all duration-300 hover:shadow-xl flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md text-[0.6875rem] font-semibold bg-primary/15 text-primary border border-primary/25">
                          第 0{idx + 1} 讲 · 官方精选
                        </span>
                        <span className="text-xs text-text-muted font-mono">45分钟完整实操</span>
                      </div>
                      <span className="text-[0.6875rem] text-emerald-400 font-medium">
                        全套工程配置可导入
                      </span>
                    </div>

                    <h3 className="font-bold text-lg text-foreground leading-snug group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>

                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
                      {course.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-glass-border/60 flex items-center justify-between gap-3">
                    <span className="text-xs text-text-muted flex items-center gap-1.5">
                      <Video size={13} className="text-primary" />
                      附带电影级分镜流提示词与镜头预设
                    </span>
                    <button
                      type="button"
                      onClick={() => setPlayingCourse(course)}
                      className="bg-primary text-white text-xs px-4 py-2 rounded-xl font-semibold hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-md shrink-0"
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

      {/* 4. 模板工程列表 Grid */}
      {activeTab === "templates" && (
        <>
          {loading ? (
            <div className="glass-panel p-16 text-center text-text-muted flex flex-col items-center justify-center gap-3">
              <Loader2 size={26} className="animate-spin text-primary" />
              <span className="text-sm font-medium">正在加载模板工程包…</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="glass-panel p-16 text-center text-text-muted">暂无公开模板</div>
          ) : (
            <div className="grid md:grid-cols-3 gap-5">
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
                    className="group relative overflow-hidden rounded-2xl border border-glass-border/80 bg-surface/60 hover:border-primary/40 p-6 space-y-4 transition-all duration-300 hover:shadow-xl flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-md text-[0.6875rem] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          {meta.style}
                        </span>
                        <span className="text-xs font-mono text-text-muted">v{tmpl.version}.0</span>
                      </div>

                      <h3 className="font-bold text-base text-foreground leading-snug group-hover:text-primary transition-colors">
                        {tmpl.title}
                      </h3>

                      <div className="flex items-center gap-3 text-xs text-text-muted font-mono pt-1">
                        <span className="text-foreground/80 font-medium">{meta.shots} 个镜头</span>
                        <span>·</span>
                        <span>{meta.ratio}</span>
                        <span>·</span>
                        <span>{meta.duration}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-glass-border/60 flex items-center justify-between gap-2">
                      <span className="text-xs text-text-muted flex items-center gap-1">
                        <FileBox size={13} className="text-primary" /> 完整分镜资产包
                      </span>
                      <button
                        type="button"
                        disabled={forkingId === tmpl.id}
                        onClick={() => void handleFork(tmpl)}
                        className="glass-button text-xs font-semibold hover:border-primary flex items-center gap-1.5 px-3 py-1.5"
                      >
                        {forkingId === tmpl.id ? (
                          <Loader2 size={12} className="animate-spin text-primary" />
                        ) : (
                          <Sparkles size={12} className="text-primary" />
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

      {/* 5. 视频播放 Modal */}
      {playingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="glass-panel max-w-4xl w-full p-6 sm:p-8 space-y-4 border-primary/40 shadow-2xl rounded-3xl bg-surface/90">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[0.6875rem] font-medium bg-primary/20 text-primary">
                    在线实战研学
                  </span>
                  <h3 className="font-bold text-lg text-foreground">{playingCourse.title}</h3>
                </div>
                <p className="text-xs text-text-secondary mt-1 max-w-2xl">{playingCourse.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setPlayingCourse(null)}
                className="text-text-muted hover:text-foreground text-xs px-3 py-1.5 rounded-lg border border-glass-border hover:bg-hover-bg"
              >
                ✕ 关闭
              </button>
            </div>

            <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-glass-border shadow-inner">
              <video
                src={playingCourse.video_url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-text-muted pt-2 border-t border-glass-border/60">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-400" />
                配套资源：电影级分镜提示词已在画布中自动挂载，随课练习无需重复调参。
              </span>
              <button
                type="button"
                onClick={() => { setPlayingCourse(null); window.location.hash = "#/atelier"; }}
                className="text-primary hover:underline flex items-center gap-1 font-semibold"
              >
                前往 Atelier 画布实操演练 <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
