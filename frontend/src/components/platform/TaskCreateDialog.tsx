"use client";

import { useState } from "react";
import {
  X,
  Sparkles,
  Coins,
  Calendar,
  Layers,
  Clock,
  ShieldCheck,
  Building2,
  Film,
  Tv,
  Image as ImageIcon,
  Check,
  Plus,
  Loader2,
  FileText,
  Gamepad2,
} from "lucide-react";
import { platformApi, type PlatformTask } from "@/lib/platformApi";

interface TaskCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (task: PlatformTask) => void;
}

// 快速预设模板
const TEMPLATES = [
  {
    label: "互动微影游/多结局短剧模板",
    data: {
      title: "悬疑解谜互动微影游《迷雾公馆》首章 · 分支决策与双结局编排",
      client_name: "芒果互娱互动工作室",
      demand_type: "interactive_game",
      category: "互动影游",
      level_tier: "pro",
      bountyYuan: 7800,
      format: "9:16",
      resolution: "1080P",
      fps: 30,
      duration_seconds: 240,
      deliverable_count: 5,
      settlement_mode: "milestone",
      brief_markdown: `### 剧情背景与分支规则
密室逃脱互动悬疑微影游开局：
- 起点镜头：主角在雨夜废弃公馆醒来，房门紧锁，桌上有火柴与神秘羊皮信；
- 关键决策点（限时10秒抉择）：
  - 选项A【点燃火柴搜寻暗格】：解锁密室暗门，进入调查分支视频；
  - 选项B【强行破门呼救】：惊动暗处守夜人，进入追逐战斗分支视频；
- 双结局走向：
  - 结局1（正常通关）：利用密道收集到门卡逃出；
  - 结局2（Bad End）：直接被困地下室，触发警戒机关。

### 制作风格与运镜要求
- 风格基调：悬疑暗黑电影质感，冷调青蓝环境光与暖黄烛光对撞；
- 交互节点要求：分支抉择前一帧预留 0.5s 决策悬停，选项文案紧凑有力；
- 一致性规范：主角全身服饰与道具细节严格跨镜头一致。`,
      criteria: [
        "主角三视图定妆与雨夜公馆场景光影保持全流程一致",
        "完成5段关联分支视频切片，包含决策点与双结局闭环",
        "提供剧情决策树连线逻辑，并通过在线试玩模拟器自测无死锁",
      ],
    },
  },
  {
    label: "玄幻短剧分镜模板",
    data: {
      title: "修仙短剧 · 前三集高燃分镜编排与出片",
      client_name: "华策影视制片组",
      demand_type: "ai_drama",
      category: "短剧分镜",
      level_tier: "standard",
      bountyYuan: 3500,
      format: "9:16",
      resolution: "1080P",
      fps: 30,
      duration_seconds: 180,
      deliverable_count: 3,
      settlement_mode: "milestone",
      brief_markdown: `### 需求背景与剧情说明
头部修仙小说改编短剧《万界归宗》前三集开篇：
- 场景1：青云宗宗门大殿，主角被废黜灵根，雷雨夜受辱；
- 场景2：后山断崖偶得太古剑尊残魂苏醒，天降异象；
- 场景3：三日后宗门大比，一剑封喉逆袭逆徒。

### 制作风格与运镜要求
- 风格基调：东方修仙玄幻写实，光影具备宏大纵深感与电影胶片质感；
- 运镜规范：特写与全景切换节奏分明，打斗场景保持180度轴线连贯；
- 色彩体系：冷色调雷雨青灰过渡到剑芒破晓暖金。`,
      criteria: [
        "保持核心主角脸部与服饰定妆跨镜头强一致性",
        "每集包含至少15个有效分镜镜头，无抽搐与穿模",
        "对白情绪附带括号提示，适配后期双声道环境音",
      ],
    },
  },
  {
    label: "新能源车广告信息流模板",
    data: {
      title: "高端新能源汽车 30秒未来科技概念片",
      client_name: "未来智能出行Lab",
      demand_type: "short_video_flow",
      category: "商业广告",
      level_tier: "pro",
      bountyYuan: 6800,
      format: "16:9",
      resolution: "4K",
      fps: 60,
      duration_seconds: 30,
      deliverable_count: 1,
      settlement_mode: "milestone",
      brief_markdown: `### 品牌调性与分镜构思
极简、硬朗工业美学、未来主义赛博质感：
- 关键镜头1：车身流线侧逆光、智能光幕交互特写；
- 镜头2：高速弯道动态运镜，雨夜霓虹倒影拉丝；
- 镜头3：全景座舱智驾光环亮起，极速破晓驶入地平线。`,
      criteria: [
        "车漆光泽与钣金高光反射符合物理真实物理引擎反射",
        "动态运镜平滑流畅，帧率达到 60fps 规格",
        "包含三套关键帧定妆图与 4K 终剪 MP4 资产",
      ],
    },
  },
  {
    label: "新手带教单模板",
    data: {
      title: "国风美妆口红 15秒动态分镜编排",
      client_name: "花西子品牌视觉中心",
      demand_type: "visual_content",
      category: "品牌宣传",
      level_tier: "beginner",
      bountyYuan: 1200,
      format: "9:16",
      resolution: "1080P",
      fps: 30,
      duration_seconds: 15,
      deliverable_count: 1,
      settlement_mode: "one_time",
      brief_markdown: `### 制作要求
国风东方雅致美学：
- 镜头1：白瓷与微距雕花口红缓缓转出；
- 镜头2：淡雅水墨晕染背景，金箔微光飘落；
- 镜头3：模特局部唇妆特写，柔焦自然微动。`,
      criteria: [
        "色彩通透温润，符合东方美学微距质感",
        "提供基础分镜关键帧序列",
        "新手友好，平台提供资深导师在线指导修改",
      ],
    },
  },
];

