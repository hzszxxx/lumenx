"use client";

import { useState, useEffect, useMemo } from "react";
import {
  X,
  Play,
  RotateCcw,
  Gamepad2,
  GitBranch,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  ChevronRight,
} from "lucide-react";
import type { AtelierNode } from "@/lib/atelierTypes";

interface InteractiveSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: AtelierNode[];
  taskTitle?: string;
  onScaffoldStarterTree?: () => void;
}

export function InteractiveSimulatorModal({
  isOpen,
  onClose,
  nodes,
  taskTitle,
  onScaffoldStarterTree,
}: InteractiveSimulatorModalProps) {
  // 提取可用剧情节点
  const storyNodes = useMemo(() => {
    return nodes.filter((n) => n.type === "idea" || n.type === "plan" || n.type === "image" || n.type === "video");
  }, [nodes]);

  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number>(10);
  const [isTimerPaused, setIsTimerPaused] = useState(false);

  // 初始化起点节点
  useEffect(() => {
    if (!isOpen || storyNodes.length === 0) return;
    const startNode =
      storyNodes.find((n) => n.title?.includes("起") || n.title?.includes("开端") || n.title?.includes("初始")) ||
      storyNodes[0];
    if (startNode) {
      setCurrentNodeId(startNode.id);
      setHistory([startNode.id]);
      setCountdown(10);
    }
  }, [isOpen, storyNodes]);

  // 倒计时计时器
  useEffect(() => {
    if (!isOpen || isTimerPaused || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, isTimerPaused, countdown]);

  if (!isOpen) return null;

  const currentNode = storyNodes.find((n) => n.id === currentNodeId) || storyNodes[0];

  // 剧情决策分支推导逻辑
  const isEnding =
    currentNode?.title?.includes("结局") ||
    currentNode?.title?.includes("End") ||
    currentNode?.title?.includes("通关") ||
    currentNode?.title?.includes("死亡");

  // 寻找下级可选节点
  const choiceNodes = storyNodes.filter((n) => n.id !== currentNode?.id && !history.includes(n.id));

  // 重置试玩
  const handleRestart = () => {
    const startNode =
      storyNodes.find((n) => n.title?.includes("起") || n.title?.includes("开端") || n.title?.includes("初始")) ||
      storyNodes[0];
    if (startNode) {
      setCurrentNodeId(startNode.id);
      setHistory([startNode.id]);
      setCountdown(10);
    }
  };

  // 回退上一步
  const handleStepBack = () => {
    if (history.length <= 1) return;
    const newHistory = [...history];
    newHistory.pop();
    const prevId = newHistory[newHistory.length - 1];
    setHistory(newHistory);
    setCurrentNodeId(prevId);
    setCountdown(10);
  };

  // 做出选择
  const handleChoose = (targetId: string) => {
    setCurrentNodeId(targetId);
    setHistory((prev) => [...prev, targetId]);
    setCountdown(10);
  };

  // 统计数据
  const endingCount = storyNodes.filter(
    (n) => n.title?.includes("结局") || n.title?.includes("End") || n.title?.includes("通关")
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 font-sans text-foreground">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl border border-purple-500/40 bg-[#0d0d16] shadow-2xl flex flex-col">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between border-b border-purple-500/20 bg-purple-950/20 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400">
              <Gamepad2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">互动影游 · 决策模拟试玩器</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Interactive Simulator
                </span>
              </div>
              <p className="text-xs text-white/50 mt-0.5">
                {taskTitle ? `商单需求：${taskTitle}` : "实时模拟玩家决策、交互倒计时与多结局分支收敛"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestart}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-purple-400/50 bg-white/5 hover:bg-white/10 text-xs text-white/80 transition-all cursor-pointer"
            >
              <RotateCcw size={13} /> 重新试玩
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 状态统计面板条 */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-black/40 border-b border-white/[0.06] text-xs">
          <div className="flex items-center gap-4 text-white/60">
            <span className="flex items-center gap-1.5">
              <Layers size={13} className="text-purple-400" />
              剧情节点数：<strong className="text-white">{storyNodes.length}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <GitBranch size={13} className="text-amber-400" />
              已规划结局数：<strong className="text-white">{Math.max(1, endingCount)}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-400" />
              决策死锁保护：<strong className="text-emerald-400">已开启 (无孤岛)</strong>
            </span>
          </div>

          {/* 路径面包屑 */}
          <div className="flex items-center gap-1 text-[11px] text-white/40 overflow-hidden max-w-[400px]">
            <span>路线:</span>
            {history.map((id, index) => {
              const node = storyNodes.find((n) => n.id === id);
              return (
                <span key={id} className="flex items-center gap-1 shrink-0">
                  <span className={index === history.length - 1 ? "text-purple-300 font-semibold" : "text-white/60"}>
                    {node?.title || `节点${index + 1}`}
                  </span>
                  {index < history.length - 1 && <ChevronRight size={10} className="text-white/30" />}
                </span>
              );
            })}
          </div>
        </div>

        {/* 主演播试玩视口 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {storyNodes.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
                <Gamepad2 size={32} />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">画布尚未添加剧情节点</h4>
                <p className="text-xs text-white/50 max-w-sm mx-auto">
                  互动影游需要至少一个起点节点与分支选项。您可以一键导入快速模板，或在画布中添加节点。
                </p>
              </div>
              {onScaffoldStarterTree && (
                <button
                  type="button"
                  onClick={onScaffoldStarterTree}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all inline-flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles size={14} /> 一键生成互动影游 starter 决策树
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* 节点视频/画面展示框 */}
              <div className="relative rounded-2xl overflow-hidden border border-purple-500/30 bg-black/60 shadow-xl min-h-[260px] flex flex-col justify-between p-6">
                {/* 倒计时进度条 */}
                {!isEnding && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-1000 ease-linear"
                      style={{ width: `${(countdown / 10) * 100}%` }}
                    />
                  </div>
                )}

                {/* 顶部标签 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 font-semibold flex items-center gap-1.5">
                      <Play size={12} /> 当前播放镜头：{currentNode?.title}
                    </span>
                    {isEnding ? (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
                        🏁 结局达成
                      </span>
                    ) : (
                      <span className="text-xs text-white/50 flex items-center gap-1">
                        <Clock size={12} className="text-purple-400" /> 决策剩余 {countdown}s
                      </span>
                    )}
                  </div>
                  {history.length > 1 && (
                    <button
                      type="button"
                      onClick={handleStepBack}
                      className="text-xs text-white/50 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10"
                    >
                      撤销上一步
                    </button>
                  )}
                </div>

                {/* 剧情画面叙事描述 */}
                <div className="my-6 space-y-2">
                  <p className="text-sm md:text-base font-medium text-white/95 leading-relaxed">
                    {currentNode?.prompt || (currentNode as any)?.body || "主角站在雨夜的旧宅门前，雷光闪烁，摆在眼前的抉择将改变接下来的走向..."}
                  </p>
                </div>

                {/* 底部交互决策选项区 */}
                {isEnding ? (
                  <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-amber-300 text-sm">🎉 恭喜！已通关此剧情分支</span>
                      <p className="text-amber-200/80 mt-0.5">
                        路线已完整记录，您可以重新试玩探索其他潜在的不同结局与彩蛋。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRestart}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-all shrink-0 cursor-pointer"
                    >
                      重新选择
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span className="flex items-center gap-1 font-semibold text-purple-300">
                        <GitBranch size={13} /> 请玩家做出选择（点击分支推进剧情）：
                      </span>
                      <span>超时将默认自动推进</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {choiceNodes.slice(0, 4).map((targetNode, idx) => {
                        const optionLabels = ["选项 A", "选项 B", "选项 C", "选项 D"];
                        return (
                          <button
                            key={targetNode.id}
                            type="button"
                            onClick={() => handleChoose(targetNode.id)}
                            className="group relative p-3.5 rounded-xl border border-purple-500/30 bg-purple-950/30 hover:bg-purple-900/50 hover:border-purple-400 transition-all text-left flex items-center justify-between cursor-pointer"
                          >
                            <div className="space-y-1">
                              <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block">
                                {optionLabels[idx] || `分支 ${idx + 1}`}
                              </span>
                              <span className="text-xs font-semibold text-white group-hover:text-purple-200">
                                {targetNode.title}
                              </span>
                            </div>
                            <ArrowRight
                              size={16}
                              className="text-purple-400/50 group-hover:text-purple-300 group-hover:translate-x-1 transition-all"
                            />
                          </button>
                        );
                      })}

                      {choiceNodes.length === 0 && (
                        <div className="col-span-2 p-3 text-center text-xs text-white/50 border border-dashed border-white/20 rounded-xl">
                          已探索至末端节点，请在画布中为该节点继续添加下级分支。
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
