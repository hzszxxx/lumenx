"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Play,
  Pause,
  Columns,
  Layers,
  SplitSquareVertical,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  Maximize2
} from "lucide-react";
import { getAssetUrl } from "@/lib/utils";

export type CompareMode = "wipe" | "side_by_side" | "onion_skin" | "difference";

export interface ClayWipeCompareModalProps {
  open: boolean;
  onClose: () => void;
  renderUrl: string;
  renderKind?: "video" | "image";
  clayUrl: string;
  clayKind?: "video" | "image";
  title?: string;
  clayLabel?: string;
  renderLabel?: string;
}

export default function ClayWipeCompareModal({
  open,
  onClose,
  renderUrl,
  renderKind = "video",
  clayUrl,
  clayKind = "image",
  title = "白模 / 灰模与 AI 成片比对",
  clayLabel = "3D 白模底模 (Previz / Clay)",
  renderLabel = "AI 真实成片 (Rendered Shot)",
}: ClayWipeCompareModalProps) {
  const [mode, setMode] = useState<CompareMode>("wipe");
  const [sliderPos, setSliderPos] = useState<number>(50); // 0 to 100 percentage
  const [isDragging, setIsDragging] = useState(false);
  const [onionOpacity, setOnionOpacity] = useState<number>(50); // 0 to 100
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0); // 0 to 1

  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderVideoRef = useRef<HTMLVideoElement | null>(null);
  const clayVideoRef = useRef<HTMLVideoElement | null>(null);

  const resolvedRender = getAssetUrl(renderUrl);
  const resolvedClay = getAssetUrl(clayUrl);

  const hasVideo = renderKind === "video" || clayKind === "video";

  // Master clock & video sync loop
  useEffect(() => {
    if (!open || !hasVideo || !isPlaying) return;
    let rafId = 0;
    const tick = () => {
      const master = renderVideoRef.current || clayVideoRef.current;
      const follower = master === renderVideoRef.current ? clayVideoRef.current : renderVideoRef.current;

      if (master && master.duration) {
        setProgress(master.currentTime / master.duration);
        if (follower && follower.duration && Math.abs(follower.currentTime - master.currentTime) > 0.05) {
          try {
            follower.currentTime = master.currentTime;
          } catch {
            /* ignore */
          }
        }
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [open, hasVideo, isPlaying]);

  // Keyboard shortcut handlers (Escape, Space)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === " " && hasVideo) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, hasVideo, isPlaying]);

  const togglePlay = () => {
    const next = !isPlaying;
    setIsPlaying(next);
    if (renderVideoRef.current) {
      if (next) renderVideoRef.current.play().catch(() => {});
      else renderVideoRef.current.pause();
    }
    if (clayVideoRef.current) {
      if (next) clayVideoRef.current.play().catch(() => {});
      else clayVideoRef.current.pause();
    }
  };

  const handleSeek = (frac: number) => {
    setProgress(frac);
    if (renderVideoRef.current && renderVideoRef.current.duration) {
      try {
        renderVideoRef.current.currentTime = frac * renderVideoRef.current.duration;
      } catch {}
    }
    if (clayVideoRef.current && clayVideoRef.current.duration) {
      try {
        clayVideoRef.current.currentTime = frac * clayVideoRef.current.duration;
      } catch {}
    }
  };

  // Slider drag tracking
  const updateSliderFromClientX = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const relativeX = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    updateSliderFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateSliderFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  if (!open || typeof document === "undefined") return null;

  const content = (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md transition-opacity duration-200"
      />

      {/* Main Dialog Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-4 z-[71] md:inset-8 lg:inset-12 flex flex-col rounded-2xl border border-white/10 bg-[#0d0f14] shadow-[0_24px_80px_rgba(0,0,0,0.9)] overflow-hidden"
      >
        {/* Top Header Bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                {title}
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Previz vs Render
                </span>
              </h2>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 rounded-xl bg-black/40 p-1 border border-white/5">
            <button
              type="button"
              onClick={() => setMode("wipe")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === "wipe"
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <SplitSquareVertical size={13} />
              <span>卷帘对比 (Wipe)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("side_by_side")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === "side_by_side"
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Columns size={13} />
              <span>左右并排</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("onion_skin")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === "onion_skin"
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Layers size={13} />
              <span>叠化透视</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("difference")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === "difference"
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Maximize2 size={13} />
              <span>差值对位</span>
            </button>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </header>

        {/* Viewport Area */}
        <div className="relative flex-1 bg-black/90 overflow-hidden flex items-center justify-center p-4">
          {/* 1. Wipe Mode (Split Slider) */}
          {mode === "wipe" && (
            <div
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="relative w-full h-full max-h-[76vh] aspect-video max-w-5xl rounded-xl overflow-hidden border border-white/10 select-none cursor-ew-resize shadow-2xl bg-black"
            >
              {/* Bottom Layer: AI Rendered Shot (Full View) */}
              <div className="absolute inset-0 w-full h-full">
                {renderKind === "video" ? (
                  <video
                    ref={renderVideoRef}
                    src={resolvedRender}
                    muted={isMuted}
                    loop
                    playsInline
                    className="w-full h-full object-contain pointer-events-none"
                  />
                ) : (
                  <img
                    src={resolvedRender}
                    alt="AI成片渲染"
                    className="w-full h-full object-contain pointer-events-none"
                  />
                )}
                {/* Right Badge */}
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-purple-950/80 backdrop-blur-md border border-purple-500/40 text-[11px] font-medium text-purple-200">
                  {renderLabel}
                </div>
              </div>

              {/* Top Layer: 3D Clay Previz (Clipped from left to sliderPos%) */}
              <div
                className="absolute inset-0 w-full h-full overflow-hidden"
                style={{
                  clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`,
                }}
              >
                {clayKind === "video" ? (
                  <video
                    ref={clayVideoRef}
                    src={resolvedClay}
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-contain pointer-events-none"
                  />
                ) : (
                  <img
                    src={resolvedClay}
                    alt="3D白模底模"
                    className="w-full h-full object-contain pointer-events-none filter grayscale contrast-125"
                  />
                )}
                {/* Left Badge */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-zinc-900/80 backdrop-blur-md border border-white/20 text-[11px] font-medium text-zinc-200">
                  {clayLabel}
                </div>
              </div>

              {/* Vertical Split Divider Bar */}
              <div
                className="absolute top-0 bottom-0 z-20 w-[2px] bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] pointer-events-none"
                style={{ left: `${sliderPos}%` }}
              >
                {/* Center Handle Pill */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center h-10 w-6 rounded-full bg-white text-black shadow-lg font-mono text-[10px] font-bold">
                  ◂▸
                </div>
              </div>
            </div>
          )}

          {/* 2. Side-by-Side Mode */}
          {mode === "side_by_side" && (
            <div className="grid grid-cols-2 gap-4 w-full h-full max-h-[76vh] max-w-6xl">
              {/* Left: 3D Clay */}
              <div className="relative rounded-xl border border-white/10 bg-black overflow-hidden flex items-center justify-center">
                <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md bg-zinc-900/80 backdrop-blur-md border border-white/20 text-[11px] font-medium text-zinc-200">
                  {clayLabel}
                </div>
                {clayKind === "video" ? (
                  <video
                    ref={clayVideoRef}
                    src={resolvedClay}
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={resolvedClay}
                    alt="3D白模"
                    className="w-full h-full object-contain grayscale"
                  />
                )}
              </div>

              {/* Right: AI Render */}
              <div className="relative rounded-xl border border-purple-500/20 bg-black overflow-hidden flex items-center justify-center">
                <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-md bg-purple-950/80 backdrop-blur-md border border-purple-500/40 text-[11px] font-medium text-purple-200">
                  {renderLabel}
                </div>
                {renderKind === "video" ? (
                  <video
                    ref={renderVideoRef}
                    src={resolvedRender}
                    muted={isMuted}
                    loop
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={resolvedRender}
                    alt="AI成片"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            </div>
          )}

          {/* 3. Onion Skin Overlay Mode */}
          {(mode === "onion_skin" || mode === "difference") && (
            <div className="relative w-full h-full max-h-[76vh] aspect-video max-w-5xl rounded-xl overflow-hidden border border-white/10 bg-black flex items-center justify-center">
              {/* Bottom Render */}
              <div className="absolute inset-0 w-full h-full">
                {renderKind === "video" ? (
                  <video
                    ref={renderVideoRef}
                    src={resolvedRender}
                    muted={isMuted}
                    loop
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={resolvedRender}
                    alt="AI成片"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              {/* Top Clay (with Opacity or Difference Blend) */}
              <div
                className={`absolute inset-0 w-full h-full pointer-events-none ${
                  mode === "difference" ? "mix-blend-difference" : ""
                }`}
                style={{
                  opacity: mode === "difference" ? 1 : onionOpacity / 100,
                }}
              >
                {clayKind === "video" ? (
                  <video
                    ref={clayVideoRef}
                    src={resolvedClay}
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={resolvedClay}
                    alt="3D白模"
                    className="w-full h-full object-contain grayscale"
                  />
                )}
              </div>

              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[11px] text-white/80">
                {mode === "difference" ? "差值透视对位 (高亮区域表示与白模轮廓发生位移)" : `白模叠化透明度: ${onionOpacity}%`}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <footer className="flex h-16 shrink-0 items-center justify-between border-t border-white/10 px-6 bg-white/[0.02]">
          {/* Playback Controls (if video) */}
          <div className="flex items-center gap-3">
            {hasVideo && (
              <>
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? "暂停" : "播放"}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md shadow-purple-600/30"
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  title={isMuted ? "静音 (点击开声)" : "静音"}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                >
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              </>
            )}

            {/* Quick reset slider */}
            {mode === "wipe" && (
              <button
                type="button"
                onClick={() => setSliderPos(50)}
                title="重置卷帘至居中 50%"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-xs transition-colors"
              >
                <RotateCcw size={12} />
                <span>50% 居中</span>
              </button>
            )}
          </div>

          {/* Timeline or Mode-Specific Slider in Middle */}
          <div className="flex-1 max-w-xl mx-6">
            {hasVideo ? (
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-white/40">进度</span>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  value={Math.round(progress * 1000)}
                  onChange={(e) => handleSeek(parseInt(e.target.value, 10) / 1000)}
                  aria-label="播放进度"
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-purple-500 focus:outline-none"
                />
              </div>
            ) : mode === "onion_skin" ? (
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-white/40">白模叠化透视</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={onionOpacity}
                  onChange={(e) => setOnionOpacity(parseInt(e.target.value, 10))}
                  aria-label="叠化透明度"
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-purple-500 focus:outline-none"
                />
                <span className="text-xs font-mono text-purple-300 w-8">{onionOpacity}%</span>
              </div>
            ) : mode === "wipe" ? (
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-white/40">卷帘割线</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(sliderPos)}
                  onChange={(e) => setSliderPos(parseInt(e.target.value, 10))}
                  aria-label="卷帘割线位置"
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-purple-500 focus:outline-none"
                />
                <span className="text-xs font-mono text-purple-300 w-8">{Math.round(sliderPos)}%</span>
              </div>
            ) : null}
          </div>

          {/* Shortcut hint */}
          <div className="text-[11px] font-mono text-white/35">
            空格键 播放/暂停 · ESC 退出比对
          </div>
        </footer>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