export default function TaskCreateDialog({ isOpen, onClose, onSuccess }: TaskCreateDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 表单状态
  const [title, setTitle] = useState("玄幻修仙爆款短剧 · 前三集高燃分镜编排与出片");
  const [clientName, setClientName] = useState("华策影视制片组");
  const [demandType, setDemandType] = useState("ai_drama");
  const [category, setCategory] = useState("短剧分镜");
  const [levelTier, setLevelTier] = useState("standard");
  const [bountyYuan, setBountyYuan] = useState<number>(3500);
  const [deadline, setDeadline] = useState("2026-12-15");

  // 交付规格
  const [format, setFormat] = useState("9:16");
  const [resolution, setResolution] = useState("1080P");
  const [fps, setFps] = useState(30);
  const [durationSeconds, setDurationSeconds] = useState(180);
  const [deliverableCount, setDeliverableCount] = useState(3);
  const [settlementMode, setSettlementMode] = useState("milestone");

  // Brief 与验收标准
  const [briefMarkdown, setBriefMarkdown] = useState(TEMPLATES[0].data.brief_markdown);
  const [criteria, setCriteria] = useState<string[]>(TEMPLATES[0].data.criteria);
  const [newCriterion, setNewCriterion] = useState("");

  if (!isOpen) return null;

  const applyTemplate = (tmpl: (typeof TEMPLATES)[number]) => {
    setTitle(tmpl.data.title);
    setClientName(tmpl.data.client_name);
    setDemandType(tmpl.data.demand_type);
    setCategory(tmpl.data.category);
    setLevelTier(tmpl.data.level_tier);
    setBountyYuan(tmpl.data.bountyYuan);
    setFormat(tmpl.data.format);
    setResolution(tmpl.data.resolution);
    setFps(tmpl.data.fps);
    setDurationSeconds(tmpl.data.duration_seconds);
    setDeliverableCount(tmpl.data.deliverable_count);
    setSettlementMode(tmpl.data.settlement_mode);
    setBriefMarkdown(tmpl.data.brief_markdown);
    setCriteria([...tmpl.data.criteria]);
  };

  const handleAddCriterion = () => {
    if (!newCriterion.trim()) return;
    setCriteria((prev) => [...prev, newCriterion.trim()]);
    setNewCriterion("");
  };

  const handleRemoveCriterion = (idx: number) => {
    setCriteria((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("请填写商业需求标题");
      return;
    }
    if (bountyYuan <= 0) {
      setError("担保赏金必须大于 0 元");
      return;
    }

    setSubmitting(true);
    try {
      const isInteractive = demandType === "interactive_game";
      const specsJson = JSON.stringify({
        format,
        resolution,
        fps,
        duration_seconds: durationSeconds,
        deliverable_count: deliverableCount,
        interactive_mode: isInteractive,
        assets_included: isInteractive
          ? ["剧情决策树配置", "分镜视频切片包", "在线试玩评审链接"]
          : ["分镜脚本流", "成片样片MP4", "关键帧资产包"],
      });

      const milestoneSpecsJson = JSON.stringify(
        settlementMode === "milestone"
          ? [
              { stage: "第一阶段：分镜脚本与三视图定妆确认", percentage: 40 },
              { stage: "第二阶段：终审成片验收交付并释放版权", percentage: 60 },
            ]
          : [{ stage: "全额一次性终审放款", percentage: 100 }]
      );

      const copyrightJson = JSON.stringify({
        scope: "全网商业使用许可（含新媒体平台、投流与衍生推广）",
        allow_derivative: true,
        require_ai_label: true,
      });

      const res = await platformApi.createTask({
        title: title.trim(),
        client_name: clientName.trim() || "官方认证发包方",
        category,
        demand_type: demandType,
        level_tier: levelTier,
        required_level: levelTier,
        status: "published",
        bounty_cents: Math.round(bountyYuan * 100),
        deadline: new Date(deadline || Date.now() + 14 * 86400000).toISOString(),
        deliverable_specs_json: specsJson,
        settlement_mode: settlementMode,
        milestone_specs_json: milestoneSpecsJson,
        copyright_terms_json: copyrightJson,
        acceptance_criteria_json: JSON.stringify(criteria),
        brief_markdown: briefMarkdown.trim(),
      });

      onSuccess(res);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "发布需求失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-glass-border bg-[#0d0e14]/95 p-6 shadow-2xl space-y-5 text-foreground font-sans">
        {/* 顶部标题栏 */}
        <div className="flex items-start justify-between border-b border-glass-border pb-3.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2 py-0.5 rounded bg-primary/15 border border-primary/30 text-primary font-semibold flex items-center gap-1">
                <Sparkles size={12} /> 光厂需求大厅 · 发包模式
              </span>
              <span className="text-xs text-text-muted">平台资金托管 · 结构化参数撮合</span>
            </div>
            <h3 className="text-lg font-bold text-foreground">发布商业需求单</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-foreground hover:bg-hover-bg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 快捷模板套用条 */}
        <div className="bg-surface-inset/60 p-3 rounded-xl border border-glass-border space-y-2">
          <div className="text-[11px] text-text-muted flex items-center gap-1.5 font-medium">
            <FileText size={12} className="text-primary" />
            快速套用成熟行业需求模板：
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.label}
                type="button"
                onClick={() => applyTemplate(tmpl)}
                className="text-xs px-2.5 py-1 rounded-lg bg-surface border border-glass-border hover:border-primary/50 text-text-secondary hover:text-foreground transition-all"
              >
                + {tmpl.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 基本信息 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-text-muted block mb-1">需求标题</label>
              <input
                className="glass-input w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如: 悬疑短剧 · 第一季高燃分镜编排与样片出片"
                required
              />
            </div>
            <div>
              <label className="text-text-muted block mb-1">发包方名称 / 品牌名</label>
              <input
                className="glass-input w-full"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="例如: 华策影视短剧事业部"
              />
            </div>
            <div>
              <label className="text-text-muted block mb-1">交付截止日期</label>
              <input
                type="date"
                className="glass-input w-full"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-text-muted block mb-1">所属赛道与模式</label>
              <select
                className="glass-input w-full"
                value={demandType}
                onChange={(e) => setDemandType(e.target.value)}
              >
                <option value="ai_drama">🎬 AI 普通短剧 (经典单线/连续分镜/出片)</option>
                <option value="interactive_game">🎮 互动短剧 / 影游 (网状分支/多结局/决策树)</option>
                <option value="short_video_flow">⚡ 短视频与信息流 (口播/混剪/投放)</option>
                <option value="visual_content">🎨 新媒体可视化 (海报/KV/电商主图)</option>
              </select>
            </div>
            <div>
              <label className="text-text-muted block mb-1">创作者成长门槛</label>
              <select
                className="glass-input w-full"
                value={levelTier}
                onChange={(e) => setLevelTier(e.target.value)}
              >
                <option value="beginner">🌱 新手带教单 (适合首单积累实战)</option>
                <option value="standard">⚡ 成长进阶单 (要求工业级稳定一致性)</option>
                <option value="pro">🏆 优选工作室单 (高规格全案整包)</option>
              </select>
            </div>
          </div>

          {demandType === "interactive_game" && (
            <div className="p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-xs text-purple-200 flex items-start gap-2.5">
              <Gamepad2 size={16} className="text-purple-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-purple-300">🎮 互动影游专属需求约定：</span>
                <p className="text-purple-200/80 leading-relaxed">
                  本需求要求多分支决策与多结局，将与普通线性短剧严格隔离。接单学员的工作台将自动解锁决策树连线与倒计时选项配置，最终需交付分支切片与在线试玩评审链接。
                </p>
              </div>
            </div>
          )}

          {/* 结构化交付规格 */}
          <div className="rounded-xl border border-glass-border bg-surface-inset/40 p-3.5 space-y-3">
            <h4 className="text-[11px] font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={13} /> 交付物技术规格 (VJshi 规范)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[11px] text-text-muted block mb-1">画幅比例</label>
                <select
                  className="glass-input w-full"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option value="9:16">9:16 (竖屏短剧/信息流)</option>
                  <option value="16:9">16:9 (横屏短片/中视频)</option>
                  <option value="1:1">1:1 (方屏电商)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-text-muted block mb-1">分辨率清晰度</label>
                <select
                  className="glass-input w-full"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                >
                  <option value="1080P">1080P 全高清</option>
                  <option value="4K">4K 超高清</option>
                  <option value="2K">2K 高清</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-text-muted block mb-1">交付帧率</label>
                <select
                  className="glass-input w-full"
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                >
                  <option value={24}>24 fps (电影感)</option>
                  <option value={30}>30 fps (标准短视频)</option>
                  <option value={60}>60 fps (丝滑动态)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-text-muted block mb-1">目标时长 (秒)</label>
                <input
                  type="number"
                  className="glass-input w-full font-mono"
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* 赏金与结算方式 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-text-muted block mb-1">托管担保赏金 (元)</label>
              <div className="relative">
                <input
                  type="number"
                  className="glass-input w-full pl-7 font-mono font-bold text-amber-400"
                  value={bountyYuan}
                  onChange={(e) => setBountyYuan(Number(e.target.value))}
                  required
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs">¥</span>
              </div>
              <span className="text-[11px] text-text-muted mt-1 block">
                资金将由影伴平台官方托管，创作者终审验收通过后方才放款。
              </span>
            </div>
            <div>
              <label className="text-text-muted block mb-1">阶段结算模式</label>
              <select
                className="glass-input w-full"
                value={settlementMode}
                onChange={(e) => setSettlementMode(e.target.value)}
              >
                <option value="milestone">分阶段担保 (40%分镜确认 / 60%成片终审)</option>
                <option value="one_time">终审一次性全额放款 (100%)</option>
              </select>
            </div>
          </div>

          {/* 验收标准清单 */}
          <div className="space-y-2">
            <label className="text-text-muted block">核心验收标准清单 (至少 1 条)</label>
            <div className="space-y-1.5">
              {criteria.map((c, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 bg-surface-inset p-2 rounded-lg border border-glass-border">
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-bold">✓</span>
                    <span className="text-text-secondary">{c}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCriterion(idx)}
                    className="text-text-muted hover:text-red-400 text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                className="glass-input flex-1"
                value={newCriterion}
                onChange={(e) => setNewCriterion(e.target.value)}
                placeholder="输入一条新的验收硬指标，如：无肢体崩坏穿模…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCriterion();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddCriterion}
                className="glass-button text-xs py-2 px-3 shrink-0"
              >
                添加标准
              </button>
            </div>
          </div>

          {/* 详细简报 Markdown */}
          <div>
            <label className="text-text-muted block mb-1">商业需求详细简报 (Brief 正文)</label>
            <textarea
              className="glass-input w-full min-h-[120px] font-mono leading-relaxed"
              value={briefMarkdown}
              onChange={(e) => setBriefMarkdown(e.target.value)}
              placeholder="编写详细的剧情大纲、角色外貌设定、光影分镜及成片交付具体要求…"
              required
            />
          </div>

          {/* 底部按钮栏 */}
          <div className="flex items-center justify-between pt-3 border-t border-glass-border">
            <span className="text-[11px] text-text-muted flex items-center gap-1">
              <ShieldCheck size={13} className="text-emerald-400" />
              已启用影伴防盗水印与数字版权托管协议
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="glass-button py-2 px-4"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-primary text-foreground font-semibold px-5 py-2 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Coins size={14} />}
                立即托管赏金并发布 (¥{bountyYuan})
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
