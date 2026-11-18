"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  ShieldCheck,
  Sparkles,
  Terminal,
  Copy,
  Check,
  Eye,
  Sliders,
} from "lucide-react";
import {
  renderWatermarkOnCanvas,
  buildFFmpegWatermarkCommand,
  type WatermarkOptions,
} from "@/lib/watermarkSynthesizer";
import type { PlatformTask } from "@/lib/platformApi";

interface WatermarkPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: PlatformTask;
  creatorName: string;
}

export function WatermarkPreviewModal({
  isOpen,
  onClose,
  task,
  creatorName,
}: WatermarkPreviewModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [opacity, setOpacity] = useState(0.25);
  const [copied, setCopied] = useState(false);

  const ffmpegCommand = buildFFmpegWatermarkCommand(
    "input_master_render.mp4",
    `delivery_${task.id}_watermarked.mp4`,
    {
      creatorName,
      taskId: task.id,
      clientName: task.client_name,
      opacity,
      digestHash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    }
  );

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 清空画布并绘制模拟成片背景
    ctx.fillStyle = "#0c0d16";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制模拟电影级深空渐变与分镜画面
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#12142b");
    grad.addColorStop(0.5, "#241838");
    grad.addColorStop(1, "#0a0b12");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制模拟镜头元素
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.height * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`【模拟样片画面 · ${task.title}】`, canvas.width / 2, canvas.height / 2);

    // 施加动态防盗水印
    renderWatermarkOnCanvas(ctx, canvas.width, canvas.height, {
      creatorName,
      taskId: task.id,
      clientName: task.client_name,
      opacity,
      digestHash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    });
  }, [isOpen, opacity, task, creatorName]);

  if (!isOpen) return null;

  const handleCopy = () => {
    void navigator.clipboard.writeText(ffmpegCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 font-sans text-foreground">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-glass-border bg-[#0d0e14]/95 p-6 shadow-2xl space-y-5">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between border-b border-glass-border pb-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/15 border border-primary/30 text-primary">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                商业交付样片 · 动态防盗水印合成预览
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Anti-Theft Protected
                </span>
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                交付初审样片自动施加对角线阵列水印与时间戳存证，有效杜绝跳单与盗用
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="p-1 rounded-lg text-text-muted hover:text-foreground hover:bg-hover-bg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* 交互视口 */}
        <div className="space-y-4">
          <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-white/10 bg-black shadow-inner flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={960}
              height={540}
              className="w-full h-full object-contain"
            />
          </div>

          {/* 实时调整水印参数 */}
          <div className="p-3.5 rounded-xl border border-glass-border bg-surface-inset/50 flex items-center justify-between gap-6 text-xs">
            <div className="flex items-center gap-2 text-text-secondary">
              <Sliders size={14} className="text-primary" />
              <span>水印半透明度:</span>
              <strong className="text-foreground font-mono">{Math.round(opacity * 100)}%</strong>
            </div>
            <input
              type="range"
              min={10}
              max={60}
              value={Math.round(opacity * 100)}
              onChange={(e) => setOpacity(parseInt(e.target.value, 10) / 100)}
              aria-label="水印透明度滑块"
              className="flex-1 max-w-xs h-1.5 cursor-pointer appearance-none rounded-full bg-white/10 accent-primary"
            />
            <span className="text-[11px] text-text-muted">
              推荐值 25%：既不影响客户质检验收，又杜绝被裁切盗用
            </span>
          </div>

          {/* 本地原生 / FFmpeg 硬件加速压制指令 */}
          <div className="rounded-xl border border-glass-border bg-black/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-text-secondary">
                <Terminal size={13} className="text-amber-400" />
                本地硬件加速压制指令（FFmpeg 原生管线）：
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
              >
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copied ? "已复制命令" : "复制命令"}</span>
              </button>
            </div>
            <pre className="p-2.5 rounded-lg bg-surface-inset/80 border border-glass-border text-[11px] font-mono text-text-secondary overflow-x-auto whitespace-pre-wrap select-all">
              {ffmpegCommand}
            </pre>
          </div>
        </div>

        {/* 底部按钮栏 */}
        <div className="flex items-center justify-end border-t border-glass-border pt-3">
          <button
            type="button"
            onClick={onClose}
            className="bg-primary text-foreground font-semibold px-4 py-2 rounded-xl text-xs hover:opacity-90 transition-opacity cursor-pointer"
          >
            确定并返回交付
          </button>
        </div>
      </div>
    </div>
  );
}
