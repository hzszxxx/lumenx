import type { AtelierNode } from "./atelierTypes";

export interface InteractiveChoice {
  id: string;
  label: string;
  targetNodeId: string;
  timeoutSeconds?: number;
}

export interface InteractiveBranchData {
  isEnding?: boolean;
  endingType?: "normal" | "bad" | "secret";
  choices?: InteractiveChoice[];
}

export interface InteractiveBranchLink {
  key: string;
  fromNode: AtelierNode;
  toNode: AtelierNode;
  choiceId: string;
  choiceLabel: string;
  index: number;
}

/**
 * 从节点数据或提示词中安全提取交互配置
 */
export function getInteractiveBranchData(node: AtelierNode): InteractiveBranchData {
  const d = node.data || {};
  if (d.interactive && typeof d.interactive === "object" && !Array.isArray(d.interactive)) {
    return d.interactive as unknown as InteractiveBranchData;
  }
  
  // 智能推导：根据标题或 prompt 启发式恢复
  const isEnding =
    node.title?.includes("结局") ||
    node.title?.includes("End") ||
    node.title?.includes("通关") ||
    node.title?.includes("失败");

  const endingType =
    node.title?.includes("Bad") || node.title?.includes("失败")
      ? "bad"
      : node.title?.includes("隐藏") || node.title?.includes("Secret")
      ? "secret"
      : "normal";

  return {
    isEnding,
    endingType,
    choices: [],
  };
}

/**
 * 扫描全部节点，提取出所有用于画布渲染的动态分支光束连线
 */
export function buildCanvasInteractiveLinks(nodes: AtelierNode[]): InteractiveBranchLink[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const links: InteractiveBranchLink[] = [];

  for (const fromNode of nodes) {
    if (fromNode.type === "region") continue;
    const branchData = getInteractiveBranchData(fromNode);
    if (branchData.isEnding || !branchData.choices) continue;

    branchData.choices.forEach((choice, index) => {
      if (!choice.targetNodeId) return;
      const toNode = nodeMap.get(choice.targetNodeId);
      if (!toNode || toNode.id === fromNode.id) return;

      links.push({
        key: `branch:${fromNode.id}->${toNode.id}:${choice.id}`,
        fromNode,
        toNode,
        choiceId: choice.id,
        choiceLabel: choice.label,
        index,
      });
    });
  }

  return links;
}

/**
 * 生成三次贝塞尔曲线 SVG path 数据
 */
export function computeBranchBezierPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): string {
  const dx = Math.abs(endX - startX);
  const controlOffset = Math.max(80, dx * 0.45);
  const c1x = startX + controlOffset;
  const c1y = startY;
  const c2x = endX - controlOffset;
  const c2y = endY;
  return `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`;
}

export interface NodeMediaSlice {
  kind: "video" | "image" | "none";
  url: string | null;
  posterUrl?: string | null;
}

/**
 * 解析节点对应的主视觉切片（视频或概念剧照）
 */
export function resolveNodeMediaSlice(node: AtelierNode | undefined): NodeMediaSlice {
  if (!node) return { kind: "none", url: null };
  const d = (node.data || {}) as Record<string, any>;

  // 1. 优先提取视频切片 (mp4 / webm / video 节点)
  const firstUrl = Array.isArray(node.media_urls) && typeof node.media_urls[0] === "string" ? node.media_urls[0] : null;
  const isDirectVideo = firstUrl && /\.(mp4|webm|mov)(\?.*)?$/i.test(firstUrl);

  const videoUrl =
    (node.type === "video" && firstUrl) ||
    (isDirectVideo ? firstUrl : null) ||
    d.video_url ||
    d.render_url ||
    null;

  if (videoUrl) {
    const poster =
      (node.type === "image" ? firstUrl : null) ||
      d.thumbnail_url ||
      d.poster_url ||
      d.clay_url ||
      null;
    return { kind: "video", url: videoUrl, posterUrl: poster };
  }

  // 2. 提取原画 / 静态关键帧切片
  const imageUrl =
    (node.type === "image" && firstUrl) ||
    firstUrl ||
    d.image_url ||
    d.clay_url ||
    null;

  if (imageUrl) {
    return { kind: "image", url: imageUrl, posterUrl: imageUrl };
  }

  return { kind: "none", url: null };
}

/**
 * 客户端视频/图片切片预加载缓存池 (零等待切换分支)
 */
class InteractiveMediaPreloadPool {
  private preloadedUrls = new Set<string>();
  private videoElements = new Map<string, HTMLVideoElement>();

  public preloadSlice(url: string | null | undefined, isVideo: boolean = false) {
    if (!url || typeof window === "undefined" || this.preloadedUrls.has(url)) return;

    this.preloadedUrls.add(url);
    try {
      if (isVideo) {
        const video = document.createElement("video");
        video.preload = "auto";
        video.src = url;
        video.muted = true;
        this.videoElements.set(url, video);
      } else {
        const img = new Image();
        img.src = url;
      }
    } catch {
      // Ignore preload errors in headless or offline modes
    }
  }

  public isPreloaded(url: string | null | undefined): boolean {
    if (!url) return false;
    return this.preloadedUrls.has(url);
  }

  public getCacheStats(): { count: number; urls: string[] } {
    return {
      count: this.preloadedUrls.size,
      urls: Array.from(this.preloadedUrls),
    };
  }

  public clear() {
    this.videoElements.forEach((v) => {
      v.src = "";
    });
    this.videoElements.clear();
    this.preloadedUrls.clear();
  }
}

export const interactiveMediaPreloadPool = new InteractiveMediaPreloadPool();

