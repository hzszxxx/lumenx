"use client";

import { useEffect, useState } from "react";
import { platformApi, type XiangongyunStatus } from "@/lib/platformApi";

type Slot = { id: number; label: string; status: string; generation: string; queue: string };

const initialSlots: Slot[] = [1, 2, 3, 4, 5].map((id) => ({
  id,
  label: id === 1 ? "槽位 1 · H3 真人电" : `槽位 ${id}`,
  status: id === 1 ? "未绑定" : "按需待命",
  generation: "无运行任务",
  queue: "无排队任务",
}));

export default function XiangongyunSettings() {
  const [token, setToken] = useState("");
  const [slots, setSlots] = useState(initialSlots);
  const [releaseMinutes, setReleaseMinutes] = useState("5 分钟");
  const [concurrency, setConcurrency] = useState("5 个实例");
  const [message, setMessage] = useState("尚未绑定仙宫云账户");
  const [account, setAccount] = useState<{ nickname?: string; phone?: string; uuid?: string } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const applyBinding = (result: XiangongyunStatus | null) => {
    if (!result) {
      setAccount(null); setBalance(null); setVerifiedAt(null); setSlots(initialSlots); return;
    }
    setAccount(result.account); setBalance(result.balance); setVerifiedAt(result.checked_at);
    setSlots((items) => items.map((item, index) => index === 0 ? { ...item, label: `槽位 1 · ${result.account.nickname || "H3 实例"}`, status: "已验证" } : item));
  };

  useEffect(() => {
    let active = true;
    void platformApi.xiangongyunStatus().then(result => {
      if (!active) return;
      applyBinding(result);
      if (result) setMessage("已加载最近一次仙宫云验证结果");
    }).catch(() => {
      if (active) setMessage("无法读取仙宫云绑定状态");
    });
    return () => { active = false; };
  }, []);

  const bind = async () => {
    if (!token.trim()) return setMessage("请输入 Access Token 后再绑定");
    setChecking(true); setMessage("正在验证仙宫云账户…");
    try {
      const result = await platformApi.verifyXiangongyun(token.trim());
      applyBinding(result);
      setMessage("仙宫云账户验证成功，绑定已保存"); setToken("");
    } catch (error) {
      applyBinding(null);
      setMessage(error instanceof Error ? error.message : "仙宫云验证失败");
    } finally { setChecking(false); }
  };

  const refreshBinding = async () => {
    setChecking(true);
    try {
      const result = await platformApi.xiangongyunStatus();
      applyBinding(result);
      setMessage(result ? "已刷新最近一次仙宫云验证结果" : "尚未绑定仙宫云账户");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法刷新仙宫云绑定状态");
    } finally { setChecking(false); }
  };

  const clearBinding = async () => {
    setChecking(true);
    try {
      await platformApi.clearXiangongyunBinding();
      applyBinding(null);
      setToken("");
      setMessage("仙宫云绑定已清除");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "清除仙宫云绑定失败");
    } finally { setChecking(false); }
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel overflow-hidden">
        <div className="border-b border-glass-border p-6 flex items-start justify-between gap-4">
          <div><p className="font-mono text-[11px] tracking-[0.22em] text-primary uppercase">05 / Xiangongyun H3</p><h2 className="text-2xl font-display text-foreground mt-2">仙宫云 H3</h2></div>
          <span className="rounded border border-primary/30 px-3 py-2 text-xs text-primary">用户自有账号计费</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 border-b border-glass-border">
          {[['绑定账号', account?.nickname || (token ? '待验证' : '未绑定')], ['仙宫云余额', balance == null ? '待验证' : `¥${balance.toFixed(2)}`], ['H3 队列', account ? '已验证，待同步' : '待验证'], ['GPU 已启用 / 弹性需要', account ? '接口已验证 / 待同步' : '待验证'], ['磁盘实例 / 开发上限', account ? `${slots.length}/5 台` : '待验证'], ['已就绪生成槽位', account ? '已验证' : '0 桶'], ['缺口重试', account ? '待同步' : '无'], ['最后验证', verifiedAt ? new Date(verifiedAt).toLocaleString() : '未验证']].map(([label, value]) => <div key={label} className="p-4 border-r border-b border-glass-border last:border-r-0"><p className="text-xs text-text-muted">{label}</p><p className="text-sm font-semibold text-foreground mt-2">{value}</p></div>)}
        </div>
        <div className="p-6 border-b border-glass-border">
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">Account</p><h3 className="text-lg font-display text-foreground mt-2">账号绑定</h3>
          <label className="block text-sm text-text-secondary mt-5" htmlFor="xiangongyun-token">仙宫云 Access Token</label>
          <div className="flex gap-2 mt-2"><input id="xiangongyun-token" className="glass-input flex-1" type="password" placeholder="输入 Access Token 后验证账户" value={token} onChange={(event) => setToken(event.target.value)} /><button type="button" className="glass-button" onClick={() => void bind()} disabled={checking}>{checking ? "验证中…" : "验证并更新"}</button></div>
          <p className="text-xs text-text-muted mt-2">登录仙宫云网页不会自动共享给本地应用；这里通过 Access Token 查询账号、余额和实例状态。Token 不会回显。</p>
          {account && <div className="mt-4 rounded-lg border border-status-success-fg/30 bg-status-success-fg/10 p-3 text-sm"><p>账号：{account.nickname || "未提供昵称"}</p><p className="text-text-secondary mt-1">手机：{account.phone || "未提供"} · UUID：{account.uuid || "未提供"}</p></div>}
          <div className="flex flex-wrap gap-2 justify-end mt-5"><a className="glass-button" href="https://www.xiangongyun.com/console/finance/recharge" target="_blank" rel="noreferrer">官方充值与控制台</a><button type="button" className="glass-button" onClick={() => void refreshBinding()} disabled={checking}>刷新状态</button><button type="button" className="glass-button" onClick={clearBinding}>清除绑定</button></div>
          <p role="status" className="text-sm text-text-secondary mt-4">{message}</p>
        </div>
        <div className="p-6 border-b border-glass-border">
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">Running policy</p><h3 className="text-lg font-display text-foreground mt-2">运行与费用策略</h3>
          <div className="grid md:grid-cols-2 gap-4 mt-5"><label className="text-sm text-text-secondary">队列清空后自动释放 GPU<select className="glass-input w-full mt-2" value={releaseMinutes} onChange={(event) => setReleaseMinutes(event.target.value)}><option>5 分钟</option><option>10 分钟</option><option>不自动释放</option></select></label><label className="text-sm text-text-secondary">H3 并发实例上限<select className="glass-input w-full mt-2" value={concurrency} onChange={(event) => setConcurrency(event.target.value)}><option>5 个实例</option><option>3 个实例</option><option>1 个实例</option></select></label></div>
          <button type="button" className="bg-primary text-background rounded-lg px-4 py-2 mt-5 font-semibold" onClick={() => setMessage(`运行设置已保存：${releaseMinutes}，${concurrency}`)}>保存运行设置</button>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between"><div><p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">Instance pool</p><h3 className="text-lg font-display text-foreground mt-2">实例池</h3></div><span className="text-xs text-text-muted">{slots.length} 个槽位</span></div>
          <div className="overflow-x-auto mt-5"><table className="w-full text-sm"><thead><tr className="text-left text-text-muted border-b border-glass-border"><th className="p-3">实例</th><th className="p-3">GPU</th><th className="p-3">状态</th><th className="p-3">数据中心</th><th className="p-3">操作</th></tr></thead><tbody>{account && slots[0].status === "已验证" ? <tr className="border-b border-glass-border"><td className="p-3 text-foreground font-medium">{slots[0].label}</td><td className="p-3 text-text-secondary">待读取</td><td className="p-3 text-status-success-fg">账户已验证</td><td className="p-3 text-text-secondary">待读取</td><td className="p-3"><button type="button" className="glass-button text-xs" onClick={clearBinding}>清除</button></td></tr> : slots.map((slot) => <tr key={slot.id} className="border-b border-glass-border"><td className="p-3 text-foreground font-medium">{slot.label}</td><td className="p-3 text-text-secondary">待验证</td><td className="p-3 text-text-secondary">{slot.status}</td><td className="p-3 text-text-secondary">待同步</td><td className="p-3"><button type="button" className="glass-button text-xs" disabled={slot.id !== 1} onClick={() => setSlots((items) => items.map((item) => item.id === slot.id ? { ...item, status: "已释放" } : item))}>释放</button></td></tr>)}</tbody></table></div>
          <button type="button" className="border border-status-failed-fg/60 text-status-failed-fg rounded-lg px-4 py-2 mt-5" onClick={() => setMessage("批量释放将在真实实例 API 接入后执行")}>释放全部本地实例</button>
        </div>
      </div>
    </div>
  );
}
