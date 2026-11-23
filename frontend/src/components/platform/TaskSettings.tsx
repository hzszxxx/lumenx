"use client";

import { useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  Calendar,
  Coins,
  CheckCircle2,
  ChevronRight,
  FileText,
  Sparkles,
  AlertCircle,
  Loader2,
  Lock,
  Layers,
  Clock,
  ShieldCheck,
  Building2,
  Tv,
  Film,
  Image as ImageIcon,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Plus,
  FileCheck2,
  Gamepad2,
  Eye,
} from "lucide-react";
import { platformApi, type PlatformTask, type DeliverableSpecs, type MilestoneSpec, type CopyrightTerms } from "@/lib/platformApi";
import { usePlatformStore } from "@/store/platformStore";
import TaskCreateDialog from "./TaskCreateDialog";
import ContractSignDialog from "./ContractSignDialog";
import ContractViewerDialog from "./ContractViewerDialog";
import { WatermarkPreviewModal } from "./WatermarkPreviewModal";

// 业务核心赛道定义
const DEMAND_TYPES = [
  { id: "all", label: "全部赛道", icon: BriefcaseBusiness },
  { id: "ai_drama", label: "AI 普通短剧", icon: Film, desc: "单线经典短剧：剧本、分镜、角色/场景资产与连续成片" },
  { id: "interactive_game", label: "互动短剧 / 影游", icon: Gamepad2, desc: "网状决策树：选择支、限时倒计时、多结局互动影游" },
  { id: "short_video_flow", label: "信息流与运营", icon: Tv, desc: "口播、混剪、产品展示与投放素材" },
  { id: "visual_content", label: "新媒体可视化", icon: ImageIcon, desc: "电商主图、详情页、KV、社媒海报" },
];

// 创作者成长梯度
const LEVEL_TIERS = [
  { id: "all", label: "全部分区" },
  { id: "beginner", label: "🌱 新手带教区", hint: "自带脚本模板与参考样片，快速上手积累首单作品" },
  { id: "standard", label: "⚡ 成长进阶区", hint: "标准商业单，要求具备稳定一致性与镜头动量掌控" },
  { id: "pro", label: "🏆 优选工作室", hint: "高客单定制整包，限官方认证创作者及优选团队" },
];

// 结算模式定义
const SETTLEMENT_FILTERS = [
  { id: "all", label: "全部结算" },
  { id: "milestone", label: "分阶段担保 (40%/60%)" },
  { id: "one_time", label: "终审一次性放款" },
];

