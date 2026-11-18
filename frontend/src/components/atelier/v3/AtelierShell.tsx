"use client";

import * as React from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { CommentNode } from "./CommentNode";
import { IdeaNode } from "./IdeaNode";
import { MediaNode } from "./MediaNode";
import { PlanNode, type PlanStep } from "./PlanNode";
import { RegionFrame, type RegionColor } from "./RegionFrame";
import { RegionMembershipControls } from "./RegionMembershipControls";
import { ReferenceControls } from "./ReferenceControls";
import { MediaUploadButton } from "./MediaUploadButton";
import { GenerationPanel } from "./GenerationPanel";
import { MediaComposer } from "./MediaComposer";
import { AgentTurnPanel } from "./AgentTurnPanel";
import { SequenceWorkbench } from "./SequenceWorkbench";
import { ProjectPackageControls } from "./ProjectPackageControls";
import { WorkflowsPanel } from "./WorkflowsPanel";
import {
  WORKFLOW_TEMPLATE_MIME,
  getBuiltInWorkflowTemplate,
  validateBuiltInWorkflowTemplate,
  type WorkflowTemplate,
} from "./workflowTemplates";
import { toMediaNodeView } from "./types";
import { useAtelierStore } from "@/store/atelierStore";
import { getRuntimeEnvironment, subscribeRuntimeEnvironment } from "@/lib/runtimeEnvironment";
import {
  ATELIER_MEDIA_RENDERED_BOUNDS,
  buildReferenceLinks,
  canAttachAtelierReference,
  findOpenAtelierCanvasPosition,
  getAtelierCanvasNodeData,
  getAtelierCanvasPlacementRects,
  getAtelierPendingReferenceNodes,
  getAtelierReferenceMediaUrls,
  getAtelierReferenceNodeIds,
  hasAtelierNodeActiveExecution,
  resolveAtelierReferenceMedia,
} from "@/lib/atelierCanvas";
import { ATELIER_IMAGE_UPLOAD_ACCEPT, ATELIER_UPLOAD_ACCEPT, getAtelierUploadKind } from "@/lib/atelierUploadApi";
import type { AtelierNode, JsonValue, JsonRecord } from "@/lib/atelierTypes";
import { Sparkles, X, Check, ShieldCheck, Clock, Layers, Coins, Plus, FileText, Gamepad2, Film, Play, Download, Box, SplitSquareVertical, FileSpreadsheet } from "lucide-react";
import { InteractiveSimulatorModal } from "./InteractiveSimulatorModal";
import { InteractiveBranchConfig } from "./InteractiveBranchConfig";
import ClayWipeCompareModal from "./ClayWipeCompareModal";
import StoryboardBatchImportModal, { type ParsedStoryboardShot } from "./StoryboardBatchImportModal";
import {
  buildCanvasInteractiveLinks,
  computeBranchBezierPath,
  getInteractiveBranchData,
  type InteractiveBranchLink,
} from "@/lib/interactiveDrama";
import "./atelier-v3.css";

type ShellOwner = {
  key: string;
  generation: number;
  projectId: string | null;
  session: number;
};

type Draft = {
  owner: string | null;
  title: string;
  prompt: string;
  body: string;
};

type DragState = {
  owner: ShellOwner;
  nodeId: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
  mode: "move" | "resize";
  handle?: "nw" | "ne" | "sw" | "se";
};

type PanState = {
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
};

type Preview = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

type WorkflowNotice = {
  owner: string;
  kind: "success" | "partial" | "error";
  text: string;
};

type CanvasLink = {
  key: string;
  from: AtelierNode;
  to: AtelierNode;
  pending: boolean;
  stale?: boolean;
};

const REGION_COLORS = new Set<RegionColor>(["default", "cyan", "rose", "amber", "violet", "emerald", "slate"]);

function stringValue(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function boolValue(value: JsonValue | undefined): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function bodyOf(node: AtelierNode | null): string {
  return stringValue(node?.data?.body) ?? node?.prompt ?? "";
}

function authorOf(node: AtelierNode): string | undefined {
  return stringValue(node.data?.author);
}

function regionColorOf(node: AtelierNode): RegionColor {
  const color = stringValue(node.data?.color);
  return color && REGION_COLORS.has(color as RegionColor) ? color as RegionColor : "default";
}

function collapsedOf(node: AtelierNode | null | undefined): boolean {
  return boolValue(node?.data?.collapsed) ?? false;
}

function draftOwner(owner: ShellOwner, nodeId: string | null | undefined): string | null {
  return owner.projectId && nodeId ? `${ownerKey(owner)}:${nodeId}` : null;
}

function ownerKey(owner: ShellOwner): string {
  return `${owner.key}:${owner.generation}:${owner.projectId ?? ""}:${owner.session}`;
}

function shellOwnerFromSnapshot(environment: ReturnType<typeof getRuntimeEnvironment>, projectId: string | null | undefined, session: number): ShellOwner | null {
  if (!environment) return null;
  return { key: environment.key, generation: environment.generation, projectId: projectId ?? null, session };
}

function commandButtonClass(disabled: boolean): string {
  return `rounded-xl border px-3 py-2 text-sm transition ${disabled
    ? "cursor-not-allowed border-white/[0.06] bg-white/[0.03] text-white/30"
    : "border-white/[0.1] bg-white/[0.06] text-white/75 hover:border-white/[0.18] hover:bg-white/[0.1] hover:text-white"}`;
}

function fieldClass(): string {
  return "w-full rounded-xl border border-white/[0.1] bg-black/35 px-3 py-2 text-sm text-white/80 outline-none transition focus:border-white/25";
}

function nextCanvasPosition(nodes: AtelierNode[] | undefined, width: number, height: number, startX = 80, startY = 96): { x: number; y: number; width: number; height: number } {
  return {
    ...findOpenAtelierCanvasPosition(getAtelierCanvasPlacementRects(nodes ?? []), { width, height }, { startX, startY }),
    width,
    height,
  };
}

function isBodyNodeType(type: string | null | undefined): boolean {
  return type === "idea" || type === "comment";
}

function isBodyNode(node: AtelierNode | null): boolean {
  return isBodyNodeType(node?.type);
}

function stringArrayValue(value: JsonValue | undefined): string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string") ? value : [];
}

function planStepsValue(value: JsonValue | undefined): PlanStep[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const steps: PlanStep[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
    const record = item as Record<string, JsonValue | undefined>;
    if (typeof record.id !== "string" || typeof record.title !== "string") return undefined;
    if (record.status !== "pending" && record.status !== "in_progress" && record.status !== "completed") return undefined;
    const step: PlanStep = { id: record.id, title: record.title, status: record.status };
    if (typeof record.notes === "string") step.notes = record.notes;
    steps.push(step);
  }
  return steps;
}

function buildCanvasReferenceLinks(nodes: AtelierNode[]): CanvasLink[] {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const resolved = buildReferenceLinks(nodes).map(link => ({
    key: `resolved:${link.key}`,
    from: link.from,
    to: link.to,
    pending: false,
    stale: link.stale,
  }));
  const pending: CanvasLink[] = [];
  for (const target of nodes) {
    for (const reference of getAtelierPendingReferenceNodes(target)) {
      const source = byId.get(reference.source_node_id);
      if (!source || source.type !== reference.source_kind || !canAttachAtelierReference(target, source)) continue;
      pending.push({ key: `pending:${source.id}:${target.id}`, from: source, to: target, pending: true });
    }
  }
  return [...resolved, ...pending];
}

