"use client";

import { useState } from "react";
import {
  FileCheck2,
  ShieldCheck,
  Lock,
  Coins,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  X,
  Scale,
  Award,
} from "lucide-react";
import { type PlatformTask } from "@/lib/platformApi";

interface ContractSignDialogProps {
  task: PlatformTask;
  signerName: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  isSigning: boolean;
}

export default function ContractSignDialog({
  task,
  signerName,
  onConfirm,
  onClose,
  isSigning,
}: ContractSignDialogProps) {
  const [showFullTerms, setShowFullTerms] = useState(false);
  const bountyYuan = ((task.bounty_cents || 0) / 100).toLocaleString();
  const currentDate = new Date().toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl border border-glass-border bg-[#0d0e14]/95 p-6 shadow-2xl space-y-5 text-foreground font-sans max-h-[90vh] overflow-y-auto scrollbar-thin">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between border-b border-glass-border pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/15 p-2.5 text-primary border border-primary/25">
              <FileCheck2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-foreground">商业项目制作承揽与保密协议 (NDA)</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium flex items-center gap-1">
                  <ShieldCheck size={11} /> 线上电子签
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                依据《民法典》电子合同相关法规，点击“确认签署并接单”即具备同等法律效力
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSigning}
            className="text-text-muted hover:text-foreground p-1 rounded-lg hover:bg-hover-bg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 关联标的卡片 */}
        <div className="bg-surface-inset/70 p-4 rounded-xl border border-glass-border flex items-center justify-between gap-4">
          <div>
            <span className="text-[11px] text-text-muted">标的项目</span>
            <h4 className="text-sm font-semibold text-foreground mt-0.5">{task.title}</h4>
            <p className="text-xs text-text-secondary mt-0.5">
              发包需求方：{task.client_name || "影伴认证品牌方"} · 交付截止：{task.deadline}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[11px] text-text-muted">托管担保赏金</span>
            <p className="text-xl font-bold text-amber-400 font-mono">¥{bountyYuan}</p>
          </div>
        </div>

        {/* 核心权益 3 条胶囊 (极简呈现，一目了然) */}
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
            <Sparkles size={14} className="text-primary" />
            协议核心要点与权益保障 (TL;DR)：
          </p>
          <div className="grid grid-cols-1 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-surface-inset/50 border border-glass-border flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                <Coins size={16} />
              </div>
              <div>
                <p className="font-semibold text-foreground">赏金全额托管与阶段结算</p>
                <p className="text-text-muted mt-0.5 leading-relaxed">
                  发包方已将全额赏金（¥{bountyYuan}）锁定托管至影伴平台。制作采用分阶段验收，验收合格后赏金秒级释放至创作者钱包，严禁私下跳单。
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-inset/50 border border-glass-border flex items-start gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 shrink-0 mt-0.5">
                <Lock size={16} />
              </div>
              <div>
                <p className="font-semibold text-foreground">商业保密与素材资产防泄密 (NDA)</p>
                <p className="text-text-muted mt-0.5 leading-relaxed">
                  创作者对制作过程中的剧本、原画、概念图及客户未公开商业机密负有绝对保密责任，未经许可严禁提前公开散播或转售。
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-inset/50 border border-glass-border flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                <Award size={16} />
              </div>
              <div>
                <p className="font-semibold text-foreground">商用版权移交与创作者永久署名权</p>
                <p className="text-text-muted mt-0.5 leading-relaxed">
                  终审放款后，成片商用权利归发包方所有；创作者永久享有作品主创署名权，并可作为个人非商业艺术作品集公开展览。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 电子签署主体与存证说明 */}
        <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between text-xs text-text-secondary">
          <div className="space-y-0.5">
            <p>
              签署方：<span className="font-semibold text-foreground">{signerName}</span>（影伴认证创作者）
            </p>
            <p className="text-[11px] text-text-muted">
              签署时间：{currentDate} · 平台存证防伪链已挂载
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-primary text-xs font-medium">
            <CheckCircle2 size={16} />
            <span>身份已核验</span>
          </div>
        </div>

        {/* 折叠完整条款 (满足法务完整性，不干扰极简主视线) */}
        <div className="border-t border-glass-border pt-3">
          <button
            type="button"
            onClick={() => setShowFullTerms(!showFullTerms)}
            className="text-xs text-text-muted hover:text-foreground flex items-center gap-1 transition-colors"
          >
            {showFullTerms ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{showFullTerms ? "收起协议法务正文" : "查看完整法务协议正文（包含争议仲裁与履约条款）"}</span>
          </button>
          {showFullTerms && (
            <div className="mt-3 p-4 rounded-xl bg-surface-inset border border-glass-border text-xs text-text-muted leading-relaxed space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
              <p className="font-semibold text-foreground">一、合同订立与生效</p>
              <p>
                本协议由项目发包方（甲方）与承揽创作者（乙方）通过影伴平台以电子数据电文形式订立。乙方点击“确认签署并接单”即视为双方法定代表人或授权代理人签署本协议并即刻生效。
              </p>
              <p className="font-semibold text-foreground">二、交付与验收标准</p>
              <p>
                乙方应严格依照任务广场公布之商业需求简报（Brief）、技术规格（画幅、分辨率、交付节点）履约。样片交付阶段必须保留影伴动态防盗水印。
              </p>
              <p className="font-semibold text-foreground">三、保密义务与知识产权</p>
              <p>
                未经甲方书面许可，乙方不得将甲方提供的剧本、企划案、参考视频泄露给任何第三方。全部款项结算后，终稿商用版权归甲方，未采纳之弃用草案版权仍归乙方。
              </p>
              <p className="font-semibold text-foreground">四、争议解决与平台仲裁</p>
              <p>
                若双方在制作流程或验收过程中产生分歧，双方一致同意授权影伴平台法务仲裁团队依据原始项目记录与交付物进行居间裁决，裁决结果具有最终约束力。
              </p>
            </div>
          )}
        </div>

        {/* 底部按钮栏 */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSigning}
            className="glass-button px-4 py-2 text-xs"
          >
            暂不签署
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isSigning}
            className="bg-primary text-foreground font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 text-xs shadow-md cursor-pointer disabled:opacity-50"
          >
            {isSigning ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                正在签署电子协议...
              </>
            ) : (
              <>
                <FileCheck2 size={15} />
                确认签署并立即接单
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
