"use client";

import { useEffect, useState } from "react";
import { platformApi, type PlatformSkillVersion } from "@/lib/platformApi";
import { Sparkles, CheckCircle2, ShieldCheck, Layers, PauseCircle, Power, PowerOff, Loader2, X, Plus } from "lucide-react";

async function hashManifest(manifest: Omit<Parameters<typeof platformApi.createSkillVersion>[0]["manifest"], "content_hash">): Promise<string> {
  const canonical = JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}

const PRESET_SKILL_TITLES: Record<string, { title: string; category: string; desc: string }> = {
  "zhang-dao-director": {
    title: "张导专属 · 电影级分镜导演",
    category: "镜头",
    desc: "35mm胶片逻辑、动量因果链与情绪肌肉系统，输出 Runway / 可灵 / Sora / Wan 电影级提示词与四维配音说明。",
  },
  "character-assets": {
    title: "角色资产 · 定妆三视图设定",
    category: "故事",
    desc: "剧本到角色/场景/道具全模态资产卡，支持真人写实与 3D 动漫双分支，强制中灰无影棚三视图定妆范式。",
  },
  "scene-designer": {
    title: "场景设计 · 6:3:1 视觉空间层次",
    category: "镜头",
    desc: "以 6:3:1 空间层次（主体 60% / 环境 30% / 细节 10%）构建具有电影纵深与真实光影物理响应的场景画面。",
  },
  "aesthetic-director": {
    title: "风格审美 · 视觉母版与防漂移",
    category: "故事",
    desc: "智能层风格信号沉淀加导演层视觉母版，锁定色调权属与布光物理响应，杜绝空洞词与跨镜头风格漂移。",
  },
  "novel-script-pipeline": {
    title: "小说转剧本 · 影视工业流水线",
    category: "故事",
    desc: "网文小说智能多集大纲切分，自动拆解场次、镜头动作描述 △ 与带情绪括号对白，强化完播率反转钩子。",
  },
  "storyboard-inspector": {
    title: "分镜纠察 · 7阶段镜头质检",
    category: "镜头",
    desc: "覆盖动作戏与对话戏拆解、视听语言调用、信息梯递进检查与跨镜头一致性连戏审计。",
  },
  "video-reviewer": {
    title: "成片审核 · 20+故障诊断与重试",
    category: "审阅",
    desc: "技术层/匹配层/导演层三层深度质检，诊断人物漂移、穿帮与抽搐，输出最小代价保守重试方案。",
  },
};

