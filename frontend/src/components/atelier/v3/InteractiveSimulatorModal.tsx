"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Play,
  Pause,
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
  Volume2,
  VolumeX,
  Film,
  Zap,
  Flag,
} from "lucide-react";
import type { AtelierNode } from "@/lib/atelierTypes";
import {
  getInteractiveBranchData,
  resolveNodeMediaSlice,
  interactiveMediaPreloadPool,
  type InteractiveChoice,
} from "@/lib/interactiveDrama";
import { interactiveSoundEngine } from "@/lib/interactiveAudio";

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
    return nodes.filter(
      (n) => n.type === "idea" || n.type === "plan" || n.type === "image" || n.type === "video"
    );
  }, [nodes]);

  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number>(10);
  const [maxCountdown, setMaxCountdown] = useState<number>(10);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(true);
  const [preloadedCount, setPreloadedCount] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);

  // 初始化起点节点
  useEffect(() => {
    if (!isOpen || storyNodes.length === 0) return;
    const startNode =
      storyNodes.find(
        (n) =>
          n.title?.includes("起") ||
          n.title?.includes("开端") ||
          n.title?.includes("初始") ||
          n.title?.includes("镜头1") ||
          n.title?.includes("SHOT-01")
      ) || storyNodes[0];

    if (startNode) {
      setCurrentNodeId(startNode.id);
      setHistory([startNode.id]);
      const branchData = getInteractiveBranchData(startNode);
      const configuredTimeout = branchData.choices?.[0]?.timeoutSeconds || 10;
      setCountdown(configuredTimeout);
      setMaxCountdown(configuredTimeout);
    }
  }, [isOpen, storyNodes]);

  const currentNode = useMemo(() => {
    return storyNodes.find((n) => n.id === currentNodeId) || storyNodes[0];
  }, [storyNodes, currentNodeId]);

  // 获取当前节点媒体切片
  const currentMediaSlice = useMemo(() => {
    return resolveNodeMediaSlice(currentNode);
  }, [currentNode]);

  // 判定是否是结局节点
  const branchData = useMemo(() => {
    return currentNode ? getInteractiveBranchData(currentNode) : { isEnding: false, choices: [] };
  }, [currentNode]);

  const isEnding = Boolean(branchData.isEnding);
  const endingType = branchData.endingType || "normal";

  // 解析当前节点的所有下级选项
  const resolvedChoices = useMemo(() => {
    if (!currentNode || isEnding) return [];

    // 1. 如果节点显式配置了 choices 列表且有 targetNodeId
    if (Array.isArray(branchData.choices) && branchData.choices.length > 0) {
      const validConfigured = branchData.choices
        .map((c, idx) => {
          const target = storyNodes.find((n) => n.id === c.targetNodeId);
          return {
            id: c.id,
            label: c.label || `选项 ${String.fromCharCode(65 + idx)}：推进剧情`,
            targetNodeId: c.targetNodeId,
            targetNode: target,
            timeoutSeconds: c.timeoutSeconds || 10,
          };
        })
        .filter((c) => c.targetNode && c.targetNodeId !== currentNode.id);

      if (validConfigured.length > 0) {
        return validConfigured;
      }
    }

    // 2. 拓扑回退：选取未访问过的故事节点
    const candidateNodes = storyNodes.filter(
      (n) => n.id !== currentNode.id && !history.includes(n.id)
    );

    return candidateNodes.slice(0, 4).map((node, idx) => ({
      id: `fallback-choice-${node.id}`,
      label: `选项 ${String.fromCharCode(65 + idx)}：${node.title || "继续探索"}`,
      targetNodeId: node.id,
      targetNode: node,
      timeoutSeconds: 10,
    }));
  }, [currentNode, isEnding, branchData, storyNodes, history]);

  // 候选分支切片预加载与缓存调度
  useEffect(() => {
    if (!isOpen || resolvedChoices.length === 0) return;

    let readyCount = 0;
    resolvedChoices.forEach((choice) => {
      if (!choice.targetNode) return;
      const slice = resolveNodeMediaSlice(choice.targetNode);
      if (slice.url) {
        interactiveMediaPreloadPool.preloadSlice(slice.url, slice.kind === "video");
        readyCount++;
      }
    });
    setPreloadedCount(readyCount);
  }, [isOpen, resolvedChoices]);

  // 结局达成音效触发
  useEffect(() => {
    if (!isOpen || !isEnding) return;
    if (endingType === "bad") {
      interactiveSoundEngine.playEndingDefeat();
    } else if (endingType === "secret") {
      interactiveSoundEngine.playEndingSuccess(true);
    } else {
      interactiveSoundEngine.playEndingSuccess(false);
    }
  }, [isOpen, isEnding, endingType]);

  // 做出选择
  const handleChoose = (targetId: string) => {
    interactiveSoundEngine.playChoiceSelected();
    setCurrentNodeId(targetId);
    setHistory((prev) => [...prev, targetId]);

    const nextNode = storyNodes.find((n) => n.id === targetId);
    const nextBranchData = nextNode ? getInteractiveBranchData(nextNode) : { choices: [] };
    const nextTimeout = nextBranchData.choices?.[0]?.timeoutSeconds || 10;
    setCountdown(nextTimeout);
    setMaxCountdown(nextTimeout);
  };

  // 倒计时计时器与滴答心跳音效
  useEffect(() => {
    if (!isOpen || isTimerPaused || isEnding || countdown < 0) return;

    if (countdown === 0) {
      // 倒计时归零，超时自动选择默认分支
      if (resolvedChoices.length > 0 && resolvedChoices[0].targetNodeId) {
        handleChoose(resolvedChoices[0].targetNodeId);
      }
      return;
    }

    // 播放倒计时声音 (最后3秒为急促警报音)
    interactiveSoundEngine.playCountdownTick(countdown <= 3);

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isOpen, isTimerPaused, isEnding, countdown, resolvedChoices]);

  if (!isOpen) return null;

  // 切换静音
  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    interactiveSoundEngine.setMuted(next);
  };

  // 重置试玩
  const handleRestart = () => {
    const startNode =
      storyNodes.find(
        (n) =>
          n.title?.includes("起") ||
          n.title?.includes("开端") ||
          n.title?.includes("初始") ||
          n.title?.includes("镜头1")
      ) || storyNodes[0];

    if (startNode) {
      setCurrentNodeId(startNode.id);
      setHistory([startNode.id]);
      const bd = getInteractiveBranchData(startNode);
      const initialTimeout = bd.choices?.[0]?.timeoutSeconds || 10;
      setCountdown(initialTimeout);
      setMaxCountdown(initialTimeout);
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

    const prevNode = storyNodes.find((n) => n.id === prevId);
    const bd = prevNode ? getInteractiveBranchData(prevNode) : { choices: [] };
    const prevTimeout = bd.choices?.[0]?.timeoutSeconds || 10;
    setCountdown(prevTimeout);
    setMaxCountdown(prevTimeout);
  };

  // 统计数据
  const endingCount = storyNodes.filter((n) => {
    const bd = getInteractiveBranchData(n);
    return (
      bd.isEnding ||
      n.title?.includes("结局") ||
      n.title?.includes("End") ||
      n.title?.includes("通关")
    );
  }).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-sans text-foreground">
      <div className="relative w-full max-w-4xl max-h-[94vh] overflow-hidden rounded-2xl border border-purple-500/40 bg-[#0c0d16] shadow-2xl flex flex-col">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between border-b border-purple-500/20 bg-purple-950/20 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400">
              <Gamepad2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  互动影游 · 决策模拟试玩器
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Interactive Simulator
                  </span>
                </h3>
              </div>
              <p className="text-xs text-white/50 mt-0.5">
                {taskTitle ? `商单需求：${taskTitle}` : "实时模拟玩家决策、切片秒切无缝流与分支结局收敛"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 音效控制按钮 */}
            <button
              type="button"
              onClick={toggleMute}
              title={isMuted ? "开启倒计时与选择音效" : "静音模拟器音效"}
              aria-label={isMuted ? "取消静音" : "静音"}
              className={`p-2 rounded-xl border text-xs transition-all cursor-pointer ${
                isMuted
                  ? "border-white/10 bg-white/5 text-white/40 hover:text-white"
                  : "border-purple-500/40 bg-purple-500/20 text-purple-300 shadow-sm"
              }`}
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>

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
              aria-label="关闭"
              className="p-1.5 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 状态统计与切片缓存面板条 */}
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
            {preloadedCount > 0 && (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Zap size={13} className="text-emerald-400 fill-emerald-400/30" />
                分支切片缓存：<strong>已就绪 ({preloadedCount})</strong>
              </span>
            )}
          </div>

          {/* 路径面包屑 */}
          <div className="flex items-center gap-1 text-[11px] text-white/40 overflow-hidden max-w-[380px]">
            <span>探索路线:</span>
            {history.map((id, index) => {
              const node = storyNodes.find((n) => n.id === id);
              return (
                <span key={id} className="flex items-center gap-1 shrink-0">
                  <span
                    className={
                      index === history.length - 1 ? "text-purple-300 font-semibold" : "text-white/60"
                    }
                  >
                    {node?.title || `节点${index + 1}`}
                  </span>
                  {index < history.length - 1 && (
                    <ChevronRight size={10} className="text-white/30" />
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* 主演播试玩视口 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
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
            <div className="space-y-5">
              {/* 核心演播卡片 (带视频切片或图片原画预览) */}
              <div className="relative rounded-2xl overflow-hidden border border-purple-500/30 bg-black shadow-2xl flex flex-col justify-between">
                {/* 倒计时进度条 (顶部流光跑马灯) */}
                {!isEnding && (
                  <div className="absolute top-0 left-0 right-0 z-20 h-1.5 bg-white/10">
                    <div
                      className={`h-full transition-all duration-1000 ease-linear ${
                        countdown <= 3
                          ? "bg-gradient-to-r from-red-500 to-amber-500 animate-pulse"
                          : "bg-gradient-to-r from-purple-500 to-pink-500"
                      }`}
                      style={{
                        width: `${Math.max(0, Math.min(100, (countdown / maxCountdown) * 100))}%`,
                      }}
                    />
                  </div>
                )}

                {/* 媒体切片视口区域 */}
                <div className="relative w-full aspect-video max-h-[380px] bg-black flex items-center justify-center overflow-hidden">
                  {currentMediaSlice.kind === "video" && currentMediaSlice.url ? (
                    <div className="relative w-full h-full">
                      <video
                        ref={videoRef}
                        src={currentMediaSlice.url}
                        autoPlay
                        loop
                        muted={isMuted}
                        playsInline
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (videoRef.current) {
                            if (videoRef.current.paused) {
                              void videoRef.current.play();
                              setIsPlayingVideo(true);
                            } else {
                              videoRef.current.pause();
                              setIsPlayingVideo(false);
                            }
                          }
                        }}
                        className="absolute bottom-3 left-3 z-20 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white/70 hover:text-white text-xs flex items-center gap-1 border border-white/10"
                      >
                        {isPlayingVideo ? <Pause size={12} /> : <Play size={12} />}
                        <span>切片回放</span>
                      </button>
                    </div>
                  ) : currentMediaSlice.kind === "image" && currentMediaSlice.url ? (
                    <img
                      src={currentMediaSlice.url}
                      alt={currentNode?.title || "剧情原画"}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-purple-950/30 to-black text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                        <Film size={24} />
                      </div>
                      <p className="text-xs text-white/40 max-w-sm">
                        当前镜头正在进行 AI 视频生成渲染中；下方将先以剧情设定与分镜脚本流运行决策树。
                      </p>
                    </div>
                  )}

                  {/* 悬浮镜头名称与倒计时徽标 */}
                  <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/20 text-purple-300 font-semibold flex items-center gap-1.5 shadow-lg">
                      <Play size={12} className="fill-purple-400" />
                      当前播放镜头：{currentNode?.title}
                    </span>
                    {isEnding ? (
                      <span
                        className={`text-xs px-2.5 py-1 rounded-lg backdrop-blur-md border font-bold flex items-center gap-1 shadow-lg ${
                          endingType === "bad"
                            ? "bg-red-950/80 border-red-500/40 text-red-300"
                            : endingType === "secret"
                            ? "bg-amber-950/80 border-amber-500/40 text-amber-300"
                            : "bg-emerald-950/80 border-emerald-500/40 text-emerald-300"
                        }`}
                      >
                        <Flag size={12} />
                        {endingType === "bad"
                          ? "💀 挫败结局达成"
                          : endingType === "secret"
                          ? "🌟 隐藏彩蛋结局达成"
                          : "🏆 正常通关结局达成"}
                      </span>
                    ) : (
                      <span
                        className={`text-xs px-2.5 py-1 rounded-lg backdrop-blur-md border font-mono flex items-center gap-1.5 shadow-lg transition-colors ${
                          countdown <= 3
                            ? "bg-red-950/80 border-red-500/50 text-red-300 font-bold animate-pulse"
                            : "bg-black/75 border-white/20 text-white/80"
                        }`}
                      >
                        <Clock size={12} className={countdown <= 3 ? "text-red-400" : "text-purple-400"} />
                        抉择倒计时: {countdown}s
                      </span>
                    )}
                  </div>

                  {history.length > 1 && (
                    <button
                      type="button"
                      onClick={handleStepBack}
                      className="absolute top-4 right-4 z-20 text-xs text-white/70 hover:text-white px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/20 hover:bg-black/90 transition-all cursor-pointer"
                    >
                      撤销上一步
                    </button>
                  )}
                </div>

                {/* 剧情画面叙事描述卡片 */}
                <div className="p-5 bg-gradient-to-b from-black/80 to-[#0e0f18] border-t border-white/10 space-y-2">
                  <p className="text-sm md:text-base font-medium text-white/95 leading-relaxed">
                    {currentNode?.prompt ||
                      (currentNode as any)?.body ||
                      "主角站在雨夜的旧宅门前，雷光闪烁，摆在眼前的抉择将改变接下来的走向..."}
                  </p>
                </div>

                {/* 底部交互决策选项区 */}
                {isEnding ? (
                  <div className="p-5 bg-purple-950/30 border-t border-purple-500/30 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="font-bold text-white text-sm flex items-center gap-1.5">
                        <CheckCircle2 size={16} className="text-emerald-400" />
                        恭喜！已通关此剧情分支（达成结局）
                      </span>
                      <p className="text-xs text-white/60 leading-relaxed">
                        本轮探索路线已完整存证并记录；您可以重新试玩探索其他潜在的不同结局与隐藏支线。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRestart}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all shrink-0 cursor-pointer"
                    >
                      重新探索其他结局
                    </button>
                  </div>
                ) : (
                  <div className="p-5 bg-black/40 border-t border-white/10 space-y-3">
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span className="flex items-center gap-1.5 font-semibold text-purple-300">
                        <GitBranch size={14} className="text-purple-400" />
                        请玩家做出选择（点击分支推进剧情）：
                      </span>
                      <span className="text-[11px] text-white/40">
                        倒计时归零将默认自动推进首选分支
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {resolvedChoices.map((choice, idx) => {
                        const targetNode = choice.targetNode;
                        return (
                          <button
                            key={choice.id}
                            type="button"
                            onClick={() => handleChoose(choice.targetNodeId)}
                            className="group relative p-3.5 rounded-xl border border-purple-500/30 bg-purple-950/30 hover:bg-purple-900/50 hover:border-purple-400 transition-all text-left flex items-center justify-between cursor-pointer"
                          >
                            <div className="space-y-1 pr-3">
                              <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block">
                                {choice.label}
                              </span>
                              <span className="text-xs font-semibold text-white group-hover:text-purple-200 line-clamp-1">
                                {targetNode?.title || "未命名故事节点"}
                              </span>
                            </div>
                            <ArrowRight
                              size={16}
                              className="text-purple-400/50 group-hover:text-purple-300 group-hover:translate-x-1 transition-all shrink-0"
                            />
                          </button>
                        );
                      })}

                      {resolvedChoices.length === 0 && (
                        <div className="col-span-2 p-4 text-center text-xs text-white/50 border border-dashed border-white/20 rounded-xl">
                          已探索至末端节点，请在画布中为该节点继续添加下级分支选项。
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
