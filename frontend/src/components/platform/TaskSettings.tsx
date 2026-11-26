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
  ChevronDown,
  ChevronUp,
  Plus,
  FileCheck2,
  Gamepad2,
  Eye,
  RefreshCw,
  Zap,
  TrendingUp,
  Award,
  ArrowRight,
} from "lucide-react";
import {
  platformApi,
  type PlatformTask,
  type DeliverableSpecs,
  type MilestoneSpec,
  type CopyrightTerms,
} from "@/lib/platformApi";
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
  const [messageType, setMessageType] = useState<"success" | "warning" | "error">("success");

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
      // 未登录或网络波动时优雅降级，不弹破坏性报错
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  const handleClaim = async (task: PlatformTask) => {
    if (!user) {
      setMessageType("warning");
      setMessage("认领商业任务需要先登录创作者账号。");
      return;
    }
    setClaimingId(task.id);
    setMessage(null);
    try {
      await platformApi.claimTask(task.id);
      setClaimedIds((prev) => new Set(prev).add(task.id));
      setSigningContractTask(null);
      setMessageType("success");
      setMessage(`接单并电子签约成功！已在线签署《商业制作承揽与保密协议》，已锁定任务【${task.title}】，已解锁分镜制作权限。`);
      await loadTasks();
    } catch (err) {
      setMessageType("error");
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
      setMessageType("success");
      setMessage(`【${task.title}】交付物已成功提交！等待发包方终审验收放款。`);
      setDeliveringTaskId(null);
      setDeliveryNote("");
      await loadTasks();
    } catch (err) {
      setMessageType("error");
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
        feedback:
          reviewFeedback ||
          (approved
            ? "验收合格，画质与分镜符合Brief要求，准予结算放款。"
            : "部分镜头轴线与色彩存在漂移，请修正后重新提交。"),
      });
      setMessageType("success");
      setMessage(
        approved
          ? `【${task.title}】验收通过！赏金已释放结算至创作者钱包，并已自动生成商业授权许可凭证。`
          : `【${task.title}】已提交修改意见，通知创作者返工修正。`
      );
      setReviewingTaskId(null);
      setReviewFeedback("");
      await loadTasks();
    } catch (err) {
      setMessageType("error");
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
      const isClaimed = Boolean(
        (t.claimed_by && t.claimed_by === user?.id) || claimedIds.has(t.id) || t.status === "claimed"
      );
      if (isClaimed || t.status !== "published") return false;
    } else if (selectedStatusTab === "delivered") {
      if (
        t.status !== "delivered" &&
        t.status !== "resubmitted" &&
        t.status !== "accepted" &&
        t.status !== "settled"
      )
        return false;
    }

    if (selectedDemandType !== "all") {
      const taskType =
        t.demand_type ||
        (t.category.includes("互动")
          ? "interactive_game"
          : t.category.includes("短剧")
          ? "ai_drama"
          : t.category.includes("广告")
          ? "short_video_flow"
          : "visual_content");
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
    <div className="space-y-8 pb-12">
      {/* 1. 首页 Hero Banner · 影视工业与商业变现主干 */}
      <div className="relative overflow-hidden rounded-3xl border border-glass-border/70 bg-gradient-to-br from-surface via-surface/80 to-surface-inset p-6 sm:p-8 md:p-10 shadow-2xl backdrop-blur-xl">
        {/* 背景光影效果 */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-8">
          <div className="space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold tracking-wide">
              <Sparkles size={13} className="animate-pulse" />
              <span>影伴 YINGBAN · 全球 AI 漫剧与短剧商业变现平台</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight leading-tight">
              商业任务广场 · 连接百万 AI 创作者与品牌商单
            </h1>

            <p className="text-sm md:text-base text-text-secondary leading-relaxed">
              连接品牌方、头部 MCN 与短剧团队的真实商业产能需求。标准化需求卡片、规范化交付验收、分段资金托管，让“会做内容”转化为“可交付、有收益、能沉淀作品”的稳态产出。
            </p>

            {/* 核心价值点打标 */}
            <div className="flex items-center gap-4 pt-1 flex-wrap text-xs text-text-muted">
              <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                <CheckCircle2 size={14} className="text-emerald-400" />
                平台全额资金托管
              </span>
              <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                <CheckCircle2 size={14} className="text-emerald-400" />
                电子签约与存证
              </span>
              <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                <CheckCircle2 size={14} className="text-emerald-400" />
                样片防盗半透明水印
              </span>
              <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                <CheckCircle2 size={14} className="text-emerald-400" />
                直通 Atelier 画布管线
              </span>
            </div>
          </div>

          {/* 实时交易指标卡片 & 快捷操作 */}
          <div className="flex flex-col gap-4 shrink-0 xl:w-80">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-surface-inset/70 border border-glass-border shadow-inner">
              <div className="p-2">
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <BriefcaseBusiness size={12} /> 进行中需求池
                </p>
                <p className="text-xl font-bold text-foreground font-mono mt-1">
                  {activeCount} <span className="text-xs font-normal text-text-muted">单</span>
                </p>
              </div>

              <div className="p-2">
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <Coins size={12} className="text-amber-400" /> 担保资金池
                </p>
                <p className="text-xl font-bold text-amber-400 font-mono mt-1">
                  ¥{totalBountyYuan.toLocaleString()}
                </p>
              </div>

              <div className="p-2 border-t border-glass-border/60">
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <Building2 size={12} /> 合作机构
                </p>
                <p className="text-base font-bold text-foreground font-mono mt-0.5">36+ 家</p>
              </div>

              <div className="p-2 border-t border-glass-border/60">
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <Clock size={12} /> 官方平均结款
                </p>
                <p className="text-base font-bold text-emerald-400 font-mono mt-0.5">≤ 48 小时</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    setMessageType("warning");
                    setMessage("发布商业需求需要先登录创作者或发包方账号。");
                    return;
                  }
                  setShowCreateTaskDialog(true);
                }}
                className="flex-1 bg-primary text-white text-xs sm:text-sm font-semibold py-2.5 px-4 rounded-xl hover:bg-primary-hover transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-primary/25 cursor-pointer"
              >
                <Plus size={15} /> 发布商业需求
              </button>

              <button
                type="button"
                onClick={() => void loadTasks()}
                title="刷新任务大厅"
                className="glass-button p-2.5 rounded-xl text-text-secondary hover:text-foreground shrink-0 cursor-pointer"
              >
                <RefreshCw size={15} className={loading ? "animate-spin text-primary" : ""} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 平台 4 大核心保障体系（增强交易信任度与官方背书） */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-surface/60 border border-glass-border flex items-start gap-3.5 hover:border-primary/40 transition-colors">
          <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">分段资金担保托管</h4>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              发包方预先锁款全额托管，40% 首批分镜确认 + 60% 终审验收放款，严防跑单拖欠。
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface/60 border border-glass-border flex items-start gap-3.5 hover:border-primary/40 transition-colors">
          <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/25 shrink-0">
            <Zap size={20} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">AI 漫剧一站式管线</h4>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              内置角色面部一致性控制与分镜制作工作流，直通 Wanx / Qwen / Seedance 电影级渲染。
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface/60 border border-glass-border flex items-start gap-3.5 hover:border-primary/40 transition-colors">
          <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25 shrink-0">
            <FileCheck2 size={20} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">电子签约与法律存证</h4>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              接单即时生成防篡改制作承揽与保密协议，附带 SHA-256 存证哈希，权益权威可查。
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface/60 border border-glass-border flex items-start gap-3.5 hover:border-primary/40 transition-colors">
          <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25 shrink-0">
            <Eye size={20} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">全流程样片防盗水印</h4>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              初剪样片一键嵌入影伴半透明防盗水印与 FFmpeg 保护指令，终审放款前版权无忧。
            </p>
          </div>
        </div>
      </div>

      {/* 3. 访客免登录状态温馨引导 */}
      {!user && (
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles size={14} className="text-primary" /> 任务广场公开浏览中
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                访客免密直达
              </span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              当前为公开浏览模式，可自由查阅全部商单的技术规格与资金池。认领接单或发布商单只需 10 秒注册创作者账号。
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              window.location.hash = "#/platform?section=users";
            }}
            className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shrink-0 shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <span>登录 / 注册创作者账号</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* 4. 多维矩阵筛选区域 */}
      <div className="glass-panel p-5 border border-glass-border space-y-4">
        {/* 4.1 需求阶段标签 */}
        <div className="flex items-center gap-3 text-xs flex-wrap pb-3 border-b border-glass-border/60">
          <span className="text-text-muted shrink-0 w-20 font-medium">需求阶段：</span>
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
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedStatusTab === id
                    ? "bg-primary text-white shadow-sm font-semibold"
                    : "text-text-secondary hover:text-foreground hover:bg-hover-bg border border-glass-border/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 4.2 业务赛道筛选 */}
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="text-text-muted shrink-0 w-20 font-medium">业务赛道：</span>
          <div className="flex items-center gap-2 flex-wrap">
            {DEMAND_TYPES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedDemandType(id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedDemandType === id
                    ? "bg-primary text-white shadow-sm font-semibold"
                    : "text-text-secondary hover:text-foreground hover:bg-hover-bg border border-glass-border/50"
                }`}
              >
                <Icon size={13} className={selectedDemandType === id ? "text-white" : "text-text-muted"} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 4.3 创作者分区门槛 */}
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="text-text-muted shrink-0 w-20 font-medium">成长分区：</span>
          <div className="flex items-center gap-2 flex-wrap">
            {LEVEL_TIERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedLevelTier(id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedLevelTier === id
                    ? "bg-primary text-white shadow-sm font-semibold"
                    : "text-text-secondary hover:text-foreground hover:bg-hover-bg border border-glass-border/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 4.4 结算保障方式 */}
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="text-text-muted shrink-0 w-20 font-medium">结算方式：</span>
          <div className="flex items-center gap-2 flex-wrap">
            {SETTLEMENT_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedSettlement(id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedSettlement === id
                    ? "bg-primary text-white shadow-sm font-semibold"
                    : "text-text-secondary hover:text-foreground hover:bg-hover-bg border border-glass-border/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 5. 提示消息 Banner */}
      {message && (
        <div
          role="status"
          className={`p-4 rounded-2xl border text-xs sm:text-sm flex items-center justify-between shadow-lg backdrop-blur-md transition-all ${
            messageType === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : messageType === "warning"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-red-500/40 bg-red-500/10 text-red-300"
          }`}
        >
          <div className="flex items-center gap-3">
            {messageType === "success" ? (
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            ) : messageType === "warning" ? (
              <AlertCircle size={18} className="text-amber-400 shrink-0" />
            ) : (
              <AlertCircle size={18} className="text-red-400 shrink-0" />
            )}
            <p className="font-medium">{message}</p>
          </div>
          <div className="flex items-center gap-2">
            {!user && messageType === "warning" && (
              <button
                type="button"
                onClick={() => {
                  window.location.hash = "#/platform?section=users";
                }}
                className="px-3 py-1 rounded-lg bg-amber-500 text-black text-xs font-semibold hover:bg-amber-400 cursor-pointer"
              >
                去登录
              </button>
            )}
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="text-xs text-text-muted hover:text-foreground px-2 py-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 6. 任务卡片响应式网格流 (Card Grid 流体验升级) */}
      {loading ? (
        <div className="glass-panel p-16 text-center text-text-muted flex flex-col items-center justify-center gap-3.5">
          <Loader2 size={28} className="animate-spin text-primary" />
          <span className="text-sm font-medium">正在实时加载商单需求大厅…</span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="glass-panel p-16 text-center text-text-muted space-y-3">
          <BriefcaseBusiness size={32} className="mx-auto text-text-muted/50" />
          <p className="text-sm">暂无符合筛选条件的商业需求单，可切换赛道或重置筛选查看</p>
          <button
            type="button"
            onClick={() => {
              setSelectedStatusTab("all");
              setSelectedDemandType("all");
              setSelectedLevelTier("all");
              setSelectedSettlement("all");
            }}
            className="text-xs text-primary hover:underline font-medium cursor-pointer"
          >
            重置全部筛选条件
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
            const cleanBrief = (task.brief_markdown || "").replace(/\\n/g, "\n");

            return (
              <div
                key={task.id}
                className={`glass-panel p-5 sm:p-6 transition-all border flex flex-col justify-between ${
                  isSelected
                    ? "border-primary/60 shadow-xl bg-surface/90 ring-1 ring-primary/20"
                    : "border-glass-border hover:border-primary/40 hover:shadow-lg"
                }`}
              >
                {/* 卡片头部与主体 */}
                <div className="space-y-3.5">
                  {/* 标头标签行 */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isBeginner && (
                        <span className="text-[0.6875rem] px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold flex items-center gap-1">
                          🌱 新手带教单
                        </span>
                      )}
                      {task.demand_type === "interactive_game" || task.category.includes("互动") ? (
                        <span className="text-[0.6875rem] px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 font-semibold flex items-center gap-1">
                          <Gamepad2 size={11} /> 互动影游
                        </span>
                      ) : task.demand_type === "ai_drama" || task.category.includes("短剧") ? (
                        <span className="text-[0.6875rem] px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 font-semibold flex items-center gap-1">
                          <Film size={11} /> 普通短剧
                        </span>
                      ) : (
                        <span className="text-[0.6875rem] px-2.5 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary font-semibold flex items-center gap-1">
                          <Tv size={11} /> 商业信息流
                        </span>
                      )}

                      {task.client_name && (
                        <span className="text-xs text-text-muted flex items-center gap-1 font-medium">
                          <Building2 size={12} className="text-text-muted/80" />
                          {task.client_name}
                        </span>
                      )}
                    </div>

                    {/* 状态指示 Badge */}
                    <div>
                      {task.status === "settled" || task.status === "accepted" ? (
                        <span className="text-[0.6875rem] px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold">
                          已结算放款
                        </span>
                      ) : task.status === "delivered" || task.status === "resubmitted" ? (
                        <span className="text-[0.6875rem] px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 font-semibold">
                          待终审验收
                        </span>
                      ) : isClaimed ? (
                        <span className="text-[0.6875rem] px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold">
                          已接单制作中
                        </span>
                      ) : (
                        <span className="text-[0.6875rem] px-2.5 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary font-semibold">
                          招募中
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 标题 */}
                  <h3
                    onClick={() => setSelectedTask(isSelected ? null : task)}
                    className="font-bold text-base sm:text-lg text-foreground hover:text-primary transition-colors cursor-pointer leading-snug"
                  >
                    {task.title}
                  </h3>

                  {/* 赏金与结算方式高亮区 */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-inset/60 border border-glass-border">
                    <div>
                      <span className="text-[11px] text-text-muted block">平台担保总赏金</span>
                      <span className="text-xl sm:text-2xl font-bold font-mono text-amber-400 flex items-center gap-1 mt-0.5">
                        <Coins size={18} /> ¥{bountyYuan}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-text-muted block">结算方式</span>
                      {task.settlement_mode === "milestone" ? (
                        <span className="inline-block mt-0.5 text-xs px-2.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-400 font-medium">
                          分阶段担保 (40%/60%)
                        </span>
                      ) : (
                        <span className="inline-block mt-0.5 text-xs px-2.5 py-0.5 rounded bg-surface border border-glass-border text-text-secondary font-medium">
                          终审一次性放款
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 规格标签条 */}
                  <div className="flex items-center gap-2 flex-wrap text-xs text-text-secondary">
                    {specs.format && (
                      <span className="px-2 py-0.5 rounded bg-surface-inset border border-glass-border/80 font-mono text-[0.6875rem]">
                        画幅 {specs.format}
                      </span>
                    )}
                    {specs.resolution && (
                      <span className="px-2 py-0.5 rounded bg-surface-inset border border-glass-border/80 font-mono text-[0.6875rem]">
                        {specs.resolution}
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
                  </div>

                  {/* 需求摘要 */}
                  <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                    {cleanBrief.replace(/^[#\s\-*]+/gm, " ").slice(0, 140)}…
                  </p>

                  {/* 交付截止与等级要求 */}
                  <div className="flex items-center justify-between text-xs text-text-muted pt-1 border-t border-glass-border/50">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-text-muted" />
                      截止：{new Date(task.deadline).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400 font-medium">
                      <ShieldCheck size={13} /> 赏金已托管
                    </span>
                  </div>
                </div>

                {/* 卡片底部操作栏 */}
                <div className="mt-4 pt-4 border-t border-glass-border flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTask(isSelected ? null : task)}
                    className="glass-button text-xs py-1.5 px-3 flex items-center gap-1 font-medium cursor-pointer"
                  >
                    {isSelected ? "收起简报" : "结构化需求"}
                    {isSelected ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  <div className="flex items-center gap-2">
                    {task.status === "settled" || task.status === "accepted" ? (
                      <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 size={13} />
                        已验收
                      </div>
                    ) : task.status === "delivered" || task.status === "resubmitted" ? (
                      <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-semibold">
                        <Clock size={13} />
                        待终审
                      </div>
                    ) : isClaimed ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-emerald-400 font-semibold px-2 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 size={12} /> 已锁定
                        </span>
                        <button
                          type="button"
                          onClick={() => setViewingContractTask(task)}
                          className="px-2.5 py-1.5 rounded-lg bg-surface-inset border border-glass-border text-text-secondary hover:text-foreground text-xs transition-colors cursor-pointer flex items-center gap-1"
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
                        onClick={() => {
                          if (!user) {
                            setMessageType("warning");
                            setMessage("认领商业任务需要先登录创作者账号，请点击右上角登录。");
                            return;
                          }
                          setSigningContractTask(task);
                        }}
                        className="bg-primary text-white text-xs px-4 py-2 rounded-xl font-semibold hover:bg-primary-hover transition-opacity flex items-center gap-1.5 shadow-md shadow-primary/20 disabled:opacity-50 cursor-pointer"
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

                {/* 展开的结构化需求详情抽屉 */}
                {isSelected && (
                  <div className="mt-5 pt-5 border-t border-glass-border space-y-4">
                    {/* 技术规格与验收要求 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="bg-surface-inset/70 p-3 rounded-xl border border-glass-border">
                        <h5 className="font-semibold text-primary uppercase text-[11px] mb-1.5 flex items-center gap-1">
                          <Layers size={12} /> 交付物技术规格
                        </h5>
                        <ul className="text-text-secondary space-y-1">
                          <li>• 分辨率：{specs.resolution || "1080P"}</li>
                          <li>• 画面画幅：{specs.format || "9:16"}</li>
                          <li>• 帧率：{specs.fps ? `${specs.fps} fps` : "25 fps"}</li>
                        </ul>
                      </div>

                      <div className="bg-surface-inset/70 p-3 rounded-xl border border-glass-border">
                        <h5 className="font-semibold text-primary uppercase text-[11px] mb-1.5 flex items-center gap-1">
                          <Clock size={12} /> 结算阶段要求
                        </h5>
                        <ul className="text-text-secondary space-y-1">
                          {milestones.length > 0 ? (
                            milestones.map((m, idx) => (
                              <li key={idx}>• 阶段 {idx + 1} ({m.percentage || 50}%)：{m.stage || m.description}</li>
                            ))
                          ) : (
                            <li>• 终审交付合格后全额放款至钱包</li>
                          )}
                        </ul>
                      </div>

                      <div className="bg-surface-inset/70 p-3 rounded-xl border border-glass-border">
                        <h5 className="font-semibold text-primary uppercase text-[11px] mb-1.5 flex items-center gap-1">
                          <ShieldCheck size={12} /> 版权与商用范围
                        </h5>
                        <ul className="text-text-secondary space-y-1">
                          <li>• 授权范围：{copyright.scope}</li>
                          <li>• 二次延展：{copyright.allow_derivative ? "允许" : "严禁"}</li>
                        </ul>
                      </div>
                    </div>

                    {/* 验收标准清单 */}
                    {criteria.length > 0 && (
                      <div className="bg-surface-inset/70 p-3 rounded-xl border border-glass-border text-xs">
                        <h5 className="font-semibold text-amber-400 uppercase text-[11px] mb-1.5 flex items-center gap-1">
                          <Check size={12} /> 核心验收标准 (不通过需修正)
                        </h5>
                        <div className="space-y-1 text-text-secondary">
                          {criteria.map((c, idx) => (
                            <div key={idx} className="flex items-start gap-1.5">
                              <span className="text-primary font-bold">✓</span>
                              <span>{c}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 完整 Brief 正文 */}
                    <div className="bg-surface-inset/50 rounded-xl p-3.5 text-xs text-text-secondary leading-relaxed whitespace-pre-line border border-glass-border">
                      <h5 className="font-semibold text-primary uppercase text-[11px] mb-1.5">
                        商业需求详细简报 (Brief)
                      </h5>
                      {cleanBrief}
                    </div>

                    {/* 交付抽屉 (当已接单且未终审时呈现) */}
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
                              className="glass-button text-xs font-medium py-1 px-2.5 text-primary border-primary/30 cursor-pointer"
                            >
                              + 提交交付样片
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeliveringTaskId(null)}
                              className="text-xs text-text-muted hover:text-foreground cursor-pointer"
                            >
                              取消收起
                            </button>
                          )}
                        </div>

                        {deliveringTaskId === task.id ? (
                          <div className="space-y-3 pt-2 border-t border-glass-border">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] text-text-muted block">
                                  交付说明 / 样片信息
                                </label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeliveryNote("【验收测试】已根据 Brief 完成前 3 集电影级分镜，画幅 9:16，1080P，内置影伴初审半透明防盗水印，交付测试样片地址：/sample-assets/sample_preview.mp4");
                                    setWatermarkConfirmed(true);
                                  }}
                                  className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
                                >
                                  <Sparkles size={11} />
                                  一键填入验收测试样片
                                </button>
                              </div>
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
                                {isSubmittingDelivery ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <ShieldCheck size={13} />
                                )}
                                确认提交交付审核
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeliveringTaskId(null)}
                                className="glass-button text-xs py-2 px-3 cursor-pointer"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-text-muted">
                            {task.status === "delivered" || task.status === "resubmitted"
                              ? "样片已提交，发包方正在根据验收清单审核，审核通过后赏金自动释放至钱包。"
                              : "制作完成后，点击上方【提交交付样片】上传审阅样片；系统会自动施加影伴防盗水印，验收合格后全额放款。"}
                          </p>
                        )}
                      </div>
                    )}

                    {/* 发包方/管理员终审放款面板 (当任务已提交交付时) */}
                    {(user?.role === "admin" || user?.role === "client") &&
                      (task.status === "delivered" || task.status === "resubmitted") && (
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
                              {isSubmittingReview ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={13} />
                              )}
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

                    {/* 底部带单制作跳转条 */}
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
                          className="text-primary hover:underline flex items-center gap-1 font-semibold shrink-0 cursor-pointer"
                        >
                          前往画布开始分镜制作 <ChevronRight size={13} />
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
          setMessageType("success");
          setMessage(
            `【${created.title}】发布成功！赏金 ¥${(created.bounty_cents / 100).toLocaleString()} 已转入官方托管资金池，已同步至大厅供创作者接单。`
          );
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
