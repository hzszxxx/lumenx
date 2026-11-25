"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Server, Power, Loader2, CheckCircle2, AlertTriangle, Play, RefreshCw, XCircle } from "lucide-react";
import {
    api,
    type XiangongyunServerStatusResponse,
    type XiangongyunBatchStatus,
    type XiangongyunInstance,
} from "@/lib/api";
import { toast } from "@/store/toastStore";

interface XiangongyunBatchBarProps {
    projectId: string;
    selectedShotIds: string[];
    onSelectAllShots: (maxLimit?: number) => void;
    onClearSelection: () => void;
    totalShotsCount: number;
    shots: Array<{
        id: string;
        prompt: string;
        imageUrl?: string;
        image_url?: string;
        [k: string]: any;
    }>;
    currentModel: string;
    duration?: number;
    resolution?: string;
    resolveReferenceUrls?: (shot: any) => string[];
    onBatchSubmitted?: (taskIds: string[]) => void;
    onRefreshProject?: () => void;
}

export default function XiangongyunBatchBar({
    projectId,
    selectedShotIds,
    onSelectAllShots,
    onClearSelection,
    totalShotsCount,
    shots,
    currentModel,
    duration = 5,
    resolution = "768p",
    resolveReferenceUrls,
    onBatchSubmitted,
    onRefreshProject,
}: XiangongyunBatchBarProps) {
    const [serverStatus, setServerStatus] = useState<XiangongyunServerStatusResponse | null>(null);
    const [loadingStatus, setLoadingStatus] = useState(false);
    const [autoShutdown, setAutoShutdown] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [activeBatch, setActiveBatch] = useState<XiangongyunBatchStatus | null>(null);
    const [shuttingDown, setShuttingDown] = useState(false);

    const refreshServerStatus = useCallback(async () => {
        if (!projectId) return;
        setLoadingStatus(true);
        try {
            const data = await api.getXiangongyunServerStatus(projectId);
            setServerStatus(data);
            if (data.active_batch) {
                setActiveBatch(data.active_batch);
            }
        } catch (err: any) {
            console.error("Failed to load Xiangongyun server status:", err);
        } finally {
            setLoadingStatus(false);
        }
    }, [projectId]);

    useEffect(() => {
        refreshServerStatus();
        const interval = setInterval(refreshServerStatus, 10000);
        return () => clearInterval(interval);
    }, [refreshServerStatus]);

    // Poll active batch progress
    useEffect(() => {
        if (!activeBatch || activeBatch.status === "completed" || activeBatch.status === "failed") {
            return;
        }

        const pollTimer = setInterval(async () => {
            try {
                const fresh = await api.getXiangongyunBatchStatus(projectId, activeBatch.batch_id);
                setActiveBatch(fresh);
                if (fresh.status === "completed") {
                    toast.success("仙宫云批次已全部生成完成！");
                    refreshServerStatus();
                    onRefreshProject?.();
                } else if (fresh.status === "failed") {
                    toast.error(`仙宫云批次执行失败: ${fresh.error || "未知异常"}`);
                    refreshServerStatus();
                    onRefreshProject?.();
                }
            } catch (err) {
                console.error("Error polling batch status:", err);
            }
        }, 3000);

        return () => clearInterval(pollTimer);
    }, [activeBatch, projectId, refreshServerStatus, onRefreshProject]);

    const handleBatchGenerate = async () => {
        if (selectedShotIds.length === 0) {
            toast.warning("请先勾选需要生成的镜头（最多 10 个）");
            return;
        }
        if (selectedShotIds.length > 10) {
            toast.warning("仙宫云单批次最多支持 10 个分镜，请减少勾选数量");
            return;
        }
        if (!serverStatus?.verified) {
            toast.warning("未检测到仙宫云凭证，请先在平台凭证中绑定仙宫云账号");
            return;
        }
        if ((serverStatus.balance ?? 0) <= 0) {
            toast.warning(`仙宫云余额不足 (当前: ¥${serverStatus.balance?.toFixed(2) ?? '0.00'})，请先在仙宫云充值`);
            return;
        }

        const selectedShots = shots.filter(s => selectedShotIds.includes(s.id));
        const items = selectedShots.map(s => {
            const genMode = (currentModel.endsWith("-r2v") ? "r2v" : "i2v") as "r2v" | "i2v";
            const refs = genMode === "r2v" && resolveReferenceUrls ? resolveReferenceUrls(s) : (s.reference_image_urls || []);
            return {
                frame_id: s.id,
                prompt: s.prompt,
                image_url: s.imageUrl || s.image_url || "",
                duration,
                resolution,
                generation_mode: genMode,
                ...(refs.length > 0 ? { reference_image_urls: refs } : {}),
            };
        });

        setSubmitting(true);
        try {
            const resp = await api.batchGenerateXiangongyun(projectId, {
                items,
                auto_shutdown: autoShutdown,
                model: currentModel,
            });
            toast.success(`已提交仙宫云批次，包含 ${resp.total_count} 个分镜视频`);
            setActiveBatch({
                batch_id: resp.batch_id,
                project_id: projectId,
                instance_id: resp.instance_id,
                frame_ids: selectedShotIds,
                task_ids: resp.task_ids,
                auto_shutdown: autoShutdown,
                status: "booting",
                current_step: "正在准备开机...",
                completed_count: 0,
                total_count: resp.total_count,
            });
            onBatchSubmitted?.(resp.task_ids);
            onClearSelection();
            onRefreshProject?.();
        } catch (err: any) {
            const msg = err.response?.data?.detail || err.message || "提交仙宫云批次失败";
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleShutdownServer = async () => {
        if (!confirm("确定要关闭当前仙宫云实例并释放 GPU 算力吗？关机后将停止计费。")) {
            return;
        }
        setShuttingDown(true);
        try {
            const res = await api.shutdownXiangongyunServer(projectId);
            toast.success(res.message || "关机指令已成功发送给仙宫云");
            refreshServerStatus();
        } catch (err: any) {
            toast.error(err.response?.data?.detail || err.message || "关机请求失败");
        } finally {
            setShuttingDown(false);
        }
    };

    const runningInstance = serverStatus?.instances?.find(
        i => i.status?.toLowerCase() === "running"
    );
    const stoppedInstance = serverStatus?.instances?.[0];
    const isBatchActive = Boolean(activeBatch && (activeBatch.status === "booting" || activeBatch.status === "running"));

    return (
        <div className="w-full bg-slate-900/90 border border-emerald-500/30 rounded-xl p-3 mb-4 backdrop-blur-md shadow-lg transition-all">
            {/* Header / Server Status Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-700/50">
                <div className="flex items-center gap-2 text-sm">
                    <Server className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-slate-100">仙宫云算力调度台</span>
                    {serverStatus?.verified ? (
                        <>
                            <span className="text-slate-400 text-xs">|</span>
                            {runningInstance ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    运行中: {runningInstance.name || runningInstance.gpu_model || "RTX 4090"}
                                </span>
                            ) : stoppedInstance ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600">
                                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                                    已关机保留 (生成时自动起机)
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    <AlertTriangle className="w-3 h-3" />
                                    未检测到实例 (请在控制台部署)
                                </span>
                            )}
                            <span className="text-xs text-slate-400">
                                余额: <strong className="text-emerald-400">¥{(serverStatus.balance ?? 0).toFixed(2)}</strong>
                            </span>
                        </>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            仙宫云未绑定，请先配置 Access Token
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {runningInstance && (
                        <button
                            type="button"
                            onClick={handleShutdownServer}
                            disabled={shuttingDown || isBatchActive}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 rounded-lg transition-colors disabled:opacity-50"
                            title="关机并释放 GPU，停止计费"
                        >
                            {shuttingDown ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
                            关机释放GPU
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={refreshServerStatus}
                        disabled={loadingStatus}
                        className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                        title="刷新服务器状态"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Active Batch Progress Card (if running) */}
            {isBatchActive && (
                <div className="my-2 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between text-xs text-emerald-200 animate-pulse">
                    <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                        <span><strong>批次执行中:</strong> {activeBatch?.current_step}</span>
                    </div>
                    <div className="font-mono font-medium">
                        进度: {activeBatch?.completed_count ?? 0} / {activeBatch?.total_count ?? 0}
                    </div>
                </div>
            )}

            {/* Selection & Batch Action Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
                <div className="flex items-center gap-2">
                    <span className="text-slate-300">
                        已选分镜: <strong className={selectedShotIds.length > 10 ? "text-rose-400" : "text-emerald-400"}>
                            {selectedShotIds.length}
                        </strong> / 10
                    </span>
                    <button
                        type="button"
                        onClick={() => onSelectAllShots(10)}
                        className="px-2 py-1 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                    >
                        选择待生成 (前10镜)
                    </button>
                    {selectedShotIds.length > 0 && (
                        <button
                            type="button"
                            onClick={onClearSelection}
                            className="px-2 py-1 text-slate-400 hover:text-slate-200 transition-colors"
                        >
                            清空
                        </button>
                    )}
                    {selectedShotIds.length > 10 && (
                        <span className="text-rose-400 font-medium">
                            (单批次限最多10个)
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 select-none">
                        <input
                            type="checkbox"
                            checked={autoShutdown}
                            onChange={(e) => setAutoShutdown(e.target.checked)}
                            className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-400/50 bg-slate-800"
                        />
                        <span>生成后自动关机释放算力 (防扣费)</span>
                    </label>

                    <button
                        type="button"
                        onClick={handleBatchGenerate}
                        disabled={submitting || isBatchActive || selectedShotIds.length === 0 || selectedShotIds.length > 10}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-medium text-slate-900 bg-emerald-400 hover:bg-emerald-300 disabled:bg-slate-700 disabled:text-slate-500 transition-all shadow-md"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                正在调度起机...
                            </>
                        ) : (
                            <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                启动服务器并批量生成 ({selectedShotIds.length}/10)
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