function canvasPointFromDrop(event: React.DragEvent, viewport: HTMLDivElement | null, pan: { x: number; y: number }, zoom: number): { x: number; y: number } {
  const rect = viewport?.getBoundingClientRect();
  if (!rect || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return { x: 80, y: 96 };
  return { x: (event.clientX - rect.left - pan.x) / zoom, y: (event.clientY - rect.top - pan.y) / zoom };
}

function resizePreview(drag: DragState, dx: number, dy: number): Preview {
  const minWidth = 120;
  const minHeight = 80;
  if (drag.handle === "nw") {
    const width = Math.max(minWidth, drag.width - dx);
    const height = Math.max(minHeight, drag.height - dy);
    return { x: drag.startX + drag.width - width, y: drag.startY + drag.height - height, width, height };
  }
  if (drag.handle === "ne") {
    const width = Math.max(minWidth, drag.width + dx);
    const height = Math.max(minHeight, drag.height - dy);
    return { y: drag.startY + drag.height - height, width, height };
  }
  if (drag.handle === "sw") {
    const width = Math.max(minWidth, drag.width - dx);
    const height = Math.max(minHeight, drag.height + dy);
    return { x: drag.startX + drag.width - width, width, height };
  }
  return { width: Math.max(minWidth, drag.width + dx), height: Math.max(minHeight, drag.height + dy) };
}

export function resolveNodeRenderAndClay(node: AtelierNode, allNodes: AtelierNode[]): { renderUrl: string | null; clayUrl: string | null } {
  // 1. Resolve Render URL (the final/generated media of this node)
  const renderUrl =
    resolveAtelierReferenceMedia(node) ||
    node.media_urls?.[0] ||
    (node as any).media_url ||
    (typeof node.data?.media_url === "string" ? node.data.media_url : null) ||
    (typeof node.data?.video_url === "string" ? node.data.video_url : null) ||
    null;

  // 2. Resolve Clay URL (upstream reference, 3D previz, or direct reference image/video)
  const canvasData = getAtelierCanvasNodeData(node);
  const directRef =
    canvasData.reference_image_urls?.[0] ||
    canvasData.reference_video_urls?.[0] ||
    (node as any).reference_image_urls?.[0] ||
    (typeof (node.data as any)?.clay_url === "string" ? (node.data as any).clay_url : null) ||
    (typeof (node as any)?.clay_url === "string" ? (node as any).clay_url : null) ||
    null;

  let upstreamRefMedia: string | null = null;
  const refNodeIds = getAtelierReferenceNodeIds(node);
  for (const refId of refNodeIds) {
    const srcNode = allNodes.find(n => n.id === refId);
    if (srcNode) {
      const srcMedia = resolveAtelierReferenceMedia(srcNode) || srcNode.media_urls?.[0] || (srcNode as any).media_url;
      if (srcMedia) {
        upstreamRefMedia = srcMedia;
        break;
      }
    }
  }

  if (!upstreamRefMedia) {
    const pendingNodes = (canvasData as any).pending_reference_nodes;
    if (Array.isArray(pendingNodes)) {
      for (const pending of pendingNodes) {
        const srcNode = allNodes.find(n => n.id === pending?.source_node_id);
        if (srcNode) {
          const srcMedia = resolveAtelierReferenceMedia(srcNode) || srcNode.media_urls?.[0] || (srcNode as any).media_url;
          if (srcMedia) {
            upstreamRefMedia = srcMedia;
            break;
          }
        }
      }
    }
  }

  const clayUrl = directRef || upstreamRefMedia || null;
  return { renderUrl, clayUrl };
}

export const CLAY_STYLE_PRESETS = [
  {
    id: "ue5_scifi",
    name: "UE5 次世代科幻",
    promptSnippet: "遵循参考白模几何遮挡与构图透视，Unreal Engine 5 Nanite超清金属拉丝与高分子聚合物材质，次表面散射，8K超清光追反射，去除石膏白模塑料感",
  },
  {
    id: "panavision_35mm",
    name: "35mm 胶片电影",
    promptSnippet: "严格保留白模机位与景深，Shot on 35mm Panavision变形镜头，Kodak Vision3真实胶片颗粒与质感，自然电影级边缘光，去除任何3D建模假感",
  },
  {
    id: "oriental_xianxia",
    name: "东方仙侠奇幻",
    promptSnippet: "遵循白模场景空间构图，真丝古风刺绣绫罗绸缎质感，晨雾弥漫与柔和仙侠丁达尔光效，超精细皮肤纹理与发丝光泽，真实影视级实景渲染",
  },
  {
    id: "cyberpunk_neon",
    name: "赛博霓虹雨夜",
    promptSnippet: "保留白模几何轮廓与建筑机位，雨夜湿漉沥青反光地面，品红与青蓝高饱和霓虹招牌反光，皮革外套做旧磨损纹理，高对比度赛博朋克光影",
  },
  {
    id: "hyperreal_cg",
    name: "超写实 CG 动画",
    promptSnippet: "保留白模角色体态与动作姿态，Pixar与工业光魔级3D动画材质，细腻环境光遮蔽(AO)，生动微表情与柔和摄影棚三点布光，院线动画质感",
  },
];

export function AtelierShell() {
  const t = useTranslations("atelier.foundation");
  const projects = useAtelierStore(state => state.projects);
  const currentProject = useAtelierStore(state => state.currentProject);
  const selectedNodeId = useAtelierStore(state => state.selectedNodeId);
  const isLoading = useAtelierStore(state => state.isLoading);
  const isSaving = useAtelierStore(state => state.isSaving);
  const needsRefresh = useAtelierStore(state => state.needsRefresh);
  const error = useAtelierStore(state => state.error);
  const ensureProject = useAtelierStore(state => state.ensureProject);
  const createProject = useAtelierStore(state => state.createProject);
  const loadProjects = useAtelierStore(state => state.loadProjects);
  const switchProject = useAtelierStore(state => state.switchProject);
  const refreshProject = useAtelierStore(state => state.refreshProject);
  const createNode = useAtelierStore(state => state.createNode);
  const updateNodeText = useAtelierStore(state => state.updateNodeText);
  const updateNodeLayout = useAtelierStore(state => state.updateNodeLayout);
  const updateRegionAppearance = useAtelierStore(state => state.updateRegionAppearance);
  const moveNodes = useAtelierStore(state => state.moveNodes);
  const wrapRegion = useAtelierStore(state => state.wrapRegion);
  const deleteNodes = useAtelierStore(state => state.deleteNodes);
  const restoreNodes = useAtelierStore(state => state.restoreNodes);
  const attachPendingReferenceNode = useAtelierStore(state => state.attachPendingReferenceNode);
  const attachReferenceNode = useAtelierStore(state => state.attachReferenceNode);
  const detachReferenceNode = useAtelierStore(state => state.detachReferenceNode);
  const createMediaNode = useAtelierStore(state => state.createMediaNode);
  const uploadReference = useAtelierStore(state => state.uploadReference);
  const pendingUploads = useAtelierStore(state => state.pendingUploads);
  const pendingGenerations = useAtelierStore(state => state.pendingGenerations);
  const loadPendingUploads = useAtelierStore(state => state.loadPendingUploads);
  const loadPendingGenerations = useAtelierStore(state => state.loadPendingGenerations);
  const readbackPendingUpload = useAtelierStore(state => state.readbackPendingUpload);
  const readbackPendingGeneration = useAtelierStore(state => state.readbackPendingGeneration);
  const createImageCandidate = useAtelierStore(state => state.createImageCandidate);
  const createAudioCandidate = useAtelierStore(state => state.createAudioCandidate);
  const refreshGenerationAttempt = useAtelierStore(state => state.refreshGenerationAttempt);
  const continueGenerationAttempt = useAtelierStore(state => state.continueGenerationAttempt);
  const cancelGenerationAttempt = useAtelierStore(state => state.cancelGenerationAttempt);
  const saveMediaGenerationDraft = useAtelierStore(state => state.saveMediaGenerationDraft);
  const selectMediaGenerationCandidate = useAtelierStore(state => state.selectMediaGenerationCandidate);
  const setMediaGenerationCandidateVisibility = useAtelierStore(state => state.setMediaGenerationCandidateVisibility);
  const selectNode = useAtelierStore(state => state.selectNode);

  const [localError, setLocalError] = useState<string | null>(null);
  const [uploadJournalError, setUploadJournalError] = useState<{ owner: string; text: string } | null>(null);
  const [checkingUpload, setCheckingUpload] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<{ owner: string; text: string } | null>(null);
  const [workflowNotice, setWorkflowNotice] = useState<WorkflowNotice | null>(null);
  const [workflowsOpen, setWorkflowsOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ owner: null, title: "", prompt: "", body: "" });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [preview, setPreview] = useState<Record<string, Preview>>({});
  const [activeCommercialTask, setActiveCommercialTask] = useState<{
    id: string;
    title: string;
    bounty_cents: number;
    client_name?: string;
    category?: string;
    level_tier?: string;
    settlement_mode?: string;
    brief_markdown: string;
    deliverable_specs_json?: string;
    milestone_specs_json?: string;
    acceptance_criteria_json?: string;
    copyright_terms_json?: string;
  } | null>(null);
  const [showTaskBriefModal, setShowTaskBriefModal] = useState(false);
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);
  const [showBatchImportModal, setShowBatchImportModal] = useState(false);
  const [wipeCompareData, setWipeCompareData] = useState<{
    open: boolean;
    renderUrl: string;
    renderKind: "video" | "image";
    clayUrl: string;
    clayKind: "video" | "image";
    title?: string;
  } | null>(null);
  const [selectedClayPreset, setSelectedClayPreset] = useState<string>("ue5_scifi");
  const [canvasProductionMode, setCanvasProductionMode] = useState<"linear" | "interactive">("linear");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.sessionStorage.getItem("active_commercial_task");
      if (stored) {
        const parsed = JSON.parse(stored);
        setActiveCommercialTask(parsed);
        if (parsed.demand_type === "interactive_game" || parsed.category?.includes("互动")) {
          setCanvasProductionMode("interactive");
        }
      }
    } catch {
      // ignore
    }
  }, []);
  const [interactionSession, setInteractionSession] = useState(0);
  const sessionRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const workflowInsertRef = useRef(false);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const canvasToolbarRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const [layoutEpoch, setLayoutEpoch] = useState(0);
  const runtimeEnvironment = useSyncExternalStore(subscribeRuntimeEnvironment, getRuntimeEnvironment, getRuntimeEnvironment);

  useLayoutEffect(() => {
    let frame = 0;
    const bump = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; setLayoutEpoch(epoch => epoch + 1); });
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(bump);
    if (canvasViewportRef.current) observer?.observe(canvasViewportRef.current);
    if (canvasToolbarRef.current) observer?.observe(canvasToolbarRef.current);
    if (inspectorRef.current) observer?.observe(inspectorRef.current);
    window.addEventListener("resize", bump);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", bump);
    };
  }, []);

  const selectedNode = useMemo(
    () => currentProject?.nodes.find(node => node.id === selectedNodeId) ?? null,
    [currentProject, selectedNodeId],
  );
  const shellOwner = useMemo(() => shellOwnerFromSnapshot(runtimeEnvironment, currentProject?.id, interactionSession), [currentProject?.id, interactionSession, runtimeEnvironment]);
  const shellOwnerId = shellOwner ? ownerKey(shellOwner) : "no-runtime";
  const selectedOwner = shellOwner ? draftOwner(shellOwner, selectedNode?.id) : null;
  const selectedComposerLayout = useMemo(() => {
    void layoutEpoch;
    if (!selectedNode || (selectedNode.type !== "video" && selectedNode.type !== "image" && selectedNode.type !== "audio")) return { rect: null, availableRect: null };
    const viewport = canvasViewportRef.current?.getBoundingClientRect();
    if (!viewport) return { rect: null, availableRect: null };
    const toolbar = canvasToolbarRef.current?.getBoundingClientRect();
    const availableTop = Math.max(viewport.top, toolbar && toolbar.bottom > viewport.top ? toolbar.bottom + 12 : viewport.top);
    return {
      rect: {
        left: viewport.left + pan.x + selectedNode.x * zoom,
        top: viewport.top + pan.y + selectedNode.y * zoom,
        width: selectedNode.width * zoom,
        height: selectedNode.height * zoom,
      },
      availableRect: {
        left: viewport.left,
        top: availableTop,
        width: viewport.width,
        height: Math.max(0, viewport.top + viewport.height - availableTop),
      },
    };
  }, [layoutEpoch, pan.x, pan.y, selectedNode, zoom]);
  const writeDisabled = isSaving || isLoading || needsRefresh || !currentProject || !shellOwner;
  const uploadDisabled = writeDisabled || pendingUploads.length > 0;
  const selectedNodeUploadBlocked = !!selectedNode && hasAtelierNodeActiveExecution(selectedNode);
  const unconsumedReceipts = currentProject?.node_delete_receipts.filter(receipt => receipt.restored_at === null) ?? [];
  const canvasLinks = useMemo(() => buildCanvasReferenceLinks(currentProject?.nodes ?? []), [currentProject?.nodes]);
  const interactiveLinks = useMemo(() => (currentProject ? buildCanvasInteractiveLinks(currentProject.nodes) : []), [currentProject]);
  const workflowNoticeText = workflowNotice?.owner === shellOwnerId ? workflowNotice.text : null;

  const bumpInteractionSession = useCallback(() => {
    sessionRef.current += 1;
    setInteractionSession(sessionRef.current);
  }, []);

  const isCurrentOwner = useCallback((owner: ShellOwner) => {
    try {
      const current = shellOwnerFromSnapshot(getRuntimeEnvironment(), useAtelierStore.getState().currentProject?.id ?? null, sessionRef.current);
      return !!current && current.key === owner.key && current.generation === owner.generation && current.projectId === owner.projectId && current.session === owner.session;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    return subscribeRuntimeEnvironment(() => {
      dragRef.current = null;
      panRef.current = null;
      setPreview({});
      setLocalError(null);
      bumpInteractionSession();
    });
  }, [bumpInteractionSession]);

  useEffect(() => {
    dragRef.current = null;
    setPreview({});
  }, [shellOwnerId]);

  useEffect(() => {
    if (!shellOwner?.projectId) return;
    const refresh = () => {
      try {
        loadPendingUploads();
        loadPendingGenerations();
        if (isCurrentOwner(shellOwner)) setUploadJournalError(null);
      } catch (cause) {
        if (isCurrentOwner(shellOwner)) setUploadJournalError({ owner: ownerKey(shellOwner), text: cause instanceof Error ? cause.message : t("uploadError") });
      }
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); };
  }, [isCurrentOwner, loadPendingGenerations, loadPendingUploads, shellOwner, t]);

  useEffect(() => {
    let alive = true;
    const owner = shellOwner;
    if (!owner) return () => { alive = false; };
    ensureProject().catch(err => {
      if (alive && isCurrentOwner(owner)) setLocalError(err instanceof Error ? err.message : String(err));
    });
    return () => { alive = false; };
  }, [ensureProject, isCurrentOwner, shellOwner]);

  useEffect(() => {
    if (draft.owner === selectedOwner) return;
    setDraft({
      owner: selectedOwner,
      title: selectedNode?.title ?? "",
      prompt: selectedNode?.prompt ?? "",
      body: bodyOf(selectedNode),
    });
  }, [draft.owner, selectedNode, selectedOwner]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const panDrag = panRef.current;
      if (panDrag) {
        setPan({ x: panDrag.startX + event.clientX - panDrag.startClientX, y: panDrag.startY + event.clientY - panDrag.startClientY });
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      const dx = (event.clientX - drag.startClientX) / zoom;
      const dy = (event.clientY - drag.startClientY) / zoom;
      let next: Preview;
      if (drag.mode === "move") {
        next = { x: drag.startX + dx, y: drag.startY + dy };
        const project = useAtelierStore.getState().currentProject;
        const regionMembers = project?.nodes.filter(child => stringValue(child.data?.region_id) === drag.nodeId) ?? [];
        setPreview(prev => {
          const copy = { ...prev, [drag.nodeId]: next };
          for (const child of regionMembers) copy[child.id] = { x: child.x + dx, y: child.y + dy };
          return copy;
        });
        return;
      }
      next = resizePreview(drag, dx, dy);
      setPreview(prev => ({ ...prev, [drag.nodeId]: next }));
    };
    const onUp = () => {
      if (panRef.current) {
        panRef.current = null;
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      const next = preview[drag.nodeId];
      setPreview(prev => {
        const copy = { ...prev };
        delete copy[drag.nodeId];
        const project = useAtelierStore.getState().currentProject;
        for (const child of project?.nodes.filter(item => stringValue(item.data?.region_id) === drag.nodeId) ?? []) delete copy[child.id];
        return copy;
      });
      if (!next || writeDisabled || !isCurrentOwner(drag.owner)) return;
      const request = drag.mode === "move" && useAtelierStore.getState().currentProject?.nodes.find(node => node.id === drag.nodeId)?.type === "region"
        ? moveNodes({ nodeIds: [drag.nodeId], dx: (next.x ?? drag.startX) - drag.startX, dy: (next.y ?? drag.startY) - drag.startY })
        : updateNodeLayout(drag.nodeId, next);
      request.catch(err => {
        if (isCurrentOwner(drag.owner)) setLocalError(err instanceof Error ? `${t("layoutError")}: ${err.message}` : t("layoutError"));
      });
    };
    const onCancel = () => {
      dragRef.current = null;
      panRef.current = null;
      setPreview({});
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [isCurrentOwner, moveNodes, preview, t, updateNodeLayout, writeDisabled, zoom]);

  const beginDrag = useCallback((node: AtelierNode, event: React.PointerEvent, mode: "move" | "resize" = "move", handle?: DragState["handle"]) => {
    const target = event.target as HTMLElement;
    if (target.closest("button,input,textarea,select,a")) return;
    selectNode(node.id);
    if (writeDisabled) return;
    const owner = shellOwnerFromSnapshot(getRuntimeEnvironment(), currentProject?.id, sessionRef.current);
    if (!owner) return;
    dragRef.current = {
      owner,
      nodeId: node.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: node.x,
      startY: node.y,
      width: node.width,
      height: node.height,
      mode,
      handle,
    };
  }, [currentProject?.id, selectNode, writeDisabled]);

  const run = useCallback(async (action: (owner: ShellOwner) => Promise<unknown>, fallback: string) => {
    const owner = shellOwnerFromSnapshot(getRuntimeEnvironment(), useAtelierStore.getState().currentProject?.id ?? null, sessionRef.current);
    if (!owner) {
      setLocalError(fallback);
      return;
    }
    setLocalError(null);
    try {
      await action(owner);
    } catch (err) {
      if (isCurrentOwner(owner)) setLocalError(err instanceof Error ? `${fallback}: ${err.message}` : fallback);
    }
  }, [isCurrentOwner]);

  const createNodeAndSelect = useCallback((type: "idea" | "comment" | "image" | "video" | "audio") => {
    void run(async owner => {
      const index = (currentProject?.nodes.length ?? 0) + 1;
      const layout = nextCanvasPosition(currentProject?.nodes, type === "video" ? 220 : 260, type === "video" ? 124 : type === "audio" ? 96 : 160);
      const titleKey = type === "idea" ? "createIdea" : type === "comment" ? "createComment" : type === "image" ? "createImage" : type === "video" ? "createVideo" : "createAudio";
      const ack = await createNode({
        type,
        title: `${t(titleKey)} ${index}`,
        prompt: "",
        body: type === "idea" || type === "comment" ? "" : null,
        ...layout,
      });
      if (isCurrentOwner(owner) && useAtelierStore.getState().currentProject?.id === ack.project.id) selectNode(ack.node_ids[0] ?? null);
    }, t("createError"));
  }, [createNode, currentProject?.nodes, isCurrentOwner, run, selectNode, t]);

  const createRegion = useCallback(() => {
    void run(async owner => {
      const index = (currentProject?.nodes.length ?? 0) + 1;
      const layout = nextCanvasPosition(currentProject?.nodes, 320, 180, 120, 130);
      const ack = await wrapRegion({
        title: `${t("createRegion")} ${index}`,
        memberNodeIds: [],
        ...layout,
        color: "default",
        collapsed: false,
      });
      if (isCurrentOwner(owner) && useAtelierStore.getState().currentProject?.id === ack.project.id) selectNode(ack.node_ids[0] ?? null);
    }, t("createError"));
  }, [currentProject?.nodes, isCurrentOwner, run, selectNode, t, wrapRegion]);

  const insertWorkflowTemplate = useCallback((template: WorkflowTemplate, anchor = { x: 80, y: 96 }) => {
    if (workflowInsertRef.current) return;
    const validation = validateBuiltInWorkflowTemplate(template);
    if (!validation.ok) {
      setLocalError(`${t("workflowInsertError")}: ${validation.reason}`);
      return;
    }
    workflowInsertRef.current = true;
    void run(async owner => {
      if (!isCurrentOwner(owner)) throw new Error("Atelier environment or project changed during request");
      const ownerId = ownerKey(owner);
      const localToReal = new Map<string, string>();
      let createdCount = 0;
      setWorkflowNotice(null);
      try {
        for (const item of template.nodes) {
          if (!isCurrentOwner(owner)) throw new Error("Atelier environment or project changed during request");
          const ack = await createNode({
            type: item.type,
            title: item.title,
            prompt: item.prompt ?? "",
            body: item.body ?? (isBodyNodeType(item.type) ? "" : null),
            x: anchor.x + item.x,
            y: anchor.y + item.y,
            width: item.width,
            height: item.height,
          });
          if (!isCurrentOwner(owner) || ack.project.id !== owner.projectId || useAtelierStore.getState().currentProject?.id !== owner.projectId) {
            throw new Error("Atelier environment or project changed during request");
          }
          const realId = ack.node_ids[0];
          if (!realId) throw new Error("Atelier create acknowledgement did not include a node id");
          localToReal.set(item.localId, realId);
          createdCount += 1;
        }
        for (const edge of template.edges) {
          if (!isCurrentOwner(owner)) throw new Error("Atelier environment or project changed during request");
          const sourceId = localToReal.get(edge.source);
          const targetId = localToReal.get(edge.target);
          if (!sourceId || !targetId) throw new Error("Workflow template edge target was not created");
          const project = useAtelierStore.getState().currentProject;
          const source = project?.nodes.find(node => node.id === sourceId);
          const target = project?.nodes.find(node => node.id === targetId);
          if (!project || project.id !== owner.projectId || !source || !target || !canAttachAtelierReference(target, source)) {
            throw new Error("Workflow template edge no longer matches the current project");
          }
          const ack = getAtelierReferenceMediaUrls(source).length > 0
            ? await attachReferenceNode(targetId, { sourceNodeId: sourceId })
            : await attachPendingReferenceNode(targetId, { sourceNodeId: sourceId });
          if (!isCurrentOwner(owner) || ack.project.id !== owner.projectId || useAtelierStore.getState().currentProject?.id !== owner.projectId) {
            throw new Error("Atelier environment or project changed during request");
          }
        }
        if (isCurrentOwner(owner)) {
          selectNode(localToReal.get(template.nodes[0]?.localId ?? "") ?? null);
          setWorkflowNotice({ owner: ownerId, kind: "success", text: t("workflowInsertSuccess") });
        }
      } catch (cause) {
        if (isCurrentOwner(owner)) {
          const message = cause instanceof Error ? cause.message : t("workflowInsertError");
          setWorkflowNotice({ owner: ownerId, kind: createdCount > 0 ? "partial" : "error", text: `${createdCount > 0 ? t("workflowInsertPartial") : t("workflowInsertError")}: ${message}` });
        }
        throw cause;
      }
    }, t("workflowInsertError")).finally(() => { workflowInsertRef.current = false; });
  }, [attachPendingReferenceNode, attachReferenceNode, createNode, isCurrentOwner, run, selectNode, t]);

  const dropWorkflowTemplate = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (writeDisabled) return;
    event.preventDefault();

    // 1. Workflow template drop
    if (event.dataTransfer.types.includes(WORKFLOW_TEMPLATE_MIME)) {
      const templateId = event.dataTransfer.getData(WORKFLOW_TEMPLATE_MIME);
      const template = getBuiltInWorkflowTemplate(templateId);
      if (!template) {
        setLocalError(t("workflowInsertError"));
        return;
      }
      insertWorkflowTemplate(template, canvasPointFromDrop(event, canvasViewportRef.current, pan, zoom));
      return;
    }

    // 2. Direct OS files drag-and-drop (batch image / previz frames)
    const files = Array.from(event.dataTransfer.files).filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (files.length > 0) {
      const dropPoint = canvasPointFromDrop(event, canvasViewportRef.current, pan, zoom);
      void (async () => {
        let prevNodeId: string | null = null;
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const kind = getAtelierUploadKind(file);
          const layout = {
            x: Math.round(dropPoint.x + i * 360),
            y: Math.round(dropPoint.y),
            width: ATELIER_MEDIA_RENDERED_BOUNDS[kind].width,
            height: ATELIER_MEDIA_RENDERED_BOUNDS[kind].height,
          };
          const ack = await createMediaNode({
            file,
            title: file.name.replace(/\.[^/.]+$/, ""),
            nodeType: kind,
            ...layout,
          });
          const realId = ack.node_ids[0];
          if (prevNodeId && realId) {
            const project = useAtelierStore.getState().currentProject;
            const prevNode = project?.nodes.find(n => n.id === prevNodeId);
            const currNode = project?.nodes.find(n => n.id === realId);
            if (prevNode && currNode && canAttachAtelierReference(currNode, prevNode)) {
              if (getAtelierReferenceMediaUrls(prevNode).length > 0) {
                await attachReferenceNode(realId, { sourceNodeId: prevNodeId });
              } else {
                await attachPendingReferenceNode(realId, { sourceNodeId: prevNodeId });
              }
            }
          }
          prevNodeId = realId;
        }
        setWorkflowNotice({
          owner: shellOwnerId,
          kind: "success",
          text: `已从外部直接拖拽导入 ${files.length} 个白模/参考素材并排布成链！`,
        });
      })();
    }
  }, [attachPendingReferenceNode, attachReferenceNode, createMediaNode, insertWorkflowTemplate, pan, shellOwnerId, t, writeDisabled, zoom]);

  const allowWorkflowDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (writeDisabled) return;
    if (event.dataTransfer.types.includes(WORKFLOW_TEMPLATE_MIME) || event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  }, [writeDisabled]);

  const handleBatchImportShots = useCallback(async (shots: ParsedStoryboardShot[]) => {
    if (shots.length === 0) return;
    await run(async owner => {
      if (!isCurrentOwner(owner)) throw new Error("Atelier environment or project changed during request");
      const ownerId = ownerKey(owner);
      const startX = 120;
      const startY = 160;
      let prevNodeId: string | null = null;
      let firstRealId: string | null = null;

      for (let i = 0; i < shots.length; i++) {
        const shot = shots[i];
        let clayNodeId: string | null = null;

        // If this shot has a clayUrl, create an Image node right above the video node
        if (shot.clayUrl) {
          const clayAck = await createNode({
            type: "image",
            title: `${shot.shotId}_3D白模`,
            prompt: `3D白模分镜参考：${shot.title}`,
            body: null,
            x: startX + i * 360,
            y: startY - 210,
            width: 260,
            height: 180,
          });
          clayNodeId = clayAck.node_ids[0];
          if (clayNodeId) {
            useAtelierStore.setState(state => {
              if (!state.currentProject) return state;
              return {
                currentProject: {
                  ...state.currentProject,
                  nodes: state.currentProject.nodes.map(n =>
                    n.id === clayNodeId
                      ? {
                          ...n,
                          media_urls: [shot.clayUrl!],
                          data: { ...n.data, clay_url: shot.clayUrl! } as unknown as JsonRecord,
                        }
                      : n
                  ),
                },
              };
            });
          }
        }

        const ack = await createNode({
          type: "video",
          title: `${shot.shotId} ${shot.title}`,
          prompt: shot.prompt,
          body: null,
          x: startX + i * 360,
          y: startY,
          width: 260,
          height: 180,
        });
        const realId = ack.node_ids[0];
        if (!firstRealId) firstRealId = realId;

        // If this shot has a companion clay image node, attach it as direct reference
        if (clayNodeId && realId) {
          await attachReferenceNode(realId, { sourceNodeId: clayNodeId });
        } else if (prevNodeId && realId) {
          // Otherwise chain with previous shot
          const project = useAtelierStore.getState().currentProject;
          const prevNode = project?.nodes.find(n => n.id === prevNodeId);
          const currNode = project?.nodes.find(n => n.id === realId);
          if (prevNode && currNode && canAttachAtelierReference(currNode, prevNode)) {
            const hasMedia = getAtelierReferenceMediaUrls(prevNode).length > 0;
            if (hasMedia) {
              await attachReferenceNode(realId, { sourceNodeId: prevNodeId });
            } else {
              await attachPendingReferenceNode(realId, { sourceNodeId: prevNodeId });
            }
          }
        }
        prevNodeId = realId;
      }

      if (firstRealId && isCurrentOwner(owner)) {
        selectNode(firstRealId);
        setWorkflowNotice({ owner: ownerId, kind: "success", text: `已成功批量排布 ${shots.length} 个分镜镜头节点与关联白模底图！` });
      }
    }, "分镜批量导入失败");
  }, [attachPendingReferenceNode, attachReferenceNode, createMediaNode, createNode, isCurrentOwner, run, selectNode]);

  const injectCommercialBrief = useCallback(() => {
    if (!activeCommercialTask) return;
    void run(async owner => {
      const layout = nextCanvasPosition(currentProject?.nodes, 340, 240);
      const ack = await createNode({
        type: "idea",
        title: `商单需求：${activeCommercialTask.title}`,
        prompt: `【商业Brief要求】\n${activeCommercialTask.brief_markdown}`,
        body: activeCommercialTask.brief_markdown,
        ...layout,
      });
      if (isCurrentOwner(owner) && useAtelierStore.getState().currentProject?.id === ack.project.id) {
        selectNode(ack.node_ids[0] ?? null);
      }
      setShowTaskBriefModal(false);
    }, t("createError"));
  }, [activeCommercialTask, createNode, currentProject?.nodes, isCurrentOwner, run, selectNode, t]);

  const handleScaffoldStarterTree = useCallback(() => {
    void run(async owner => {
      const startAck = await createNode({
        type: "idea",
        title: "起始镜头：雨夜旧宅",
        prompt: "雨夜雷鸣，主角在封闭公馆中苏醒，门锁已锁死，桌上有火柴与羊皮信纸。",
        body: "【抉择倒计时 10s】选项A：划火柴搜寻密室暗格 / 选项B：强行破门呼救",
        x: 100,
        y: 120,
        width: 320,
        height: 180,
      });

      await createNode({
        type: "idea",
        title: "分支A：点燃火柴搜寻暗格",
        prompt: "火光照亮书架后的转轮暗格，主角顺着暗格发现密室暗道，无声潜入。",
        body: "通向结局1：成功智取逃离，并拿到关键信物。",
        x: 480,
        y: 40,
        width: 320,
        height: 170,
      });

      await createNode({
        type: "idea",
        title: "分支B：强行破门惊动守卫",
        prompt: "剧烈的撞击声在空旷走廊回荡，巡逻守卫被惊动，拔出武器将门从外反锁并包围四周。",
        body: "通向结局2：触发警报，身陷地下暗室 (Bad End)。",
        x: 480,
        y: 240,
        width: 320,
        height: 170,
      });

      await createNode({
        type: "idea",
        title: "结局1：智取逃生 (Normal End)",
        prompt: "穿过暗室通道从废弃花园翻出公馆，雨势渐小，主角成功生还脱险。",
        body: "达成通关成就：密道生还者",
        x: 860,
        y: 40,
        width: 300,
        height: 160,
      });

      await createNode({
        type: "idea",
        title: "结局2：深陷暗室 (Bad End)",
        prompt: "警报机关被彻底锁死，地下室开始弥漫瓦斯烟雾，逃生失败。",
        body: "达成结局：深渊死锁 (Bad End)",
        x: 860,
        y: 240,
        width: 300,
        height: 160,
      });

      if (isCurrentOwner(owner) && startAck.node_ids[0]) selectNode(startAck.node_ids[0]);
    }, t("createError"));
  }, [createNode, isCurrentOwner, run, selectNode, t]);

  const handleSaveBranchConfig = useCallback((branchData: {
    isEnding: boolean;
    endingType: "normal" | "bad" | "secret";
    choices: Array<{ id: string; label: string; targetNodeId: string; timeoutSeconds: number }>;
  }) => {
    if (!selectedNode || !currentProject) return;
    useAtelierStore.setState(state => {
      if (!state.currentProject) return state;
      return {
        currentProject: {
          ...state.currentProject,
          nodes: state.currentProject.nodes.map(n =>
            n.id === selectedNode.id
              ? { ...n, data: { ...n.data, interactive: branchData } }
              : n
          ),
        },
      };
    });
  }, [currentProject, selectedNode]);

  const handleRemoveInteractiveLink = useCallback((fromNodeId: string, choiceId: string) => {
    useAtelierStore.setState(state => {
      if (!state.currentProject) return state;
      return {
        currentProject: {
          ...state.currentProject,
          nodes: state.currentProject.nodes.map(n => {
            if (n.id !== fromNodeId) return n;
            const branchData = getInteractiveBranchData(n);
            const choices = (branchData.choices || []).filter(c => c.id !== choiceId);
            return {
              ...n,
              data: {
                ...n.data,
                interactive: {
                  ...branchData,
                  choices,
                },
              } as unknown as JsonRecord,
            };
          }),
        },
      };
    });
  }, []);

  const handleCreateDownstreamBranch = useCallback((branchTitle: string) => {
    if (!selectedNode || !currentProject) return;
    void run(async owner => {
      const layout = nextCanvasPosition(currentProject.nodes, 320, 180, selectedNode.x + 360, selectedNode.y);
      const ack = await createNode({
        type: "idea",
        title: branchTitle,
        prompt: `【分支行动】${branchTitle}`,
        body: `从镜头「${selectedNode.title}」延伸出的抉择分支`,
        ...layout,
      });
      const newNodeId = ack.node_ids[0];
      if (newNodeId) {
        const branchData = getInteractiveBranchData(selectedNode);
        const choices = branchData.choices || [];
        const updatedChoices = [
          ...choices,
          {
            id: `choice-${Date.now()}`,
            label: branchTitle,
            targetNodeId: newNodeId,
            timeoutSeconds: 10,
          },
        ];
        useAtelierStore.setState(state => {
          if (!state.currentProject) return state;
          return {
            currentProject: {
              ...state.currentProject,
              nodes: state.currentProject.nodes.map(n =>
                n.id === selectedNode.id
                  ? {
                      ...n,
                      data: {
                        ...n.data,
                        interactive: {
                          ...branchData,
                          isEnding: false,
                          choices: updatedChoices,
                        },
                      } as unknown as JsonRecord,
                    }
                  : n
              ),
            },
          };
        });
        if (isCurrentOwner(owner)) selectNode(newNodeId);
      }
    }, t("createError"));
  }, [createNode, currentProject, isCurrentOwner, run, selectedNode, selectNode, t]);

  const handleAddNextStep = useCallback((fromNodeId: string) => {
    if (!currentProject) return;
    const source = currentProject.nodes.find(n => n.id === fromNodeId);
    if (!source) return;
    void run(async owner => {
      const layout = nextCanvasPosition(currentProject.nodes, 320, 180, source.x + 360, source.y);
      const isMediaSource = source.type === "image" || source.type === "video";
      const ack = await createNode({
        type: isMediaSource ? "video" : "idea",
        title: `接续：${source.title || source.id.slice(-4)}`,
        prompt: `承接镜头「${source.title || source.id}」的剧情推进与视觉风格`,
        body: `承接自「${source.title || source.id}」的后续动作`,
        ...layout,
      });
      const newNodeId = ack.node_ids[0];
      if (newNodeId) {
        // 1. 自动建立 LibTV 级生产素材引用约束 (Reference Link)
        const updatedProject = useAtelierStore.getState().currentProject;
        const targetNode = updatedProject?.nodes.find(n => n.id === newNodeId);
        if (targetNode && canAttachAtelierReference(targetNode, source)) {
          try {
            if (getAtelierReferenceMediaUrls(source).length > 0) {
              await attachReferenceNode(newNodeId, { sourceNodeId: source.id });
            } else {
              await attachPendingReferenceNode(newNodeId, { sourceNodeId: source.id });
            }
          } catch {
            // 素材关联如遇状态锁定不阻断主节点生成
          }
        }

        // 2. 自动建立互动决策与时序流向逻辑 (Interactive Choice)
        const branchData = getInteractiveBranchData(source);
        const choices = branchData.choices || [];
        const nextLetter = ["A", "B", "C", "D"][choices.length] || `${choices.length + 1}`;
        const updatedChoices = [
          ...choices,
          {
            id: `choice-${Date.now()}`,
            label: `选项${nextLetter}：走向下一步`,
            targetNodeId: newNodeId,
            timeoutSeconds: 10,
          },
        ];
        useAtelierStore.setState(state => {
          if (!state.currentProject) return state;
          return {
            currentProject: {
              ...state.currentProject,
              nodes: state.currentProject.nodes.map(n =>
                n.id === source.id
                  ? {
                      ...n,
                      data: {
                        ...n.data,
                        interactive: {
                          ...branchData,
                          isEnding: false,
                          choices: updatedChoices,
                        },
                      } as unknown as JsonRecord,
                    }
                  : n
              ),
            },
          };
        });
        if (isCurrentOwner(owner)) selectNode(newNodeId);
      }
    }, t("createError"));
  }, [attachPendingReferenceNode, attachReferenceNode, createNode, currentProject, isCurrentOwner, run, selectNode, t]);

  const handleTriggerWipeCompare = useCallback((nodeId: string) => {
    const targetNode = currentProject?.nodes.find(n => n.id === nodeId);
    if (!targetNode) return;
    const { renderUrl, clayUrl } = resolveNodeRenderAndClay(targetNode, currentProject?.nodes ?? []);

    if (renderUrl && clayUrl) {
      setWipeCompareData({
        open: true,
        renderUrl,
        renderKind: targetNode.type === "video" ? "video" : "image",
        clayUrl,
        clayKind: "image",
        title: `分镜比对: ${targetNode.title || targetNode.id}`,
      });
    } else {
      selectNode(nodeId);
      setWorkflowNotice({
        owner: shellOwnerId,
        kind: "error",
        text: renderUrl
          ? "该分镜尚未挂载白模参考图。已为您选定该节点，可在右侧检查器一键创建或挂载白模底图以进行卷帘比对。"
          : "该分镜尚未生成成片，请等待生成完毕后再进行比对。",
      });
    }
  }, [currentProject?.nodes, selectNode, shellOwnerId]);

  const handleScaffoldClayNodeForSelected = useCallback(async () => {
    if (!selectedNode || !currentProject) return;
    await run(async owner => {
      const ownerId = ownerKey(owner);
      const clayAck = await createNode({
        type: "image",
        title: `${selectedNode.title || "分镜"} - 3D白模底图`,
        prompt: "上传 3D 白模构图、深度图或灰模机位底图",
        body: null,
        x: selectedNode.x,
        y: selectedNode.y - 210,
        width: selectedNode.width || 260,
        height: 180,
      });
      const clayNodeId = clayAck.node_ids[0];
      if (clayNodeId) {
        await attachReferenceNode(selectedNode.id, { sourceNodeId: clayNodeId });
        if (isCurrentOwner(owner)) {
          selectNode(clayNodeId);
          setWorkflowNotice({
            owner: ownerId,
            kind: "success",
            text: `已创建【${selectedNode.title || "分镜"}】专属白模底图节点并建立关联！可在该节点上传 3D 白模底图。`,
          });
        }
      }
    }, "创建白模底图节点失败");
  }, [attachReferenceNode, createNode, currentProject, isCurrentOwner, run, selectNode, selectedNode]);

  const handleExportInteractivePackage = useCallback(() => {
    if (!currentProject) return;
    const storyNodes = currentProject.nodes.filter(n => n.type !== "region");
    const endings = storyNodes.filter(n => n.title?.includes("结局") || n.title?.includes("End") || n.title?.includes("通关"));
    
    const pkg = {
      schema_version: "1.0.0",
      story_title: currentProject.title,
      production_mode: "interactive",
      exported_at: new Date().toISOString(),
      platform: "LumenX FMV Engine",
      commercial_task_id: activeCommercialTask?.id || null,
      stats: {
        total_nodes: storyNodes.length,
        ending_count: endings.length,
      },
      nodes: storyNodes.map(node => ({
        id: node.id,
        type: node.type,
        title: node.title,
        prompt: node.prompt,
        body: isBodyNode(node) ? bodyOf(node) : undefined,
        is_ending: node.title?.includes("结局") || node.title?.includes("End"),
        layout: { x: node.x, y: node.y, width: node.width, height: node.height },
      })),
    };

    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentProject.title || "interactive_story"}_package.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeCommercialTask?.id, currentProject]);

  const saveText = useCallback(() => {
    if (!selectedNode || !currentProject || draft.owner !== selectedOwner) return;
    void run(async owner => {
      if (!isCurrentOwner(owner)) throw new Error("Atelier environment or project changed during request");
      if (isBodyNode(selectedNode)) {
        if (draft.title !== selectedNode.title || draft.body !== bodyOf(selectedNode)) {
          await updateNodeText(selectedNode.id, { title: draft.title, prompt: draft.body });
        }
        return;
      }
      if (draft.title !== selectedNode.title || draft.prompt !== selectedNode.prompt) {
        await updateNodeText(selectedNode.id, { title: draft.title, prompt: draft.prompt });
      }
    }, t("saveError"));
  }, [currentProject, draft, isCurrentOwner, run, selectedNode, selectedOwner, t, updateNodeText]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    void run(async () => { await deleteNodes([nodeId]); }, t("deleteError"));
  }, [deleteNodes, run, t]);

  const deleteSelected = useCallback(() => {
    if (!selectedNode) return;
    handleDeleteNode(selectedNode.id);
  }, [handleDeleteNode, selectedNode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const target = document.activeElement;
      if (target) {
        const tagName = target.tagName.toLowerCase();
        if (tagName === "input" || tagName === "textarea" || tagName === "select" || (target as HTMLElement).isContentEditable) {
          return;
        }
      }
      if (selectedNodeId) {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelected, selectedNodeId]);

  const uploadMedia = async (file: File, targetId?: string) => {
    if (!shellOwner || !isCurrentOwner(shellOwner) || uploadDisabled) return;
    if (targetId !== undefined) {
      const target = useAtelierStore.getState().currentProject?.nodes.find(node => node.id === targetId) ?? null;
      if (!target || hasAtelierNodeActiveExecution(target)) return;
    }
    const owner = shellOwner;
    const kind = getAtelierUploadKind(file);
    const layout = nextCanvasPosition(currentProject?.nodes, ATELIER_MEDIA_RENDERED_BOUNDS[kind].width, ATELIER_MEDIA_RENDERED_BOUNDS[kind].height, 100, 130);
    const input = { file, title: file.name, ...layout };
    const ack = targetId === undefined
      ? await createMediaNode({ ...input, nodeType: kind })
      : await uploadReference(targetId, { ...input, sourceNodeType: kind });
    if (targetId === undefined && isCurrentOwner(owner)) selectNode(ack.node_ids[0] ?? null);
  };

  const checkUpload = async (clientRequestId: string) => {
    if (!shellOwner || !isCurrentOwner(shellOwner)) return;
    const owner = shellOwner;
    const key = `${shellOwnerId}:${clientRequestId}`;
    setCheckingUpload(key);
    try {
      const result = await readbackPendingUpload(clientRequestId);
      if (isCurrentOwner(owner)) setUploadNotice(result ? null : { owner: shellOwnerId, text: t("uploadUnconfirmed") });
    } catch (cause) {
      if (isCurrentOwner(owner)) setUploadNotice({ owner: shellOwnerId, text: cause instanceof Error ? cause.message : t("uploadError") });
    } finally {
      setCheckingUpload(current => current === key ? null : current);
    }
  };

  const renderNode = (node: AtelierNode) => {
    const p = preview[node.id] ?? {};
    const x = p.x ?? node.x;
    const y = p.y ?? node.y;
    const width = p.width ?? node.width;
    const height = p.height ?? node.height;
    const selected = node.id === selectedNodeId;
    if (collapsedOf(currentProject?.nodes.find(region => region.id === stringValue(node.data?.region_id)))) return null;
    if (node.type === "idea") {
      return (
        <div key={node.id} onPointerDownCapture={event => beginDrag(node, event)}>
          <IdeaNode id={node.id} body={bodyOf(node)} x={x} y={y} selected={selected} onSelect={selectNode} onAddNextStep={handleAddNextStep} onDelete={handleDeleteNode} />
        </div>
      );
    }
    if (node.type === "comment") {
      return (
        <div key={node.id} onPointerDownCapture={event => beginDrag(node, event)}>
          <CommentNode id={node.id} body={bodyOf(node)} author={authorOf(node)} x={x} y={y} selected={selected} onSelect={selectNode} />
        </div>
      );
    }
    if (node.type === "region") {
      return (
        <div key={node.id} onPointerDownCapture={event => beginDrag(node, event)}>
          <RegionFrame
            id={node.id}
            title={node.title}
            x={x}
            y={y}
            width={width}
            height={height}
            selected={selected}
            collapsed={collapsedOf(node)}
            color={regionColorOf(node)}
            childCount={currentProject?.nodes.filter(child => stringValue(child.data?.region_id) === node.id).length ?? 0}
            onSelect={selectNode}
            onToggleCollapse={() => {
              if (writeDisabled) return;
              void run(async () => { await updateRegionAppearance(node.id, { collapsed: !collapsedOf(node) }); }, t("layoutError"));
            }}
            onResizeStart={(_id, corner, event) => beginDrag(node, event, "resize", corner)}
          />
        </div>
      );
    }
    if (node.type === "plan") {
      return (
        <div key={node.id} onPointerDownCapture={event => beginDrag(node, event)}>
          <PlanNode
            id={node.id}
            title={node.title}
            bullets={stringArrayValue(node.data?.bullets)}
            steps={planStepsValue(node.data?.steps)}
            x={x}
            y={y}
            selected={selected}
            onSelect={selectNode}
          />
        </div>
      );
    }
    const media = toMediaNodeView({ ...node, x, y, width, height }, { selectedNodeId });
    if (media) {
      return (
        <div key={node.id} onPointerDownCapture={event => beginDrag(node, event)}>
          <MediaNode {...media} onSelect={selectNode} onAddNextStep={handleAddNextStep} onWipeCompare={handleTriggerWipeCompare} onDelete={handleDeleteNode} />
        </div>
      );
    }
    return (
      <div
        key={node.id}
        role="button"
        tabIndex={0}
        onPointerDownCapture={event => beginDrag(node, event)}
        onPointerDown={event => { event.stopPropagation(); selectNode(node.id); }}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectNode(node.id);
          }
        }}
        style={{ transform: `translate(${x}px, ${y}px)`, width, minHeight: Math.min(height, 180) }}
        className={`atelier-node-shell absolute overflow-hidden p-4 transition-[box-shadow,border-color] ${selected ? "ring-1 ring-white/25 border-white/20" : "border-white/[0.08]"}`}
      >
        <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">{node.type}</div>
        <div className="mt-2 truncate font-display text-[13px] font-medium text-white/80">{node.title || node.id}</div>
        {node.prompt ? <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-white/50">{node.prompt}</p> : null}
        <div className="mt-3 text-[11px] text-white/35">{node.status}</div>
      </div>
    );
  };

  return (
    <section className="atelier-v3-root h-dvh max-h-dvh overflow-hidden bg-[#050508] text-white" aria-label={t("title")}>
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 flex items-center justify-between border-b border-white/[0.08] bg-black/30 px-5 py-3.5 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-display text-xl font-semibold tracking-[-0.03em]">{t("title")}</h1>
              <p className="text-xs text-white/45">{t("subtitle")}</p>
            </div>
            {activeCommercialTask && (
              <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-200 shadow-sm animate-in fade-in">
                <Sparkles size={13} className="text-amber-400 shrink-0" />
                <span className="font-medium truncate max-w-[180px]">
                  履约中：{activeCommercialTask.title}
                </span>
                <span className="font-mono text-amber-400 font-semibold">
                  ¥{(activeCommercialTask.bounty_cents / 100).toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => setShowTaskBriefModal(true)}
                  className="underline hover:text-white text-xs ml-0.5 font-medium cursor-pointer"
                >
                  查看Brief
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.sessionStorage.removeItem("active_commercial_task");
                    }
                    setActiveCommercialTask(null);
                  }}
                  className="text-amber-400/60 hover:text-white p-0.5"
                  title="退出商单模式"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* 剧作形态隔离指示与切换器 */}
            <div className="flex items-center rounded-xl border border-white/[0.1] bg-black/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setCanvasProductionMode("linear")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  canvasProductionMode === "linear"
                    ? "bg-primary text-white font-semibold shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
                title="普通短剧：经典单线时序分镜流"
              >
                <Film size={12} /> 普通短剧
              </button>
              <button
                type="button"
                onClick={() => setCanvasProductionMode("interactive")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  canvasProductionMode === "interactive"
                    ? "bg-purple-600 text-white font-semibold shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
                title="互动影游：网状决策树与多结局分支"
              >
                <Gamepad2 size={12} /> 互动影游
              </button>
            </div>

            {canvasProductionMode === "interactive" && (
              <button
                type="button"
                onClick={() => setShowSimulatorModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-500/40 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 hover:text-purple-200 text-xs font-semibold shadow-sm transition-all cursor-pointer animate-in fade-in"
                title="打开互动模拟器，像玩家一样试玩分支剧情"
              >
                <Play size={12} className="fill-purple-300 text-purple-300" />
                试玩模拟器
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a className="rounded-xl border border-white/[0.1] px-3 py-2 text-sm text-white/70 hover:bg-white/[0.06]" href="#/platform?section=tasks">
              商单大厅
            </a>
            <a className="rounded-xl border border-white/[0.1] px-3 py-2 text-sm text-white/70 hover:bg-white/[0.06]" href="#/workspace">
              {t("returnWorkspace")}
            </a>
            <button type="button" className={commandButtonClass(isLoading)} disabled={isLoading} onClick={() => { bumpInteractionSession(); void run(() => createProject(t("projectName")), t("createError")); }}>
              {t("createProject")}
            </button>
          </div>
        </header>

        <div className="shrink-0 flex border-b border-white/[0.08] bg-white/[0.025] px-4 py-2">
          <div className="flex flex-wrap gap-2">
            {projects.map(project => (
              <button
                key={project.id}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-sm ${project.id === currentProject?.id ? "border-white/30 bg-white/15 text-white" : "border-white/[0.08] bg-black/20 text-white/55 hover:text-white"}`}
                onClick={() => { bumpInteractionSession(); void run(() => switchProject(project.id), t("switchError")); }}
              >
                {project.title}
              </button>
            ))}
          </div>
        </div>

        {(error || localError || needsRefresh || uploadJournalError?.owner === shellOwnerId || workflowNoticeText) ? (
          <div role="alert" className="shrink-0 flex items-center justify-between border-b border-amber-300/20 bg-amber-500/10 px-5 py-3 text-sm text-amber-100">
            <span>{workflowNoticeText ?? (needsRefresh ? t("needsRefresh") : null)} {error ?? localError ?? (uploadJournalError?.owner === shellOwnerId ? uploadJournalError.text : null)}</span>
            <button type="button" className="rounded-lg border border-amber-100/30 px-3 py-1 text-amber-50" onClick={() => void run(() => refreshProject(), t("switchError"))}>
              {t("refresh")}
            </button>
          </div>
        ) : null}

        {pendingUploads.length > 0 && <div className="max-h-[20dvh] shrink-0 space-y-2 overflow-y-auto border-b border-amber-300/20 bg-amber-500/10 px-5 py-3 text-sm text-amber-100">
          <p>{t("uploadPending")}</p>
          {pendingUploads.map(request => <div key={request.clientRequestId} className="flex items-center justify-between gap-3">
            <span className="truncate">{request.fileName}</span>
            <button type="button" className="rounded-lg border border-amber-100/30 px-3 py-1 disabled:opacity-40"
              disabled={isSaving || checkingUpload === `${shellOwnerId}:${request.clientRequestId}`}
              onClick={() => void checkUpload(request.clientRequestId)}>{t("checkUpload")}</button>
          </div>)}
          {uploadNotice?.owner === shellOwnerId && <p role="status">{uploadNotice.text}</p>}
        </div>}

        <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] overflow-hidden">
          <div ref={canvasViewportRef} data-testid="atelier-canvas-viewport" className="relative min-h-0 overflow-hidden" onDragOver={allowWorkflowDrop} onDrop={dropWorkflowTemplate}>
            <div ref={canvasToolbarRef} data-testid="atelier-canvas-toolbar" className="absolute left-5 top-5 z-20 flex flex-wrap gap-2 rounded-2xl border border-white/[0.08] bg-black/35 p-2 backdrop-blur-xl">
              <button type="button" className={commandButtonClass(writeDisabled)} disabled={writeDisabled} onClick={() => createNodeAndSelect("idea")}>{t("createIdea")}</button>
              <button type="button" className={commandButtonClass(writeDisabled)} disabled={writeDisabled} onClick={() => createNodeAndSelect("comment")}>{t("createComment")}</button>
              <button type="button" className={commandButtonClass(writeDisabled)} disabled={writeDisabled} onClick={() => createNodeAndSelect("image")}>{t("createImage")}</button>
              <button type="button" className={commandButtonClass(writeDisabled)} disabled={writeDisabled} onClick={() => createNodeAndSelect("video")}>{t("createVideo")}</button>
              <button type="button" className={commandButtonClass(writeDisabled)} disabled={writeDisabled} onClick={() => createNodeAndSelect("audio")}>{t("createAudio")}</button>
              <button type="button" className={commandButtonClass(writeDisabled)} disabled={writeDisabled} onClick={createRegion}>{t("createRegion")}</button>
              <button type="button" className={commandButtonClass(writeDisabled)} disabled={writeDisabled} onClick={() => setWorkflowsOpen(value => !value)}>{t("workflows")}</button>
              <button type="button" className={commandButtonClass(writeDisabled)} disabled={writeDisabled} onClick={() => setShowBatchImportModal(true)} title="批量导入分镜表格">
                <FileSpreadsheet size={13} className="inline mr-1 text-purple-400" />
                分镜表批量导入
              </button>
              <MediaUploadButton ownerKey={shellOwnerId} label={t("uploadMedia")} busyLabel={t("uploading")} errorLabel={t("uploadError")}
                accept={ATELIER_UPLOAD_ACCEPT} disabled={uploadDisabled} onUpload={file => uploadMedia(file)} />
              <button type="button" className={commandButtonClass(false)} onClick={() => setZoom(z => Math.min(2, z + 0.1))}>{t("zoomIn")}</button>
              <button type="button" className={commandButtonClass(false)} onClick={() => setZoom(z => Math.max(0.4, z - 0.1))}>{t("zoomOut")}</button>
            </div>
            {workflowsOpen ? <div className="absolute left-5 top-24 z-30">
              <WorkflowsPanel
                labels={{ title: t("workflowsTitle"), all: t("workflowsAll"), insert: t("workflowInsert"), drag: t("workflowDrag") }}
                disabled={writeDisabled}
                onInsert={template => insertWorkflowTemplate(template)}
              />
            </div> : null}
            {isLoading ? <p className="absolute left-6 top-24 z-20 text-sm text-white/45">{t("loading")}</p> : null}
            {currentProject && currentProject.nodes.length === 0 && !isLoading ? (
              <p className="absolute left-6 top-24 z-20 text-sm text-white/45">{t("emptyCanvas")}</p>
            ) : null}
            <div
              className="relative h-full w-full origin-top-left"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
              aria-label="Atelier canvas"
              onPointerDown={event => {
                if (event.currentTarget !== event.target) return;
                selectNode(null);
                panRef.current = { startClientX: event.clientX, startClientY: event.clientY, startX: pan.x, startY: pan.y };
              }}
            >
              <svg aria-label={t("templateRelationships")} data-testid="atelier-reference-edges" className="pointer-events-none absolute left-0 top-0 h-[6000px] w-[6000px] overflow-visible">
                <defs>
                  <linearGradient id="branchBeamGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity="0.85" />
                    <stop offset="50%" stopColor="#ec4899" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity="0.85" />
                  </linearGradient>
                  <marker id="branchArrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 8 5 L 0 9 z" fill="#c084fc" />
                  </marker>
                </defs>
                {canvasLinks.map(link => {
                  const x1 = link.from.x + link.from.width / 2;
                  const y1 = link.from.y + link.from.height / 2;
                  const x2 = link.to.x + link.to.width / 2;
                  const y2 = link.to.y + link.to.height / 2;
                  return <line key={link.key} data-testid={link.pending ? "atelier-pending-reference-edge" : "atelier-reference-edge"}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={link.pending ? "rgba(255,255,255,0.34)" : link.stale ? "rgba(251,191,36,0.42)" : "rgba(100,108,255,0.42)"}
                    strokeWidth="2" strokeDasharray={link.pending ? "8 7" : link.stale ? "4 5" : undefined} />;
                })}
                {/* 互动影游分支贝塞尔光束连线与动态决策徽标 */}
                {interactiveLinks.map(link => {
                  const fromX = preview[link.fromNode.id]?.x ?? link.fromNode.x;
                  const fromY = preview[link.fromNode.id]?.y ?? link.fromNode.y;
                  const fromWidth = preview[link.fromNode.id]?.width ?? link.fromNode.width;
                  const fromHeight = preview[link.fromNode.id]?.height ?? link.fromNode.height;

                  const toX = preview[link.toNode.id]?.x ?? link.toNode.x;
                  const toY = preview[link.toNode.id]?.y ?? link.toNode.y;
                  const toHeight = preview[link.toNode.id]?.height ?? link.toNode.height;

                  const startX = fromX + fromWidth;
                  const startY = fromY + fromHeight / 2;
                  const endX = toX;
                  const endY = toY + toHeight / 2;

                  const pathD = computeBranchBezierPath(startX, startY, endX, endY);
                  const midX = (startX + endX) / 2;
                  const midY = (startY + endY) / 2;

                  return (
                    <g key={link.key} data-testid="atelier-branch-edge">
                      <path
                        d={pathD}
                        fill="none"
                        stroke="url(#branchBeamGradient)"
                        strokeWidth="2.5"
                        strokeDasharray="6 4"
                        markerEnd="url(#branchArrow)"
                        className="transition-all"
                      />
                      <g
                        transform={`translate(${midX}, ${midY})`}
                        style={{ pointerEvents: "all" }}
                        className="group cursor-pointer select-none"
                      >
                        <rect
                          x="-52"
                          y="-12"
                          width="104"
                          height="24"
                          rx="12"
                          fill="#180b2a"
                          stroke="#a855f7"
                          strokeWidth="1.2"
                          className="shadow-lg transition-colors hover:border-pink-500 hover:fill-purple-950"
                        />
                        <text
                          x="-8"
                          y="4"
                          textAnchor="middle"
                          fill="#f3e8ff"
                          fontSize="10"
                          fontWeight="500"
                          pointerEvents="none"
                        >
                          {link.choiceLabel.length > 6 ? link.choiceLabel.slice(0, 5) + "…" : link.choiceLabel}
                        </text>
                        {/* 快捷断开/删除连线按钮 */}
                        <g
                          role="button"
                          aria-label="断开此连线"
                          transform="translate(38, 0)"
                          className="cursor-pointer hover:opacity-100 opacity-70 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveInteractiveLink(link.fromNode.id, link.choiceId);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <circle r="7" fill="#ef4444" />
                          <line x1="-3" y1="-3" x2="3" y2="3" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                          <line x1="3" y1="-3" x2="-3" y2="3" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                        </g>
                      </g>
                    </g>
                  );
                })}
              </svg>
              <div aria-hidden="true" className="atelier-bloom pointer-events-none absolute left-[22%] top-[10%]" />
              {/* Regions are backgrounds, including when created after their members. */}
              {currentProject?.nodes.filter(node => node.type === "region").map(renderNode)}
              {currentProject?.nodes.filter(node => node.type !== "region").map(renderNode)}
            </div>
          </div>

          <aside ref={inspectorRef} role="region" aria-label={t("inspectorTitle")} className="min-h-0 overflow-y-auto overscroll-contain border-l border-white/[0.08] bg-black/35 p-4 backdrop-blur-xl">
            <h2 className="font-display text-lg font-medium">{t("inspectorTitle")}</h2>
            {selectedNode ? (
              <div className="mt-4 space-y-3">
                <label className="block text-xs text-white/45">
                  {t("titleLabel")}
                  <input className={`${fieldClass()} mt-1`} aria-label={t("titleLabel")} value={draft.title} onChange={event => setDraft(prev => ({ ...prev, title: event.target.value }))} />
                </label>
                {!isBodyNode(selectedNode) ? (
                  <label className="block text-xs text-white/45">
                    {t("promptLabel")}
                    <textarea className={`${fieldClass()} mt-1 min-h-[72px]`} aria-label={t("promptLabel")} value={draft.prompt} onChange={event => setDraft(prev => ({ ...prev, prompt: event.target.value }))} />
                  </label>
                ) : null}
                {(selectedNode.type === "image" || selectedNode.type === "video") && (() => {
                  const { renderUrl: nodeRenderUrl, clayUrl: nodeClayUrl } = resolveNodeRenderAndClay(
                    selectedNode,
                    currentProject?.nodes ?? []
                  );

                  return (
                    <div className="rounded-xl border border-sky-500/25 bg-sky-950/20 p-3 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-sky-300">
                          <Box size={14} className="text-sky-400" />
                          白模 / 灰模预演渲染增强与比对
                        </span>
                      </div>

                      {/* 预设风格标签 */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-white/50 block">脱模渲染风格预设：</label>
                        <div className="flex flex-wrap gap-1.5">
                          {CLAY_STYLE_PRESETS.map(preset => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => {
                                setSelectedClayPreset(preset.id);
                                setDraft(prev => ({
                                  ...prev,
                                  prompt: prev.prompt ? `${prev.prompt}，${preset.promptSnippet}` : preset.promptSnippet,
                                }));
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                                selectedClayPreset === preset.id
                                  ? "bg-sky-500/30 border-sky-400 text-sky-100"
                                  : "bg-black/30 border-white/10 text-white/60 hover:text-white hover:bg-white/5"
                              }`}
                              title={preset.promptSnippet}
                            >
                              {preset.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 卷帘对比按钮 */}
                      {nodeRenderUrl && nodeClayUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setWipeCompareData({
                              open: true,
                              renderUrl: nodeRenderUrl,
                              renderKind: selectedNode.type === "video" ? "video" : "image",
                              clayUrl: nodeClayUrl,
                              clayKind: "image",
                              title: `分镜比对: ${selectedNode.title || selectedNode.id}`,
                            });
                          }}
                          className="w-full mt-2 py-2 px-3 rounded-lg bg-gradient-to-r from-sky-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-purple-600/20"
                        >
                          <SplitSquareVertical size={13} />
                          <span>打开白模 vs 成片卷帘对比 (Wipe View)</span>
                        </button>
                      )}

                      {/* 尚无关联白模时的引导按钮 */}
                      {!nodeClayUrl && (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[11px] text-amber-300/80">
                            {nodeRenderUrl
                              ? "当前分镜已完成渲染，但尚未关联 3D 白模底稿。"
                              : "建议为该分镜挂载 3D 白模或几何线稿，以锁定镜头机位与景深。"}
                          </p>
                          <button
                            type="button"
                            onClick={() => void handleScaffoldClayNodeForSelected()}
                            className="w-full py-2 px-3 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 text-xs font-medium border border-sky-400/30 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Plus size={13} />
                            一键创建 3D 白模底图节点并建立关联
                          </button>
                        </div>
                      )}

                      <p className="text-[10px] text-white/45 leading-relaxed">
                        以 3D 白模作为构图底模时，一键注入次世代材质修饰，并可随时展开卷帘对比检查画面透视与主体还原度。
                      </p>
                    </div>
                  );
                })()}
                {isBodyNode(selectedNode) ? (
                  <label className="block text-xs text-white/45">
                    {t("bodyLabel")}
                    <textarea className={`${fieldClass()} mt-1 min-h-[120px]`} aria-label={t("bodyLabel")} value={draft.body} onChange={event => setDraft(prev => ({ ...prev, body: event.target.value }))} />
                  </label>
                ) : null}
                <div className="flex gap-2">
                  <button type="button" className={commandButtonClass(writeDisabled)} disabled={writeDisabled} onClick={saveText}>{isSaving ? t("commandBusy") : t("saveText")}</button>
                  <button type="button" className={commandButtonClass(writeDisabled)} disabled={writeDisabled} onClick={deleteSelected}>{t("deleteNode")}</button>
                </div>
                {/* 互动影游模式下专属的分支与决策配置面板 */}
                {canvasProductionMode === "interactive" && currentProject && selectedNode.type !== "region" && (
                  <InteractiveBranchConfig
                    node={selectedNode}
                    nodes={currentProject.nodes}
                    onUpdateNodePrompt={prompt => setDraft(prev => ({ ...prev, prompt }))}
                    onOpenSimulator={() => setShowSimulatorModal(true)}
                    onCreateBranchNode={handleCreateDownstreamBranch}
                    onSaveBranchConfig={handleSaveBranchConfig}
                  />
                )}
                {currentProject && selectedNode.type !== "region" ? <RegionMembershipControls
                  key={`${shellOwnerId}:${selectedNode.id}:membership`}
                  node={selectedNode}
                  nodes={currentProject.nodes}
                  disabled={writeDisabled}
                  onSave={regionId => updateNodeLayout(selectedNode.id, { regionId })}
                /> : null}
                {currentProject ? <ReferenceControls
                  project={currentProject}
                  targetId={selectedNode.id}
                  ownerKey={shellOwnerId}
                  disabled={writeDisabled}
                  labels={{ title: t("referencesTitle"), select: t("chooseReferenceSource"), empty: t("noReferenceSource"), attach: t("attachReference"), attachPending: t("attachPendingReference"), pending: t("pendingReference"), pendingReady: t("pendingReferenceReady"), confirmPending: t("confirmPendingReference"), detach: t("detachReference") }}
                  onAttach={input => void run(() => attachReferenceNode(selectedNode.id, input), t("referenceError"))}
                  onAttachPending={input => void run(() => attachPendingReferenceNode(selectedNode.id, input), t("referenceError"))}
                  onDetach={input => void run(() => detachReferenceNode(selectedNode.id, input), t("referenceError"))}
                /> : null}
                {(selectedNode.type === "image" || selectedNode.type === "video") && <MediaUploadButton
                  ownerKey={`${shellOwnerId}:${selectedNode.id}`} label={t("uploadReference")} busyLabel={t("uploading")} errorLabel={t("uploadError")}
                  accept={selectedNode.type === "image" ? ATELIER_IMAGE_UPLOAD_ACCEPT : ATELIER_UPLOAD_ACCEPT}
                  disabled={uploadDisabled || selectedNodeUploadBlocked} onUpload={file => uploadMedia(file, selectedNode.id)} />}
              </div>
            ) : (
              <p className="mt-4 text-sm text-white/45">{t("noSelection")}</p>
            )}
            {/* 互动影游专属标准化工程包导出 */}
            {canvasProductionMode === "interactive" && currentProject && (
              <div className="mt-4 p-3.5 rounded-xl border border-purple-500/30 bg-purple-950/20 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
                  <Download size={13} className="text-purple-400" />
                  <span>导出互动影游标准化工程包</span>
                </div>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  导出包含多分支 DAG 决策树、各镜头切片提示词与结局收敛规则的 JSON 工程规范，可直接交付客户或接入游戏引擎。
                </p>
                <button
                  type="button"
                  onClick={handleExportInteractivePackage}
                  className="w-full py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-purple-600/20"
                >
                  <Download size={13} /> 下载互动短剧工程包 JSON
                </button>
              </div>
            )}
            {currentProject ? <div className="mt-4">
              <ProjectPackageControls
                project={currentProject}
                ownerKey={`${shellOwnerId}:package`}
                environmentKey={runtimeEnvironment?.key ?? null}
                disabled={writeDisabled}
                loadProjects={loadProjects}
                switchProject={switchProject}
              />
            </div> : null}
            {currentProject ? <div className="mt-4">
              <AgentTurnPanel
                key={`${shellOwnerId}:agent:${selectedNode?.id ?? "none"}`}
                project={currentProject}
                selectedNode={selectedNode}
                ownerKey={`${shellOwnerId}:agent:${selectedNode?.id ?? "none"}`}
                disabled={writeDisabled}
              />
            </div> : null}
            {currentProject ? <div className="mt-4">
              <GenerationPanel
                key={`${shellOwnerId}:generation:${selectedNode?.id ?? "none"}`}
                project={currentProject}
                selectedNode={selectedNode}
                ownerKey={`${shellOwnerId}:${selectedNode?.id ?? "none"}`}
                disabled={writeDisabled}
                targetRect={selectedComposerLayout.rect}
                targetAvailableRect={selectedComposerLayout.availableRect}
                onOpenWipeCompare={(candidateVideoUrl) => {
                  if (!selectedNode) return;
                  const nodeAny = selectedNode as any;
                  const firstRefUrl = nodeAny.reference_image_urls?.[0] || nodeAny.data?.clay_url;
                  const pendingRefSourceId = nodeAny.pending_reference_nodes?.[0]?.source_node_id;
                  const pendingRefSourceMedia = pendingRefSourceId ? currentProject?.nodes.find(n => n.id === pendingRefSourceId)?.media_urls?.[0] : null;
                  const clayUrl = firstRefUrl || pendingRefSourceMedia || null;

                  if (clayUrl) {
                    setWipeCompareData({
                      open: true,
                      renderUrl: candidateVideoUrl,
                      renderKind: "video",
                      clayUrl,
                      clayKind: "image",
                      title: `候选比对: ${selectedNode.title || selectedNode.id}`,
                    });
                  } else {
                    setWorkflowNotice({
                      owner: shellOwnerId,
                      kind: "error",
                      text: "该分镜尚未关联白模参考图，请先在下方挂载白模参考图以进行卷帘比对。",
                    });
                  }
                }}
              />
            </div> : null}
            {currentProject ? <div className="mt-4">
              <MediaComposer
                key={`${shellOwnerId}:media:${selectedNode?.id ?? "none"}`}
                project={currentProject}
                selectedNode={selectedNode}
                ownerKey={`${shellOwnerId}:${selectedNode?.id ?? "none"}`}
                disabled={writeDisabled}
                pendingGenerations={pendingGenerations}
                targetRect={selectedComposerLayout.rect}
                targetAvailableRect={selectedComposerLayout.availableRect}
                saveDraft={saveMediaGenerationDraft}
                createImageCandidate={createImageCandidate}
                createAudioCandidate={createAudioCandidate}
                readbackPendingGeneration={readbackPendingGeneration}
                refreshGenerationAttempt={refreshGenerationAttempt}
                continueGenerationAttempt={continueGenerationAttempt}
                cancelGenerationAttempt={cancelGenerationAttempt}
                selectCandidate={selectMediaGenerationCandidate}
                setCandidateVisibility={setMediaGenerationCandidateVisibility}
              />
            </div> : null}
            {unconsumedReceipts.length ? (
              <div className="mt-6 space-y-2">
                {unconsumedReceipts.map(receipt => (
                  <div key={receipt.receipt_id} className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
                    <p className="text-sm text-white/65">{t("deletedReceipt")}</p>
                    <button type="button" className={`${commandButtonClass(writeDisabled)} mt-2`} disabled={writeDisabled} onClick={() => void run(() => restoreNodes(receipt.receipt_id), t("restoreError"))}>
                      {t("restoreReceipt")}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </aside>
        </main>
        {currentProject && runtimeEnvironment ? <div className="max-h-[35dvh] shrink-0 overflow-y-auto overscroll-contain">
          <SequenceWorkbench key={shellOwnerId} project={currentProject} selectedNode={selectedNode}
            owner={{ apiBase: runtimeEnvironment.apiUrl, storageId: runtimeEnvironment.storageId, projectId: currentProject.id }} />
        </div> : null}
      </div>

      {/* 商业需求 Brief 与验收标准弹窗 */}
      {showTaskBriefModal && activeCommercialTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-glass-border bg-[#0d0e14]/95 p-6 shadow-2xl space-y-4 text-white">
            <div className="flex items-start justify-between border-b border-white/10 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                    商单履约 Brief
                  </span>
                  <span className="text-sm font-mono text-amber-400 font-bold">
                    赏金 ¥{(activeCommercialTask.bounty_cents / 100).toLocaleString()}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1.5">{activeCommercialTask.title}</h3>
                {activeCommercialTask.client_name && (
                  <p className="text-xs text-white/50 mt-0.5">发包方：{activeCommercialTask.client_name}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowTaskBriefModal(false)}
                className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* 技术规格与验收规则 */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <span className="text-amber-400 font-semibold block mb-1">交付物技术规格</span>
                <p className="text-white/70">
                  {activeCommercialTask.deliverable_specs_json
                    ? activeCommercialTask.deliverable_specs_json
                    : "分辨率: 1080P · 画幅: 9:16 · 帧率: 30fps"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <span className="text-amber-400 font-semibold block mb-1">阶段验收与放款</span>
                <p className="text-white/70">
                  {activeCommercialTask.settlement_mode === "milestone"
                    ? "分阶段结算 (40%分镜确认 / 60%成片终审放款)"
                    : "终审合格一次性全额结算"}
                </p>
              </div>
            </div>

            {/* Brief 简报正文 */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/80 leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto">
              <h4 className="text-xs font-semibold text-white/90 mb-2">需求详细简报：</h4>
              {activeCommercialTask.brief_markdown}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
              <span className="text-white/45">
                分镜制作完成后，可前往平台导出审阅样片进行第一阶段验收
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={injectCommercialBrief}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} /> 一键注入需求节点到画布
                </button>
                <button
                  type="button"
                  onClick={() => setShowTaskBriefModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-white/10 hover:bg-white/10 text-white/75"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 互动影游 · 决策模拟试玩器弹窗 */}
      <InteractiveSimulatorModal
        isOpen={showSimulatorModal}
        onClose={() => setShowSimulatorModal(false)}
        nodes={currentProject?.nodes ?? []}
        taskTitle={activeCommercialTask?.title}
        onScaffoldStarterTree={handleScaffoldStarterTree}
      />

      {/* 白模与成片卷帘对比播放器弹窗 */}
      {wipeCompareData && (
        <ClayWipeCompareModal
          open={wipeCompareData.open}
          onClose={() => setWipeCompareData(null)}
          renderUrl={wipeCompareData.renderUrl}
          renderKind={wipeCompareData.renderKind}
          clayUrl={wipeCompareData.clayUrl}
          clayKind={wipeCompareData.clayKind}
          title={wipeCompareData.title}
        />
      )}

      {/* 白模分镜表批量导入弹窗 */}
      <StoryboardBatchImportModal
        open={showBatchImportModal}
        onClose={() => setShowBatchImportModal(false)}
        onImportShots={handleBatchImportShots}
      />
    </section>
  );
}

export default AtelierShell;
