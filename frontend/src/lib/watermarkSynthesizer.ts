/**
 * Commercial Anti-Theft Watermark Synthesizer.
 * Supports Canvas 2D hardware-accelerated overlay and FFmpeg filter command generation.
 * Enforces industry standard protection for commercial client deliverables.
 */

export interface WatermarkOptions {
  primaryText?: string;
  creatorName?: string;
  taskId?: string;
  clientName?: string;
  opacity?: number;
  diagonalSpacing?: number;
  includeTimestamp?: boolean;
  includeDigestHash?: boolean;
  digestHash?: string;
}

/**
 * 在目标 Canvas 上施加全屏对角线防盗阵列与底部确权存证水印
 */
export function renderWatermarkOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: WatermarkOptions = {}
): void {
  const {
    primaryText = "影伴商业交付审阅样片 · 严禁商用 · 违者必究",
    creatorName,
    taskId,
    clientName,
    opacity = 0.22,
    diagonalSpacing = 220,
    includeTimestamp = true,
    includeDigestHash = true,
    digestHash,
  } = options;

  ctx.save();

  // 1. 绘制对角线倾斜阵列水印 (Diagonal Matrix)
  ctx.rotate((-25 * Math.PI) / 180);
  ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
  ctx.strokeStyle = `rgba(0, 0, 0, ${opacity * 0.7})`;
  ctx.lineWidth = 1.5;

  const dynamicFontSize = Math.max(14, Math.min(32, Math.round(width / 45)));
  ctx.font = `600 ${dynamicFontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;

  const subText = [
    creatorName ? `承揽创作者: ${creatorName}` : "",
    taskId ? `商单ID: ${taskId.slice(0, 12)}` : "",
    clientName ? `需求方: ${clientName}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  // 覆盖更宽广的旋转坐标系
  const diagonal = Math.sqrt(width * width + height * height);
  const startX = -diagonal;
  const endX = diagonal * 1.5;
  const startY = -diagonal;
  const endY = diagonal * 1.5;

  for (let y = startY; y < endY; y += diagonalSpacing) {
    for (let x = startX; x < endX; x += diagonalSpacing * 2) {
      ctx.strokeText(primaryText, x, y);
      ctx.fillText(primaryText, x, y);

      if (subText) {
        ctx.font = `400 ${Math.round(dynamicFontSize * 0.75)}px sans-serif`;
        ctx.strokeText(subText, x, y + dynamicFontSize + 4);
        ctx.fillText(subText, x, y + dynamicFontSize + 4);
        ctx.font = `600 ${dynamicFontSize}px sans-serif`;
      }
    }
  }

  ctx.restore();

  // 2. 居中安全徽标发光水印 (Center Big Shield Badge)
  ctx.save();
  const centerX = width / 2;
  const centerY = height / 2;
  ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.28, opacity * 1.2)})`;
  ctx.strokeStyle = `rgba(0, 0, 0, 0.4)`;
  ctx.lineWidth = 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const centerBadgeSize = Math.max(20, Math.min(48, Math.round(width / 28)));
  ctx.font = `bold ${centerBadgeSize}px "PingFang SC", sans-serif`;
  ctx.strokeText("【影伴平台 商业交付审阅】", centerX, centerY - centerBadgeSize * 0.6);
  ctx.fillText("【影伴平台 商业交付审阅】", centerX, centerY - centerBadgeSize * 0.6);

  ctx.font = `500 ${Math.round(centerBadgeSize * 0.55)}px sans-serif`;
  ctx.strokeText("OFFICIAL REVIEW PREVIEW · WATERMARKED", centerX, centerY + centerBadgeSize * 0.6);
  ctx.fillText("OFFICIAL REVIEW PREVIEW · WATERMARKED", centerX, centerY + centerBadgeSize * 0.6);
  ctx.restore();

  // 3. 底部专属防伪存证哈希栏 (Bottom Security Strip)
  if (includeTimestamp || includeDigestHash) {
    ctx.save();
    const barHeight = Math.max(26, Math.round(height * 0.05));
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, height - barHeight, width, barHeight);

    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = `500 ${Math.max(10, Math.round(barHeight * 0.42))}px monospace`;
    ctx.textBaseline = "middle";

    const timestampStr = new Date().toISOString().replace("T", " ").slice(0, 19);
    const hashStr = digestHash ? digestHash.slice(0, 16) : "SECURED-PLATFORM-HASH";
    const bottomLabel = `影伴存证 SHA256: ${hashStr}... | 交付时间戳: ${timestampStr} UTC | 平台全额托管质保`;

    ctx.fillText(bottomLabel, 16, height - barHeight / 2);
    ctx.restore();
  }
}

/**
 * 为纯图片或 Canvas 导出带防盗水印的 DataURL
 */
export async function applyWatermarkToImage(
  imageSource: HTMLImageElement | string,
  options: WatermarkOptions = {}
): Promise<string> {
  if (typeof window === "undefined") {
    return typeof imageSource === "string" ? imageSource : imageSource.src;
  }

  let img: HTMLImageElement;
  if (typeof imageSource === "string") {
    img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image for watermarking"));
      img.src = imageSource;
    });
  } else {
    img = imageSource;
  }

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width || 1280;
  canvas.height = img.naturalHeight || img.height || 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) return typeof imageSource === "string" ? imageSource : img.src;

  // 绘制原图
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // 叠加动态防盗水印
  renderWatermarkOnCanvas(ctx, canvas.width, canvas.height, options);

  return canvas.toDataURL("image/jpeg", 0.92);
}

/**
 * 生成可直接用于本地硬件加速/Tauri/服务端的 FFmpeg 滤镜指令参数
 */
export function buildFFmpegWatermarkFilter(options: WatermarkOptions = {}): string {
  const text = options.primaryText || "影伴交付审阅样片 · 严禁商用";
  const safeText = text.replace(/'/g, "\\'");
  const opacity = options.opacity || 0.28;

  // 1. 居中半透明文字
  const centerFilter = `drawtext=text='${safeText}':fontsize=h/28:fontcolor=white@${opacity}:box=1:boxcolor=black@0.4:boxborderw=8:x=(w-text_w)/2:y=(h-text_h)/2`;

  // 2. 底部存证时间戳与确权栏
  const hashLabel = options.digestHash ? `存证: ${options.digestHash.slice(0, 12)}` : "影伴托管保密保护";
  const bottomFilter = `drawtext=text='${hashLabel} · %{pts\\:hms}':fontsize=h/48:fontcolor=white@0.75:x=20:y=h-th-15`;

  return `${centerFilter},${bottomFilter}`;
}

/**
 * 生成完整的 FFmpeg 压制运行命令
 */
export function buildFFmpegWatermarkCommand(
  inputFile: string,
  outputFile: string,
  options: WatermarkOptions = {}
): string {
  const filter = buildFFmpegWatermarkFilter(options);
  return `ffmpeg -y -i "${inputFile}" -vf "${filter}" -c:v libx264 -crf 22 -preset faster -c:a copy "${outputFile}"`;
}
