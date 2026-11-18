"use client";

import { useState, useEffect } from "react";
import {
  Gamepad2,
  GitBranch,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Flag,
} from "lucide-react";
import type { AtelierNode } from "@/lib/atelierTypes";

interface InteractiveChoiceItem {
  id: string;
  label: string;
  targetNodeId: string;
  timeoutSeconds: number;
}

interface InteractiveBranchConfigProps {
  node: AtelierNode;
  nodes: AtelierNode[];
  onUpdateNodePrompt: (prompt: string) => void;
  onOpenSimulator: () => void;
  onCreateBranchNode?: (label: string) => void;
  onSaveBranchConfig?: (branchData: {
    isEnding: boolean;
    endingType: "normal" | "bad" | "secret";
    choices: InteractiveChoiceItem[];
  }) => void;
}

export function InteractiveBranchConfig({
  node,
  nodes,
  onUpdateNodePrompt,
  onOpenSimulator,
  onCreateBranchNode,
  onSaveBranchConfig,
}: InteractiveBranchConfigProps) {
  // 从节点自定义数据中读取已有交互配置
  const existingInteractive = (node.data?.interactive as any) || {};

  const isEndingInitially =
    existingInteractive.isEnding !== undefined
      ? Boolean(existingInteractive.isEnding)
      : node.title?.includes("结局") ||
        node.title?.includes("End") ||
        node.title?.includes("通关") ||
        node.title?.includes("失败");

  const [isEnding, setIsEnding] = useState(isEndingInitially);
  const [endingType, setEndingType] = useState<"normal" | "bad" | "secret">(
    existingInteractive.endingType ||
      (node.title?.includes("Bad") || node.title?.includes("失败") ? "bad" : "normal")
  );

  const initialChoices: InteractiveChoiceItem[] =
    Array.isArray(existingInteractive.choices) && existingInteractive.choices.length > 0
      ? existingInteractive.choices
      : [
          { id: "choice-1", label: "选项A：深入调查", targetNodeId: "", timeoutSeconds: 10 },
          { id: "choice-2", label: "选项B：撤退求援", targetNodeId: "", timeoutSeconds: 10 },
        ];

  const [choices, setChoices] = useState<InteractiveChoiceItem[]>(initialChoices);
  const [newBranchTitle, setNewBranchTitle] = useState("");

  const otherNodes = nodes.filter((n) => n.id !== node.id && n.type !== "region");

  // 状态变更时通知父级更新
  useEffect(() => {
    onSaveBranchConfig?.({
      isEnding,
      endingType,
      choices,
    });
  }, [isEnding, endingType, choices, onSaveBranchConfig]);

  const handleAddChoice = () => {
    if (choices.length >= 4) return;
    const nextIdx = choices.length + 1;
    const labels = ["A", "B", "C", "D"];
    setChoices((prev) => [
      ...prev,
      {
        id: `choice-${Date.now()}`,
        label: `选项${labels[nextIdx - 1] || nextIdx}：新分支行动`,
        targetNodeId: otherNodes[0]?.id || "",
        timeoutSeconds: 10,
      },
    ]);
  };

  const handleRemoveChoice = (id: string) => {
    setChoices((prev) => prev.filter((c) => c.id !== id));
  };

  const handleUpdateChoice = (id: string, updates: Partial<InteractiveChoiceItem>) => {
    setChoices((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleCreateBranch = () => {
    if (!newBranchTitle.trim() || !onCreateBranchNode) return;
    onCreateBranchNode(newBranchTitle.trim());
    setNewBranchTitle("");
  };

  return (
    <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3.5 space-y-3.5 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-purple-500/20">
        <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
          <Gamepad2 size={14} className="text-purple-400" />
          <span>互动影游 · 决策分支配置</span>
        </div>
        <button
          type="button"
          onClick={onOpenSimulator}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 text-[11px] cursor-pointer"
        >
          <Play size={10} className="fill-purple-300" /> 试玩此节点
        </button>
      </div>

      {/* 节点类型标记：分支决策点 vs 终局节点 */}
      <div className="space-y-1.5">
        <label className="text-white/60 block text-[11px]">节点属性形态</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsEnding(false)}
            className={`py-1.5 px-2.5 rounded-lg border text-left flex items-center gap-1.5 transition-all cursor-pointer ${
              !isEnding
                ? "border-purple-400 bg-purple-500/20 text-white font-medium"
                : "border-white/10 bg-white/5 text-white/50 hover:text-white"
            }`}
          >
            <GitBranch size={12} className={!isEnding ? "text-purple-300" : "text-white/40"} />
            <span>分支决策点</span>
          </button>
          <button
            type="button"
            onClick={() => setIsEnding(true)}
            className={`py-1.5 px-2.5 rounded-lg border text-left flex items-center gap-1.5 transition-all cursor-pointer ${
              isEnding
                ? "border-amber-400 bg-amber-500/20 text-white font-medium"
                : "border-white/10 bg-white/5 text-white/50 hover:text-white"
            }`}
          >
            <Flag size={12} className={isEnding ? "text-amber-300" : "text-white/40"} />
            <span>结局收敛点</span>
          </button>
        </div>
      </div>

      {isEnding ? (
        <div className="space-y-2.5 pt-1">
          <label className="text-white/60 block text-[11px]">结局类型设定</label>
          <select
            className="w-full rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400"
            value={endingType}
            onChange={(e) => setEndingType(e.target.value as any)}
          >
            <option value="normal">🏆 正常通关结局 (Normal / True End)</option>
            <option value="bad">💀 挫败结局 (Bad End / 意外淘汰)</option>
            <option value="secret">🌟 隐藏特殊彩蛋结局 (Secret End)</option>
          </select>
          <p className="text-[11px] text-amber-200/70 leading-relaxed bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
            已标记为此故事线的结局收敛节点。模拟试玩播放到此镜头时，系统将判定为通关并呈现结局汇总。
          </p>
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-[11px] flex items-center gap-1">
              <Clock size={11} className="text-purple-400" />
              互动选择支 ({choices.length}/4)
            </span>
            {choices.length < 4 && (
              <button
                type="button"
                onClick={handleAddChoice}
                className="text-[11px] text-purple-300 hover:text-purple-200 flex items-center gap-1 cursor-pointer"
              >
                <Plus size={11} /> 添加选项
              </button>
            )}
          </div>

          {/* 选项列表 */}
          <div className="space-y-2">
            {choices.map((choice, idx) => (
              <div
                key={choice.id}
                className="p-2.5 rounded-lg border border-white/10 bg-black/40 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={choice.label}
                    onChange={(e) => handleUpdateChoice(choice.id, { label: e.target.value })}
                    className="flex-1 bg-transparent border-b border-white/20 text-xs text-white focus:border-purple-400 outline-none pb-0.5"
                    placeholder="输入选项文案..."
                  />
                  {choices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveChoice(choice.id)}
                      className="text-white/30 hover:text-red-400 p-0.5"
                      title="删除此选项"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-white/40 shrink-0">跳转镜头:</span>
                  <select
                    className="flex-1 rounded bg-white/5 border border-white/10 px-2 py-1 text-white text-[11px] outline-none"
                    value={choice.targetNodeId}
                    onChange={(e) => handleUpdateChoice(choice.id, { targetNodeId: e.target.value })}
                  >
                    <option value="">-- 选择下游分支节点 --</option>
                    {otherNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.title || `节点 ${n.id.slice(0, 6)}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* 一键在画布上创建下游分支节点 */}
          {onCreateBranchNode && (
            <div className="pt-2 border-t border-purple-500/20 space-y-1.5">
              <label className="text-white/60 block text-[11px]">快速在画布生成下游分支镜头</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newBranchTitle}
                  onChange={(e) => setNewBranchTitle(e.target.value)}
                  placeholder="例如: 分支镜头：破门逃跑"
                  className="flex-1 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 text-xs text-white outline-none focus:border-purple-400"
                />
                <button
                  type="button"
                  onClick={handleCreateBranch}
                  disabled={!newBranchTitle.trim()}
                  className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-medium cursor-pointer shrink-0 flex items-center gap-1"
                >
                  <Plus size={12} /> 生成
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
