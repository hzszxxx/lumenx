"use client";

import React, { useState, useId } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Layers
} from "lucide-react";

export interface ParsedStoryboardShot {
  shotId: string;
  title: string;
  prompt: string;
  clayUrl?: string;
  durationSec?: number;
  shotType?: string;
  choices?: string[];
}

export interface StoryboardBatchImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportShots: (shots: ParsedStoryboardShot[]) => Promise<void> | void;
}

const DEFAULT_SAMPLE_CSV = `shot_id,title,prompt,clay_url,duration_sec,shot_type
SHOT-01,神殿走廊远景,全景镜头：破败石柱与高耸穹顶，主角披风随风飘动，晨曦穿透雾气照亮地面石砖,https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800,6,establishing
SHOT-02,主角拔剑特写,中特写镜头：主角右手缓缓握紧腰间符文长剑，剑鞘泛起幽蓝微光，眼神坚毅,https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800,4,closeup
SHOT-03,傀儡战将苏醒,仰拍镜头：守护石像轰然震颤，碎石剥落，双目亮起炽红火光，压迫感十足,,5,action_hard
SHOT-04,遭遇抉择瞬间,定格中景：两道门扉开启，左侧通向深渊回廊，右侧通向钟楼秘道,,4,choice_branch`;

export default function StoryboardBatchImportModal({
  open,
  onClose,
  onImportShots,
}: StoryboardBatchImportModalProps) {
  const [csvContent, setCsvContent] = useState<string>(DEFAULT_SAMPLE_CSV);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputId = useId();

  // Parse CSV content into structured shots
  const parseRows = (text: string): ParsedStoryboardShot[] => {
    const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1) return [];

    // Header inspection
    const headerLine = lines[0].toLowerCase();
    const isComma = headerLine.includes(",");
    const delimiter = isComma ? "," : "\t";
    const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ""));

    const shotIdIdx = headers.findIndex(h => h.includes("shot_id") || h.includes("id") || h.includes("镜头"));
    const titleIdx = headers.findIndex(h => h.includes("title") || h.includes("name") || h.includes("名称"));
    const promptIdx = headers.findIndex(h => h.includes("prompt") || h.includes("notes") || h.includes("描述") || h.includes("提示词"));
    const clayIdx = headers.findIndex(h => h.includes("clay") || h.includes("previz") || h.includes("白模") || h.includes("image"));
    const durIdx = headers.findIndex(h => h.includes("duration") || h.includes("sec") || h.includes("时长"));
    const typeIdx = headers.findIndex(h => h.includes("type") || h.includes("景别"));

    const result: ParsedStoryboardShot[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // Handle quoted commas
      const rawCols: string[] = [];
      let inQuote = false;
      let curr = "";
      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"') {
          inQuote = !inQuote;
        } else if (char === delimiter && !inQuote) {
          rawCols.push(curr.trim());
          curr = "";
        } else {
          curr += char;
        }
      }
      rawCols.push(curr.trim());

      const cols = rawCols.map(c => c.replace(/^["']|["']$/g, ""));
      const shotId = (shotIdIdx >= 0 ? cols[shotIdIdx] : null) || `SHOT-${String(i).padStart(2, "0")}`;
      const title = (titleIdx >= 0 ? cols[titleIdx] : null) || `分镜 ${i}`;
      const prompt = (promptIdx >= 0 ? cols[promptIdx] : null) || cols[2] || "";
      const clayUrl = clayIdx >= 0 ? cols[clayIdx] : undefined;
      const durationSec = durIdx >= 0 ? parseFloat(cols[durIdx]) || 5 : 5;
      const shotType = typeIdx >= 0 ? cols[typeIdx] : "normal";

      result.push({
        shotId,
        title,
        prompt,
        clayUrl: clayUrl && clayUrl.startsWith("http") ? clayUrl : undefined,
        durationSec,
        shotType,
      });
    }

    return result;
  };

  const parsedShots = parseRows(csvContent);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCsvContent(content);
        setErrorMsg(null);
      }
    };
    reader.onerror = () => {
      setErrorMsg("读取文件失败，请检查文件格式是否有效。");
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([DEFAULT_SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "atelier_previz_storyboard_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    if (parsedShots.length === 0) {
      setErrorMsg("未解析到有效分镜镜头行，请检查表格内容。");
      return;
    }
    setIsImporting(true);
    setErrorMsg(null);
    try {
      await onImportShots(parsedShots);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "批量导入分镜失败，请重试。");
    } finally {
      setIsImporting(false);
    }
  };

  if (!open || typeof document === "undefined") return null;

  const content = (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm transition-opacity"
      />

      {/* Main Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="白模分镜表批量导入"
        className="fixed inset-4 z-[71] md:inset-10 lg:inset-20 flex flex-col rounded-2xl border border-white/10 bg-[#0d0f14] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-6 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <FileSpreadsheet size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                白模分镜表批量导入 (Batch Previz Shotlist)
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  CSV / Excel 一键排版
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/70 hover:text-white hover:bg-white/5 text-xs transition-colors"
            >
              <Download size={13} />
              <span>下载标准 CSV 模板</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Content Body: Split Left Editor & Right Preview */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/10 overflow-hidden">
          {/* Left Column: Input / CSV Upload */}
          <div className="flex flex-col p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="csv-input-area" className="text-xs font-medium text-white/70 flex items-center gap-1.5">
                <Layers size={13} className="text-purple-400" />
                <span>分镜表格数据 (支持直接粘贴 CSV 或 Excel 表格列)</span>
              </label>

              <label
                htmlFor={fileInputId}
                className="cursor-pointer flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                <Upload size={12} />
                <span>上传 .csv 文件</span>
                <input
                  id={fileInputId}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>

            <textarea
              id="csv-input-area"
              value={csvContent}
              onChange={(e) => {
                setCsvContent(e.target.value);
                setErrorMsg(null);
              }}
              placeholder="在这里粘贴 CSV 文本..."
              className="flex-1 w-full rounded-xl border border-white/10 bg-black/40 p-3.5 font-mono text-xs text-white/80 placeholder-white/30 focus:border-purple-500/50 focus:outline-none resize-none leading-relaxed"
            />

            <div className="mt-3 text-[11px] text-white/45 flex items-center gap-1.5">
              <span>💡 支持字段：`shot_id`、`title`、`prompt`、`clay_url`、`duration_sec`、`shot_type`</span>
            </div>
          </div>

          {/* Right Column: Parsed Shot List Preview */}
          <div className="flex flex-col p-5 overflow-hidden bg-black/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-white/70 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-400" />
                <span>已解析镜头预览 ({parsedShots.length} 个镜头)</span>
              </span>
              <span className="text-[11px] font-mono text-white/40">导入后自动横向排布并连结参考</span>
            </div>

            {/* Table Preview */}
            <div className="flex-1 overflow-y-auto rounded-xl border border-white/10 bg-black/40">
              {parsedShots.length > 0 ? (
                <div className="divide-y divide-white/5">
                  {parsedShots.map((shot, idx) => (
                    <div key={shot.shotId + idx} className="p-3 hover:bg-white/[0.02] transition-colors flex items-start gap-3">
                      <div className="h-6 px-2 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-[11px] font-semibold flex items-center justify-center shrink-0">
                        {shot.shotId}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-white truncate">{shot.title}</span>
                          <span className="text-[10px] font-mono text-white/40 shrink-0">{shot.durationSec}s · {shot.shotType}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-white/50 line-clamp-2 leading-relaxed">
                          {shot.prompt || "(无描述提示词)"}
                        </p>
                        {shot.clayUrl ? (
                          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-400/90 font-mono">
                            <span>✓ 已附带 3D 白模底模资产</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-white/40 text-xs">
                  <AlertCircle size={24} className="mb-2 text-white/20" />
                  <span>暂无有效分镜数据，请在左侧粘贴或上传 CSV</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <footer className="flex h-16 shrink-0 items-center justify-between border-t border-white/10 px-6 bg-white/[0.02]">
          {errorMsg ? (
            <div className="flex items-center gap-1.5 text-xs text-rose-400">
              <AlertCircle size={14} />
              <span>{errorMsg}</span>
            </div>
          ) : (
            <div className="text-xs text-white/40">
              共将创建 <span className="text-purple-300 font-semibold">{parsedShots.length}</span> 个分镜节点并自动生成连线骨架
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="px-4 py-2 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 text-xs font-medium transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isImporting || parsedShots.length === 0}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold transition-all shadow-md shadow-purple-600/30 cursor-pointer"
            >
              <PlusCircle size={14} />
              <span>{isImporting ? "正在导入排版..." : `一键批量生成 ${parsedShots.length} 个分镜节点`}</span>
            </button>
          </div>
        </footer>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