export default function TaskSettings() {
  const { user } = usePlatformStore();
  const [tasks, setTasks] = useState<PlatformTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<PlatformTask | null>(null);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);

  // 筛选器状态
  const [selectedStatusTab, setSelectedStatusTab] = useState<"all" | "mine" | "open" | "delivered">("all");
  const [selectedDemandType, setSelectedDemandType] = useState("all");
  const [selectedLevelTier, setSelectedLevelTier] = useState("all");
  const [selectedSettlement, setSelectedSettlement] = useState("all");

  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [signingContractTask, setSigningContractTask] = useState<PlatformTask | null>(null);
  const [viewingContractTask, setViewingContractTask] = useState<PlatformTask | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // 交付抽屉状态
  const [deliveringTaskId, setDeliveringTaskId] = useState<string | null>(null);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [watermarkConfirmed, setWatermarkConfirmed] = useState(true);
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);
  const [previewingWatermarkTask, setPreviewingWatermarkTask] = useState<PlatformTask | null>(null);

  // 审核状态（用于管理员/甲方角色快速验收）
  const [reviewingTaskId, setReviewingTaskId] = useState<string | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

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
    if (!user) {
      setMessage("认领商业任务需要先登录创作者账号，请先登录。");
      return;
    }
    setClaimingId(task.id);
    setMessage(null);
    try {
      await platformApi.claimTask(task.id);
      setClaimedIds((prev) => new Set(prev).add(task.id));
      setSigningContractTask(null);
      setMessage(`接单并电子签约成功！已在线签署《商业制作承揽与保密协议》，已锁定任务【${task.title}】，已解锁分镜制作权限。`);
      await loadTasks();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "接单失败。商业任务广场仅限官方认证创作者（Certified Creator）接单。");
    } finally {
      setClaimingId(null);
    }
  };

  const handleDeliver = async (task: PlatformTask) => {
    setIsSubmittingDelivery(true);
    setMessage(null);
    try {
      const dummySha = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      await platformApi.deliverTask(task.id, {
        product: "atelier",
        artifact_id: `artifact-task-${task.id}`,
        artifact_version: "v1.0.0",
        sha256: dummySha,
        media_type: "video/mp4",
        project_id: `proj-task-${task.id}`,
        project_title_snapshot: `【商单交付】${task.title}`,
        title: `交付成片样片（已含影伴防盗水印）`,
        delivery_note: deliveryNote || "已按需求完成分镜与成片制作，样片已添加防盗水印，请查收验收。",
      });
      setMessage(`【${task.title}】交付物已成功提交！等待发包方终审验收放款。`);
      setDeliveringTaskId(null);
      setDeliveryNote("");
      await loadTasks();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "提交交付失败");
    } finally {
      setIsSubmittingDelivery(false);
    }
  };

  const handleReview = async (task: PlatformTask, approved: boolean) => {
    setIsSubmittingReview(true);
    setMessage(null);
    try {
      await platformApi.reviewTask(task.id, {
        approved,
        feedback: reviewFeedback || (approved ? "验收合格，画质与分镜符合Brief要求，准予结算放款。" : "部分镜头轴线与色彩存在漂移，请修正后重新提交。"),
      });
      setMessage(
        approved
          ? `【${task.title}】验收通过！赏金已释放结算至创作者钱包，并已自动生成商业授权许可凭证。`
          : `【${task.title}】已提交修改意见，通知创作者返工修正。`
      );
      setReviewingTaskId(null);
      setReviewFeedback("");
      await loadTasks();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "审核操作失败");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // 复合筛选逻辑
  const filteredTasks = tasks.filter((t) => {
    if (selectedStatusTab === "mine") {
      const isMine = (t.claimed_by && t.claimed_by === user?.id) || claimedIds.has(t.id);
      if (!isMine) return false;
    } else if (selectedStatusTab === "open") {
      const isClaimed = Boolean((t.claimed_by && t.claimed_by === user?.id) || claimedIds.has(t.id) || t.status === "claimed");
      if (isClaimed || t.status !== "published") return false;
    } else if (selectedStatusTab === "delivered") {
      if (t.status !== "delivered" && t.status !== "resubmitted" && t.status !== "accepted" && t.status !== "settled") return false;
    }

    if (selectedDemandType !== "all") {
      const taskType = t.demand_type || (t.category.includes("互动") ? "interactive_game" : t.category.includes("短剧") ? "ai_drama" : t.category.includes("广告") ? "short_video_flow" : "visual_content");
      if (taskType !== selectedDemandType) return false;
    }
    if (selectedLevelTier !== "all") {
      const taskTier = t.level_tier || t.required_level || "standard";
      if (taskTier !== selectedLevelTier) return false;
    }
    if (selectedSettlement !== "all") {
      const taskSettlement = t.settlement_mode || "one_time";
      if (taskSettlement !== selectedSettlement) return false;
    }
    return true;
  });

  // 安全 JSON 解析辅助函数
  const parseJson = <T,>(jsonStr?: string, fallback: T = {} as T): T => {
    if (!jsonStr) return fallback;
    try {
      return JSON.parse(jsonStr) as T;
    } catch {
      return fallback;
    }
  };

  // 统计指标
  const activeCount = tasks.filter((t) => t.status === "published" || t.status === "claimed").length;
  const totalBountyYuan = tasks.reduce((sum, t) => sum + (t.bounty_cents || 0), 0) / 100;

  return (
    <div className="space-y-6">
      {/* 头部大厅 Banner · VJshi 结构化定位 */}
      <div className="glass-panel p-6 border border-glass-border">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-glass-border">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-primary/15 p-3.5 text-primary border border-primary/25 shrink-0">
              <BriefcaseBusiness size={28} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-display font-semibold text-foreground">商业任务广场</h2>
                <span className="text-[0.6875rem] px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium">
                  平台官方担保交易
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-1.5 leading-relaxed max-w-3xl">
                连接品牌方、头部 MCN 与短剧团队的真实商业产能需求。标准化需求卡片、规范化交付验收、分段资金托管，让“会做内容”转化为“可交付、有收益、能沉淀作品”的稳态产出。
              </p>
            </div>
          </div>

          {/* 实时交易指标 */}
          <div className="flex items-center gap-6 shrink-0 bg-surface-inset/50 px-4 py-2.5 rounded-xl border border-glass-border/70">
            <div>
              <p className="text-[0.6875rem] text-text-muted">进行中需求池</p>
              <p className="text-base font-bold text-foreground font-mono mt-0.5">{activeCount} 个任务</p>
            </div>
            <div className="w-px h-8 bg-glass-border" />
            <div>
              <p className="text-[0.6875rem] text-text-muted">总赏金资金池</p>
              <p className="text-base font-bold text-amber-400 font-mono mt-0.5">¥{totalBountyYuan.toLocaleString()}</p>
            </div>
            <div className="w-px h-8 bg-glass-border" />
            <button
              type="button"
              onClick={() => void loadTasks()}
              className="glass-button text-xs py-1.5 px-3 self-center"
            >
              刷新大厅
            </button>
            <button
              type="button"
              onClick={() => {
                if (!user) {
                  setMessage("发布商业需求需要先登录创作者账号，请先登录。");
                  return;
                }
                setShowCreateTaskDialog(true);
              }}
              className="bg-primary text-white text-xs font-semibold py-1.5 px-3.5 rounded-lg hover:bg-primary-hover transition-opacity flex items-center gap-1.5 shadow-sm shrink-0 self-center cursor-pointer"
            >
              <Plus size={13} /> 发布商业需求
            </button>
          </div>
        </div>

        {!user && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-xs text-text-secondary leading-relaxed">
              💡 <span className="font-semibold text-foreground">任务广场浏览模式</span>：任何人均可实时查看最新发布的企业短剧与商单需求。认领任务签约或发布商单时需登录创作者账号。
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

        {/* 多维筛选区域 (仿 VJshi 矩阵过滤) */}
        <div className="mt-5 space-y-3.5">
          {/* 0. 需求状态快捷标签 */}
          <div className="flex items-center gap-2.5 text-xs flex-wrap pb-1 border-b border-glass-border/40">
            <span className="text-text-muted shrink-0 w-16">需求阶段：</span>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: "all", label: "全部需求池" },
                { id: "open", label: "招募中需求" },
                { id: "mine", label: "我的接单履约" },
                { id: "delivered", label: "交付与验收区" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedStatusTab(id as typeof selectedStatusTab)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all text-xs ${
                    selectedStatusTab === id
                      ? "bg-primary text-white shadow-sm font-semibold"
                      : "text-text-secondary hover:text-foreground hover:bg-hover-bg border border-glass-border/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 1. 业务赛道筛选 */}
          <div className="flex items-center gap-2.5 text-xs flex-wrap">
            <span className="text-text-muted shrink-0 w-16">业务赛道：</span>
            <div className="flex items-center gap-2 flex-wrap">
              {DEMAND_TYPES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedDemandType(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all text-xs ${
                    selectedDemandType === id
                      ? "bg-primary text-white shadow-sm font-semibold"
                      : "text-text-secondary hover:text-foreground hover:bg-hover-bg border border-glass-border/40"
                  }`}
                >
                  <Icon size={13} className={selectedDemandType === id ? "text-white" : "text-text-muted"} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. 创作者分区门槛 */}
          <div className="flex items-center gap-2.5 text-xs flex-wrap">
            <span className="text-text-muted shrink-0 w-16">成长分区：</span>
            <div className="flex items-center gap-2 flex-wrap">
              {LEVEL_TIERS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedLevelTier(id)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all text-xs ${
                    selectedLevelTier === id
                      ? "bg-primary text-white shadow-sm font-semibold"
                      : "text-text-secondary hover:text-foreground hover:bg-hover-bg border border-glass-border/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. 结算保障方式 */}
          <div className="flex items-center gap-2.5 text-xs flex-wrap">
            <span className="text-text-muted shrink-0 w-16">结算方式：</span>
            <div className="flex items-center gap-2 flex-wrap">
              {SETTLEMENT_FILTERS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedSettlement(id)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all text-xs ${
                    selectedSettlement === id
                      ? "bg-primary text-white shadow-sm font-semibold"
                      : "text-text-secondary hover:text-foreground hover:bg-hover-bg border border-glass-border/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 提示消息 */}
      {message && (
        <div
          role="status"
          className="p-4 rounded-xl border border-primary/40 bg-primary/10 text-sm text-foreground flex items-center justify-between shadow-lg backdrop-blur-md"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-primary shrink-0" />
            <p className="font-medium text-xs md:text-sm">{message}</p>
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

      {/* 任务列表展示 */}
      {loading ? (
        <div className="glass-panel p-12 text-center text-text-muted flex flex-col items-center justify-center gap-3">
          <Loader2 size={24} className="animate-spin text-primary" />
          <span className="text-sm">正在加载商单需求大厅…</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="glass-panel p-12 text-center text-text-muted">
          暂无符合筛选条件的商业需求单，可切换赛道或重置筛选查看
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTasks.map((task) => {
            const isSelected = selectedTask?.id === task.id;
            const bountyYuan = (task.bounty_cents / 100).toLocaleString();
            const isClaimed = Boolean(
              (task.claimed_by && task.claimed_by === user?.id) ||
              claimedIds.has(task.id) ||
              task.status === "claimed"
            );

            // 解析结构化字段
            const specs = parseJson<DeliverableSpecs>(task.deliverable_specs_json, {});
            const milestones = parseJson<MilestoneSpec[]>(task.milestone_specs_json, []);
            const copyright = parseJson<CopyrightTerms>(task.copyright_terms_json, {
              scope: "全网商业使用",
              allow_derivative: true,
              require_ai_label: true,
            });
            const criteria = parseJson<string[]>(task.acceptance_criteria_json, []);

            const isBeginner = task.level_tier === "beginner";

            return (
              <div
                key={task.id}
                className={`glass-panel p-6 transition-all border ${
                  isSelected ? "border-primary/50 shadow-lg bg-surface/90" : "border-glass-border hover:border-primary/30"
                }`}
              >
                {/* 顶栏信息 */}
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                  <div className="space-y-3 flex-1">
                    {/* 标头标签行 */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {isBeginner && (
                        <span className="text-[0.6875rem] px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold flex items-center gap-1">
                          🌱 新手带教单
                        </span>
                      )}
                      {task.demand_type === "interactive_game" || task.category.includes("互动") ? (
                        <span className="text-[0.6875rem] px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-400 font-semibold flex items-center gap-1">
                          <Gamepad2 size={11} /> 互动影游
                        </span>
                      ) : task.demand_type === "ai_drama" || task.category.includes("短剧") ? (
                        <span className="text-[0.6875rem] px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-400 font-semibold flex items-center gap-1">
                          <Film size={11} /> 普通短剧
                        </span>
                      ) : null}
                      <span className="font-bold text-lg text-foreground hover:text-primary transition-colors cursor-pointer" onClick={() => setSelectedTask(isSelected ? null : task)}>
                        {task.title}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary font-medium">
                        {task.category}
                      </span>
                      {task.client_name && (
                        <span className="text-xs text-text-muted flex items-center gap-1">
                          <Building2 size={12} className="text-text-muted" />
                          {task.client_name}
                        </span>
                      )}
                    </div>

                    {/* VJshi 风格结构化交付物标签条 */}
                    <div className="flex items-center gap-2 flex-wrap text-xs text-text-secondary">
                      {specs.format && (
                        <span className="px-2 py-0.5 rounded bg-surface-inset border border-glass-border/80 font-mono text-[0.6875rem]">
                          画幅 {specs.format}
                        </span>
                      )}
                      {specs.resolution && (
                        <span className="px-2 py-0.5 rounded bg-surface-inset border border-glass-border/80 font-mono text-[0.6875rem]">
                          清晰度 {specs.resolution}
                        </span>
                      )}
                      {specs.duration_seconds ? (
                        <span className="px-2 py-0.5 rounded bg-surface-inset border border-glass-border/80 font-mono text-[0.6875rem]">
                          时长 {specs.duration_seconds}s
                        </span>
                      ) : null}
                      {specs.deliverable_count ? (
                        <span className="px-2 py-0.5 rounded bg-surface-inset border border-glass-border/80 font-mono text-[0.6875rem]">
                          交付 {specs.deliverable_count} 条/套
                        </span>
                      ) : null}
                      {task.settlement_mode === "milestone" ? (
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[0.6875rem]">
                          分阶段担保结算 (40%/60%)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-surface-inset border border-glass-border/80 text-[0.6875rem]">
                          终审一次性放款
                        </span>
                      )}
                    </div>

                    {/* 需求摘要 */}
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 max-w-4xl font-sans">
                      {task.brief_markdown.replace(/^[#\s\-*]+/gm, " ").slice(0, 150)}…
                    </p>

                    {/* 辅助属性 */}
                    <div className="flex items-center gap-5 text-xs text-text-muted pt-1">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-text-muted" />
                        交付截止：{new Date(task.deadline).toLocaleDateString()}
                      </span>
                      <span>等级要求：{(task.required_level || "standard").toUpperCase()}</span>
                      <span className="flex items-center gap-1 text-emerald-400/90">
                        <ShieldCheck size={13} />
                        赏金已托管至平台
                      </span>
                    </div>
                  </div>

                  {/* 赏金与操作区 */}
                  <div className="flex flex-col lg:items-end justify-between gap-3 shrink-0 self-stretch">
                    <div className="text-right">
                      <span className="text-xs text-text-muted block">平台担保赏金</span>
                      <span className="text-xl font-bold font-mono text-amber-400 flex items-center gap-1 lg:justify-end mt-0.5">
                        <Coins size={16} /> ¥{bountyYuan}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-auto">
                      <button
                        type="button"
                        onClick={() => setSelectedTask(isSelected ? null : task)}
                        className="glass-button text-xs font-medium flex items-center gap-1"
                      >
                        {isSelected ? "收起简报" : "结构化需求"}
                        {isSelected ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>

                      {task.status === "settled" || task.status === "accepted" ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shadow-sm">
                          <CheckCircle2 size={13} />
                          已验收·赏金已结算
                        </div>
                      ) : task.status === "delivered" || task.status === "resubmitted" ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-semibold shadow-sm">
                          <Clock size={13} />
                          已交付·待终审验收
                        </div>
                      ) : task.status === "revision_requested" ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold shadow-sm">
                          <AlertCircle size={13} />
                          需修改重交
                        </div>
                      ) : isClaimed ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium shadow-sm">
                            <CheckCircle2 size={13} />
                            已接单锁定
                          </div>
                          <button
                            type="button"
                            onClick={() => setViewingContractTask(task)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-inset border border-glass-border text-text-secondary hover:text-foreground text-[11px] transition-colors cursor-pointer"
                            title="查看线上电子签署协议与存证哈希"
                          >
                            <FileCheck2 size={12} className="text-emerald-400" />
                            <span>协议存证</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={claimingId === task.id}
                          onClick={() => setSigningContractTask(task)}
                          className="bg-primary text-white text-xs px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition-opacity flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                          {claimingId === task.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Sparkles size={13} />
                          )}
                          立即接单
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 展开结构化需求详情抽屉 (VJshi 核心规范要求落地) */}
                {isSelected && (
                  <div className="mt-5 pt-5 border-t border-glass-border space-y-4">
                    {/* 1. 结构化交付物规格与资产清单 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-surface-inset/60 p-3.5 rounded-xl border border-glass-border">
                        <h5 className="text-[0.6875rem] font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Layers size={12} /> 交付物技术规格
                        </h5>
                        <ul className="text-xs text-text-secondary space-y-1">
                          <li>• 分辨率画幅：{specs.resolution || "1080P"} · {specs.format || "9:16"}</li>
                          <li>• 帧率要求：{specs.fps ? `${specs.fps} fps` : "30 fps"}</li>
                          <li>• 包含资产：{specs.assets_included?.join("、") || "分镜流与成片MP4"}</li>
                        </ul>
                      </div>

                      <div className="bg-surface-inset/60 p-3.5 rounded-xl border border-glass-border">
                        <h5 className="text-[0.6875rem] font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Clock size={12} /> 结算与阶段验收
                        </h5>
                        <ul className="text-xs text-text-secondary space-y-1">
                          {milestones.length > 0 ? (
                            milestones.map((m, idx) => (
                              <li key={idx}>• 阶段 {idx + 1} ({m.percentage}%)：{m.stage}</li>
                            ))
                          ) : (
                            <li>• 终审交付验收合格后，平台全额释放结算至创作者钱包。</li>
                          )}
                        </ul>
                      </div>

                      <div className="bg-surface-inset/60 p-3.5 rounded-xl border border-glass-border">
                        <h5 className="text-[0.6875rem] font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1">
                          <ShieldCheck size={12} /> 版权与商用约定
                        </h5>
                        <ul className="text-xs text-text-secondary space-y-1">
                          <li>• 商用授权范围：{copyright.scope}</li>
                          <li>• 允许二次延展：{copyright.allow_derivative ? "是" : "否"}</li>
                          <li>• AI生成标识：{copyright.require_ai_label ? "需注明 AI 辅助" : "免注"}</li>
                        </ul>
                      </div>
                    </div>

                    {/* 2. 验收标准清单 */}
                    {criteria.length > 0 && (
                      <div className="bg-surface-inset/60 p-3.5 rounded-xl border border-glass-border">
                        <h5 className="text-[0.6875rem] font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Check size={12} /> 核心验收标准 (不通过需修改)
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {criteria.map((c, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 text-xs text-text-secondary">
                              <span className="text-primary font-bold">✓</span>
                              <span>{c}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 3. 详细 Brief 简报正文 */}
                    <div className="bg-surface-inset/40 rounded-xl p-4 text-xs text-text-secondary leading-relaxed whitespace-pre-line border border-glass-border font-sans">
                      <h5 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                        商业需求详细简报 (Brief)
                      </h5>
                      {task.brief_markdown}
                    </div>

                    {/* 3.1 交付物提交区域 (当已接单且未终审时呈现) */}
                    {isClaimed && task.status !== "settled" && task.status !== "accepted" && (
                      <div className="rounded-xl border border-primary/30 bg-surface-inset/60 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-semibold text-primary flex items-center gap-1.5">
                            <FileText size={14} /> 商业任务交付区
                          </h5>
                          {deliveringTaskId !== task.id ? (
                            <button
                              type="button"
                              onClick={() => setDeliveringTaskId(task.id)}
                              className="glass-button text-xs font-medium py-1 px-2.5 text-primary border-primary/30"
                            >
                              + 提交交付样片
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeliveringTaskId(null)}
                              className="text-xs text-text-muted hover:text-foreground"
                            >
                              取消收起
                            </button>
                          )}
                        </div>

                        {deliveringTaskId === task.id ? (
                          <div className="space-y-3 pt-2 border-t border-glass-border">
                            <div>
                              <label className="text-[11px] text-text-muted block mb-1">
                                交付说明 / 样片信息
                              </label>
                              <textarea
                                className="glass-input w-full min-h-[70px] text-xs font-sans"
                                value={deliveryNote}
                                onChange={(e) => setDeliveryNote(e.target.value)}
                                placeholder="例如：已根据 Brief 完成前 3 集分镜，画幅 9:16，1080P，成片已导出并嵌入影伴初审水印。"
                              />
                            </div>

                            <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5">
                              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={watermarkConfirmed}
                                  onChange={(e) => setWatermarkConfirmed(e.target.checked)}
                                  className="rounded text-primary focus:ring-0"
                                />
                                <span>已为初剪样片嵌入【影伴交付审阅样片 · 严禁商用】半透明防盗水印（平台强制保护）</span>
                              </label>

                              <button
                                type="button"
                                onClick={() => setPreviewingWatermarkTask(task)}
                                className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
                              >
                                <Eye size={12} />
                                预览防盗水印效果与 FFmpeg 压制指令
                              </button>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                disabled={isSubmittingDelivery || !watermarkConfirmed}
                                onClick={() => void handleDeliver(task)}
                                className="bg-primary text-white text-xs px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition-opacity flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                              >
                                {isSubmittingDelivery ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                                确认提交交付审核
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeliveringTaskId(null)}
                                className="glass-button text-xs py-2 px-3"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-text-muted">
                            {task.status === "delivered" || task.status === "resubmitted"
                              ? "样片已提交，发包方正在根据验收清单审核，审核通过后赏金自动释放至钱包。"
                              : task.status === "revision_requested"
                              ? "发包方已提出修改意见，请前往画布调整后重新提交样片。"
                              : "制作完成后，点击上方【提交交付样片】上传审阅样片；系统会自动施加影伴防盗水印，验收合格后全额放款。"}
                          </p>
                        )}
                      </div>
                    )}

                    {/* 3.2 发包方/管理员终审放款面板 (当任务已提交交付时) */}
                    {(user?.role === "admin" || user?.role === "client") && (task.status === "delivered" || task.status === "resubmitted") && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                            <ShieldCheck size={14} /> 需求方终审验收台
                          </h5>
                          <span className="text-[11px] text-amber-200/70">
                            待放款托管赏金：¥{bountyYuan}
                          </span>
                        </div>
                        <div>
                          <label className="text-[11px] text-amber-200/80 block mb-1">
                            审核意见 / 质检反馈（不通过时必填）
                          </label>
                          <input
                            className="glass-input w-full text-xs"
                            value={reviewFeedback}
                            onChange={(e) => setReviewFeedback(e.target.value)}
                            placeholder="填写验收评语或镜头修正具体要求…"
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={isSubmittingReview}
                            onClick={() => void handleReview(task, true)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            {isSubmittingReview ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                            终审通过并全额放款 (¥{bountyYuan})
                          </button>
                          <button
                            type="button"
                            disabled={isSubmittingReview}
                            onClick={() => void handleReview(task, false)}
                            className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs px-3.5 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            驳回并要求修改
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 4. 底部带单制作跳转条 (受接单状态严格约束) */}
                    <div className="pt-2 flex items-center justify-between text-xs text-text-muted gap-4">
                      <span>
                        {isClaimed
                          ? "任务已锁定专属于您，进入创作台或画布导入分镜流即刻开始制作。"
                          : "接单后任务将专属于您；请先在上方点击【立即接单】，接单后方可前往画布制作。"}
                      </span>
                      {isClaimed ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof window !== "undefined") {
                              try {
                                window.sessionStorage.setItem("active_commercial_task", JSON.stringify(task));
                              } catch {
                                // ignore
                              }
                              window.location.hash = `#/atelier?from_task=${encodeURIComponent(task.id)}`;
                            }
                          }}
                          className="text-primary hover:underline flex items-center gap-1 font-medium shrink-0 cursor-pointer"
                        >
                          前往画布开始分镜制作 <ChevronRight size={12} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title="请先在上方点击【立即接单】"
                          className="text-text-muted/50 cursor-not-allowed flex items-center gap-1.5 font-medium shrink-0 border border-glass-border/40 px-3 py-1.5 rounded-lg bg-surface-inset/40"
                        >
                          <Lock size={12} className="text-text-muted/60" />
                          前往画布开始分镜制作（需先接单）
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 发布商业需求弹窗 */}
      <TaskCreateDialog
        isOpen={showCreateTaskDialog}
        onClose={() => setShowCreateTaskDialog(false)}
        onSuccess={(created) => {
          setMessage(`【${created.title}】发布成功！赏金 ¥${(created.bounty_cents / 100).toLocaleString()} 已转入官方托管资金池，已同步至大厅供创作者接单。`);
          void loadTasks();
        }}
      />

      {/* 极简商业制作承揽与保密协议签署弹窗 */}
      {signingContractTask && (
        <ContractSignDialog
          task={signingContractTask}
          signerName={user?.username || "认证创作者"}
          isSigning={claimingId === signingContractTask.id}
          onConfirm={() => handleClaim(signingContractTask)}
          onClose={() => setSigningContractTask(null)}
        />
      )}

      {/* 电子协议与存证凭证查看弹窗 */}
      {viewingContractTask && (
        <ContractViewerDialog
          task={viewingContractTask}
          onClose={() => setViewingContractTask(null)}
        />
      )}

      {/* 商业交付样片防盗水印预览弹窗 */}
      {previewingWatermarkTask && (
        <WatermarkPreviewModal
          isOpen={true}
          task={previewingWatermarkTask}
          creatorName={user?.username || "认证创作者"}
          onClose={() => setPreviewingWatermarkTask(null)}
        />
      )}
    </div>
  );
}
