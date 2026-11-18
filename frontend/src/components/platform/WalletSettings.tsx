"use client";

import { useEffect, useState } from "react";
import {
  Wallet,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  RefreshCw,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Cpu,
  Layers,
} from "lucide-react";
import { platformApi } from "@/lib/platformApi";
import { usePlatformStore } from "@/store/platformStore";

interface Transaction {
  entry_id: string;
  transaction_id: string;
  amount_cents: number;
  direction: string;
  reference_type: string;
  reference_id: string;
  created_at: string;
}

export default function WalletSettings() {
  const { user } = usePlatformStore();
  const [balanceCents, setBalanceCents] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 兑换算力弹窗状态
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertYuan, setConvertYuan] = useState<number>(100);
  const [converting, setConverting] = useState(false);

  // 提现弹窗状态
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawYuan, setWithdrawYuan] = useState<number>(500);
  const [payoutChannel, setPayoutChannel] = useState("alipay");
  const [accountInfo, setAccountInfo] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  const loadWalletData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [walletRes, txList] = await Promise.all([
        platformApi.wallet(),
        platformApi.transactions(),
      ]);
      setBalanceCents(walletRes.simulated_balance_cents || 0);
      setTransactions(txList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取钱包与流水失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWalletData();
  }, []);

  // 兑换算力
  const handleConvertCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (convertYuan <= 0) return;
    setConverting(true);
    setMessage(null);
    setError(null);
    try {
      const amountCents = Math.round(convertYuan * 100);
      const res = await platformApi.convertCredits(amountCents);
      setMessage(
        `兑换成功！已将 ¥${convertYuan} 商单收益兑换为 ${res.granted_credits.toLocaleString()} 点平台算力（已包含 20% 创作者激励补贴）。`
      );
      setShowConvertModal(false);
      await loadWalletData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "兑换算力失败，请检查余额是否充足");
    } finally {
      setConverting(false);
    }
  };

  // 申请提现
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (withdrawYuan <= 0 || !accountInfo.trim()) return;
    setWithdrawing(true);
    setMessage(null);
    setError(null);
    try {
      const amountCents = Math.round(withdrawYuan * 100);
      await platformApi.withdraw({
        amount_cents: amountCents,
        payout_channel: payoutChannel,
        account_info: accountInfo.trim(),
      });
      setMessage(
        `提现申请已提交！已从钱包预扣 ¥${withdrawYuan}，财务结算专员将在 1 个工作日内打款至指定收款账户。`
      );
      setShowWithdrawModal(false);
      await loadWalletData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "申请提现失败，请检查余额是否充足");
    } finally {
      setWithdrawing(false);
    }
  };

  // 计算累计收益
  const totalEarnedYuan = (
    transactions
      .filter((t) => t.direction === "credit" && t.reference_type === "task")
      .reduce((sum, t) => sum + t.amount_cents, 0) / 100
  ).toFixed(2);

  const balanceYuan = (balanceCents / 100).toFixed(2);

  return (
    <div className="space-y-6">
      {/* 收益总览卡片 */}
      <div className="glass-panel p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-amber-500/15 p-3.5 text-amber-400 border border-amber-500/30">
              <Wallet size={32} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-display font-semibold text-foreground">创作者收益中心</h2>
                <span className="text-[0.6875rem] px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium flex items-center gap-1">
                  <ShieldCheck size={12} /> 平台担保结算
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-1.5 leading-relaxed max-w-2xl">
                所有通过商业任务广场承接并经验收合格的商单赏金，均自动进入平台收益账户。支持自主申请收益提现或直接兑换平台算力（享 20% 补贴）。
              </p>
            </div>
          </div>

          {/* 核心余额指标 */}
          <div className="flex items-center gap-6 bg-surface-inset/60 px-5 py-3.5 rounded-xl border border-glass-border">
            <div>
              <p className="text-[0.6875rem] text-text-muted">可提现商业收益</p>
              <p className="text-2xl font-bold text-amber-400 font-mono mt-0.5">¥{balanceYuan}</p>
            </div>
            <div className="w-px h-10 bg-glass-border" />
            <div>
              <p className="text-[0.6875rem] text-text-muted">商单累计总放款</p>
              <p className="text-base font-semibold text-foreground font-mono mt-0.5">¥{totalEarnedYuan}</p>
            </div>
          </div>
        </div>

        {/* 快捷操作区 */}
        <div className="mt-6 pt-5 border-t border-glass-border flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowConvertModal(true)}
              className="bg-primary text-foreground text-xs font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Cpu size={14} /> 收益兑换算力 (+20%补贴)
            </button>
            <button
              type="button"
              onClick={() => setShowWithdrawModal(true)}
              className="glass-button text-xs font-medium py-2 px-4 flex items-center gap-1.5"
            >
              <Coins size={14} className="text-amber-400" /> 申请收益提现
            </button>
          </div>
          <button
            type="button"
            onClick={() => void loadWalletData()}
            className="text-xs text-text-muted hover:text-foreground flex items-center gap-1"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> 刷新流水
          </button>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-200 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 收益流水明细 */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-glass-border pb-3">
          <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Clock size={16} className="text-primary" />
            结算与交易明细
          </h3>
          <span className="text-xs text-text-muted">共 {transactions.length} 条记录</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-text-muted flex flex-col items-center justify-center gap-2">
            <Loader2 size={20} className="animate-spin text-primary" />
            <span className="text-xs">加载收益明细中…</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center text-text-muted text-xs">
            暂无结算流水。前往【商业任务】大厅承接任务并完成交付，发包方终审放款后将在此入账。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-glass-border text-text-muted font-medium">
                  <th className="py-2.5 px-3">流水号</th>
                  <th className="py-2.5 px-3">业务类型</th>
                  <th className="py-2.5 px-3">收支方向</th>
                  <th className="py-2.5 px-3">金额 (元)</th>
                  <th className="py-2.5 px-3">结算关联说明</th>
                  <th className="py-2.5 px-3">发生时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border/40 font-mono">
                {transactions.map((tx) => {
                  const isCredit = tx.direction === "credit";
                  const yuan = (tx.amount_cents / 100).toFixed(2);
                  const typeLabel =
                    tx.reference_type === "task"
                      ? "商单终审放款"
                      : tx.reference_type === "convert_credits"
                      ? "兑换算力抵扣"
                      : tx.reference_type === "withdrawal"
                      ? "收益申请提现"
                      : tx.reference_type;

                  return (
                    <tr key={tx.entry_id} className="hover:bg-hover-bg transition-colors">
                      <td className="py-3 px-3 text-text-secondary">{tx.transaction_id.slice(0, 12)}…</td>
                      <td className="py-3 px-3">
                        <span className="font-sans px-2 py-0.5 rounded bg-surface-inset border border-glass-border text-text-secondary text-[11px]">
                          {typeLabel}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 font-sans ${isCredit ? "text-emerald-400" : "text-amber-400"}`}>
                          {isCredit ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                          {isCredit ? "入账" : "支出"}
                        </span>
                      </td>
                      <td className={`py-3 px-3 font-bold ${isCredit ? "text-emerald-400" : "text-foreground"}`}>
                        {isCredit ? `+¥${yuan}` : `-¥${yuan}`}
                      </td>
                      <td className="py-3 px-3 font-sans text-text-secondary max-w-xs truncate">
                        {tx.reference_id}
                      </td>
                      <td className="py-3 px-3 text-text-muted text-[11px]">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 兑换算力弹窗 */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-glass-border bg-[#0d0e14]/95 p-6 shadow-2xl space-y-4 text-foreground font-sans">
            <div className="flex items-center justify-between border-b border-glass-border pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Cpu size={18} className="text-primary" />
                收益兑换平台算力
              </h3>
              <button
                type="button"
                onClick={() => setShowConvertModal(false)}
                className="text-text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-text-secondary">
              商单收益可直接兑换为全平台通用的 GPU 渲染与模型生成算力。
              平台特别为创作者提供 <span className="text-primary font-bold">+20% 充值补贴</span>，1元 = 120算力点！
            </p>
            <form onSubmit={handleConvertCredits} className="space-y-4 text-xs">
              <div>
                <label className="text-text-muted block mb-1">兑换金额 (元，当前可用余额 ¥{balanceYuan})</label>
                <input
                  type="number"
                  min={1}
                  max={Math.floor(balanceCents / 100)}
                  className="glass-input w-full font-mono text-base font-bold text-amber-400"
                  value={convertYuan}
                  onChange={(e) => setConvertYuan(Number(e.target.value))}
                  required
                />
              </div>
              <div className="bg-surface-inset p-3 rounded-xl border border-glass-border text-xs space-y-1">
                <div className="flex items-center justify-between text-text-muted">
                  <span>基础算力点数：</span>
                  <span className="font-mono">{convertYuan * 100} 点</span>
                </div>
                <div className="flex items-center justify-between text-primary font-semibold">
                  <span>创作者补贴加成 (+20%)：</span>
                  <span className="font-mono">+{convertYuan * 20} 点</span>
                </div>
                <div className="border-t border-glass-border pt-1 flex items-center justify-between font-bold text-foreground">
                  <span>预计实际到账算力：</span>
                  <span className="font-mono text-emerald-400 text-sm">{convertYuan * 120} 点</span>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConvertModal(false)}
                  className="glass-button px-4 py-2"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={converting || convertYuan <= 0 || convertYuan > balanceCents / 100}
                  className="bg-primary text-foreground font-semibold px-5 py-2 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {converting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  确认兑换到账
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 收益提现申请弹窗 */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-glass-border bg-[#0d0e14]/95 p-6 shadow-2xl space-y-4 text-foreground font-sans">
            <div className="flex items-center justify-between border-b border-glass-border pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Coins size={18} className="text-amber-400" />
                商业任务收益提现
              </h3>
              <button
                type="button"
                onClick={() => setShowWithdrawModal(false)}
                className="text-text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleWithdraw} className="space-y-4 text-xs">
              <div>
                <label className="text-text-muted block mb-1">提现金额 (元，当前可用余额 ¥{balanceYuan})</label>
                <input
                  type="number"
                  min={1}
                  max={Math.floor(balanceCents / 100)}
                  className="glass-input w-full font-mono text-base font-bold text-amber-400"
                  value={withdrawYuan}
                  onChange={(e) => setWithdrawYuan(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label className="text-text-muted block mb-1">收款渠道</label>
                <select
                  className="glass-input w-full"
                  value={payoutChannel}
                  onChange={(e) => setPayoutChannel(e.target.value)}
                >
                  <option value="alipay">支付宝 (推荐，支持T+1快速到账)</option>
                  <option value="bank">国内银行借记卡对私打款</option>
                  <option value="wechat">微信支付商家转账</option>
                </select>
              </div>
              <div>
                <label className="text-text-muted block mb-1">收款账号与实名姓名</label>
                <input
                  className="glass-input w-full"
                  value={accountInfo}
                  onChange={(e) => setAccountInfo(e.target.value)}
                  placeholder="例如: 13800000000 (张三) 或 招商银行卡号"
                  required
                />
              </div>
              <p className="text-[11px] text-text-muted">
                提交后资金将进入银行清算队列，系统将在1个工作日内完成实名核验与原路打款。
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="glass-button px-4 py-2"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={withdrawing || withdrawYuan <= 0 || !accountInfo.trim() || withdrawYuan > balanceCents / 100}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-5 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {withdrawing ? <Loader2 size={13} className="animate-spin" /> : <Coins size={13} />}
                  确认提交申请
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
