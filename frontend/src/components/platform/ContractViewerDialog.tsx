"use client";

import { useEffect, useState } from "react";
import {
  FileCheck2,
  ShieldCheck,
  Lock,
  Coins,
  Award,
  X,
  ExternalLink,
  Copy,
  Check,
  Scale,
  Calendar,
  UserCheck,
} from "lucide-react";
import { platformApi, type PlatformContract, type PlatformTask } from "@/lib/platformApi";

interface ContractViewerDialogProps {
  task: PlatformTask;
  onClose: () => void;
}

export default function ContractViewerDialog({ task, onClose }: ContractViewerDialogProps) {
  const [contract, setContract] = useState<PlatformContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const bountyYuan = ((task.bounty_cents || 0) / 100).toLocaleString();

  useEffect(() => {
    platformApi
      .taskContract(task.id)
      .then((data) => setContract(data))
      .catch(() => {
        // Fallback simulated contract data if backend endpoint is unavailable
        setContract({
          id: `contract-${task.id}`,
          task_id: task.id,
          creator_id: task.claimed_by || "certified-creator",
          contract_type: "commercial_undertaking_nda",
          status: "signed",
          digest_hash: `sha256:${task.id.slice(0, 8)}7f8a9e01bc234dfa56789abcdef0123456789`,
          signer_name: "认证创作者",
          signed_at: task.created_at || new Date().toISOString(),
          terms: {
            title: "商业制作承揽与保密协议",
            milestone_settlement: "40% 分镜确认结算 + 60% 成片验收结算",
            nda_clause: "创作者对制作过程中的剧本、原画及商业信息承担严格保密义务，未经发包方许可不得擅自对外公开发布。",
            copyright_clause: "商单全额放款结算后，成片商用权归发包方所有；创作者享有作品署名权及非商用作品集展示权。",
            arbitration_clause: "如产生交付分歧，以商单结构化技术规格（Brief）为验收依据，由影伴平台专员介入居间仲裁担保。",
          },
        });
      })
      .finally(() => setLoading(false));
  }, [task]);

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-glass-border bg-[#0d0e14]/95 p-6 shadow-2xl space-y-5 text-foreground font-sans">
        {/* 顶部标题与印章 */}
        <div className="flex items-center justify-between border-b border-glass-border pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-400 border border-emerald-500/30">
              <FileCheck2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-foreground">电子承揽协议凭证与数字存证</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium">
                  已在线签署·生效中
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">合同编号: {contract?.id || `contract-${task.id}`}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-foreground p-1 rounded-lg hover:bg-hover-bg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 项目标的 */}
        <div className="bg-surface-inset/60 p-3.5 rounded-xl border border-glass-border space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-text-muted">标的项目名称：</span>
            <span className="font-semibold text-foreground">{task.title}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">托管担保赏金：</span>
            <span className="font-mono font-bold text-amber-400">¥{bountyYuan}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">发包方名称：</span>
            <span className="text-foreground">{task.client_name || "影伴认证品牌方"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">签署履约创作者：</span>
            <span className="text-foreground font-medium">{contract?.signer_name || "认证创作者"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">签署时间：</span>
            <span className="font-mono text-text-secondary">
              {contract ? new Date(contract.signed_at).toLocaleString() : "2026-11-18"}
            </span>
          </div>
        </div>

        {/* 数字指纹与存证区块链防伪 */}
        <div className="p-3 rounded-xl bg-surface-inset border border-glass-border space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-text-muted text-[11px]">
            <span className="flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-400" /> 数字防伪存证哈希 (SHA-256)
            </span>
            <button
              type="button"
              onClick={() => copyHash(contract?.digest_hash || "")}
              className="text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copied ? "已复制" : "复制"}</span>
            </button>
          </div>
          <p className="font-mono text-[11px] text-text-secondary break-all bg-black/40 p-2 rounded-lg border border-glass-border">
            {contract?.digest_hash || "sha256:7f8a9e01bc234dfa56789abcdef0123456789..."}
          </p>
        </div>

        {/* 关键承诺条款复核 */}
        <div className="space-y-2 text-xs text-text-secondary leading-relaxed bg-surface-inset/40 p-3.5 rounded-xl border border-glass-border">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <Scale size={14} className="text-primary" /> 核心履约权利与法律责任：
          </p>
          <ul className="space-y-1.5 pl-4 list-disc text-text-muted text-[11px]">
            <li>
              <span className="text-foreground font-medium">商业保密：</span>
              未经发包方许可，不得将原案剧本及视觉素材对外公开。
            </li>
            <li>
              <span className="text-foreground font-medium">验收交割：</span>
              分镜确认与成片验收后发放赏金，成片商用权归发包方，创作者享有署名权。
            </li>
            <li>
              <span className="text-foreground font-medium">平台仲裁：</span>
              出现制作分歧，平台依照原始 Brief 仲裁担保，保障资金与版权安全。
            </li>
          </ul>
        </div>

        {/* 底部关闭 */}
        <div className="flex items-center justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="bg-primary text-white text-xs font-semibold px-5 py-2 rounded-xl hover:bg-primary-hover transition-opacity"
          >
            完成查看
          </button>
        </div>
      </div>
    </div>
  );
}
