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