export default function SkillSettings() {
  const [items, setItems] = useState<PlatformSkillVersion[]>([]);
  const [name, setName] = useState("custom-story-agent");
  const [version, setVersion] = useState("1.0.0");
  const [title, setTitle] = useState("自定义故事助手");
  const [tools, setTools] = useState("canvas.readProject, canvas.updateNodePrompt");
  const [description, setDescription] = useState("读取项目并提出可执行的视频创作建议");
  const [category, setCategory] = useState<"story" | "shot" | "review" | "sequence">("story");
  const [promptTemplate, setPromptTemplate] = useState("请基于当前项目上下文完成电影级提示词生成：{{input}}");
  const [projectId, setProjectId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () => platformApi.skills().then(setItems).catch(() => setMessage("Skill 列表读取失败"));
  useEffect(() => { void refresh(); }, []);

  const create = async () => {
    setMessage(null);
    try {
      const manifestBase = {
        name,
        version,
        title,
        description,
        category,
        prompt_template: promptTemplate,
        expected_tools: tools.split(",").map(item => item.trim()).filter(Boolean),
      };
      const contentHash = await hashManifest(manifestBase);
      await platformApi.createSkillVersion({
        manifest: { ...manifestBase, content_hash: contentHash },
        scope: projectId ? "project" : "user",
        ...(projectId ? { project_id: projectId } : {}),
      });
      await refresh();
      setShowCustomForm(false);
      setMessage("自定义 Skill 草稿已创建");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Skill 创建失败");
    }
  };

  const toggleSkill = async (item: PlatformSkillVersion, targetActive: boolean) => {
    const preset = PRESET_SKILL_TITLES[item.name];
    const displayTitle = preset?.title || item.name;
    setMessage(null);
    setBusyId(item.id);
    try {
      await platformApi.bindSkillVersion(item.id, targetActive);
      await refresh();
      setMessage(
        targetActive
          ? `【${displayTitle}】已开启激活，已与平台生成和分镜引擎完成绑定`
          : `【${displayTitle}】已成功关闭激活（已停用）`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/15 p-3 text-primary">
              <Sparkles size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">视频 Skill 库</h2>
              <p className="text-sm text-text-secondary mt-1">
                已集成 7 大影视工业级系统 Skill（张导专属、角色资产、场景设计、风格审美、分镜纠察、成片审核等），全方位赋能创作流程。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCustomForm(v => !v)}
            className="glass-button text-xs font-medium"
          >
            {showCustomForm ? "收起自定义面板" : "+ 创建自定义 Skill"}
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
            className="text-xs text-text-muted hover:text-foreground px-2 py-1 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* Custom Skill Creation Panel (placed above active list for easy access) */}
      {showCustomForm && (
        <div className="glass-panel p-6 space-y-4 border border-primary/30 shadow-xl bg-surface/80 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start justify-between border-b border-glass-border pb-3">
            <div>
              <h3 className="font-semibold text-foreground text-base flex items-center gap-2">
                <Sparkles size={18} className="text-primary" />
                创建自定义项目 Skill
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                遵循受控 Skill 规范，输入专有工作流 Prompt 模板，系统自动校验并生成防篡改指纹。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCustomForm(false)}
              className="p-1 rounded-lg text-text-muted hover:text-foreground hover:bg-hover-bg transition-colors"
              title="收起面板"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Skill 标识名（仅小写字母与连字符）</label>
              <input
                className="glass-input w-full"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="例如: mystery-novel-adapter"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">版本号</label>
              <input
                className="glass-input w-full"
                value={version}
                onChange={e => setVersion(e.target.value)}
                placeholder="1.0.0"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-text-muted mb-1 block">显示标题</label>
              <input
                className="glass-input w-full"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="悬疑短剧提示词适配器"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-text-muted mb-1 block">功能描述</label>
              <input
                className="glass-input w-full"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="专门适配民国悬疑题材的镜头与台词生成"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">所属类别</label>
              <select
                className="glass-input w-full"
                value={category}
                onChange={e => setCategory(e.target.value as typeof category)}
              >
                <option value="story">故事 / 剧作</option>
                <option value="shot">镜头 / 运镜</option>
                <option value="review">审阅 / 质检</option>
                <option value="sequence">序列 / 画布</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">工具权限（逗号分隔）</label>
              <input
                className="glass-input w-full"
                value={tools}
                onChange={e => setTools(e.target.value)}
                placeholder="canvas.readProject, canvas.updateNodePrompt"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-text-muted mb-1 block">系统提示词模板（包含 {"{{input}}"} 占位符）</label>
              <textarea
                className="glass-input w-full min-h-[100px]"
                value={promptTemplate}
                onChange={e => setPromptTemplate(e.target.value)}
                placeholder="请基于当前项目上下文完成：{{input}}"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-text-muted mb-1 block">绑定项目 ID（留空表示个人账户全局）</label>
              <input
                className="glass-input w-full"
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                placeholder="项目 ID（可选）"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              className="bg-primary text-foreground rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
              onClick={() => void create()}
            >
              保存并发布 Skill 草稿
            </button>
            <button
              type="button"
              className="glass-button text-sm"
              onClick={() => setShowCustomForm(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Preset / Active Skills List */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-glass-border pb-3">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <Layers size={18} className="text-primary" />
            已启用的专家 Skill 列表
          </h3>
          <span className="text-xs text-text-muted">共 {items.length} 个技能</span>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center">暂无可用 Skill，请检查连接或点击刷新。</p>
        ) : (
          <div className="grid gap-3">
            {items.map(item => {
              const preset = PRESET_SKILL_TITLES[item.name];
              const displayTitle = preset?.title || item.name;
              const displayDesc = preset?.desc || "自定义创作扩展技能";
              const displayCat = preset?.category || item.scope;

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-glass-border bg-surface/40 p-4 transition-all hover:bg-surface/70 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-semibold text-foreground text-sm">{displayTitle}</span>
                      <span className="rounded-md bg-primary/15 text-primary px-2 py-0.5 text-xs font-mono font-medium">
                        v{item.version}
                      </span>
                      <span className="rounded-md bg-surface-inset border border-glass-border text-text-muted px-2 py-0.5 text-xs">
                        {displayCat}
                      </span>
                      {item.scope === "system" && (
                        <span className="rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 text-xs flex items-center gap-1">
                          <ShieldCheck size={12} /> 系统内置
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">{displayDesc}</p>
                    <p className="text-[0.6875rem] font-mono text-text-muted">
                      ID: {item.name} · 指纹: {item.content_hash.slice(0, 16)}…
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {item.status === "active" ? (
                      <>
                        <span className="text-xs text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 font-medium">
                          <CheckCircle2 size={13} /> 运行中
                        </span>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void toggleSkill(item, false)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-all font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                          title="点击关闭激活"
                        >
                          {busyId === item.id ? <Loader2 size={13} className="animate-spin" /> : <PowerOff size={13} />}
                          关闭激活
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-text-muted flex items-center gap-1.5 bg-surface-inset px-2.5 py-1 rounded-md border border-glass-border font-medium">
                          <PauseCircle size={13} /> 已停用
                        </span>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void toggleSkill(item, true)}
                          className="bg-primary text-foreground text-xs px-3.5 py-1.5 rounded-lg font-medium hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
                          title="点击开启激活"
                        >
                          {busyId === item.id ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}
                          开启激活
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
