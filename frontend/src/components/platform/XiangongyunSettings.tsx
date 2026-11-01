"use client";

import { useState } from "react";

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

  const bind = () => {
    if (!token.trim()) return setMessage("请输入 Access Token 后再绑定");
    setMessage("凭证已提交，等待真实仙宫云 API 适配层接入");
  };

  const clearBinding = () => {
    setToken("");
    setMessage("已清除本地绑定信息");
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel overflow-hidden">
        <div className="border-b border-glass-border p-6 flex items-start justify-between gap-4">
          <div><p className="font-mono text-[11px] tracking-[0.22em] text-primary uppercase">05 / Xiangongyun H3</p><h2 className="text-2xl font-display text-foreground mt-2">仙宫云 H3</h2></div>
          <span className="rounded border border-primary/30 px-3 py-2 text-xs text-primary">用户自有账号计费</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 border-b border-glass-border">
          {[['绑定账号', token ? '已填写 Token' : '未设置昵称'], ['仙宫云余额', '待同步'], ['H3 队列', '0 个任务'], ['GPU 已启用 / 弹性需要', '0/0 台'], ['磁盘实例 / 开发上限', '1/5 台'], ['已就绪生成槽位', '0 桶'], ['缺口重试', '无'], ['最大时长参考', '待同步']].map(([label, value]) => <div key={label} className="p-4 border-r border-b border-glass-border last:border-r-0"><p className="text-xs text-text-muted">{label}</p><p className="text-sm font-semibold text-foreground mt-2">{value}</p></div>)}
        </div>
        <div className="p-6 border-b border-glass-border">
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">Account</p><h3 className="text-lg font-display text-foreground mt-2">账号绑定</h3>
          <label className="block text-sm text-text-secondary mt-5" htmlFor="xiangongyun-token">仙宫云 Access Token</label>
          <div className="flex gap-2 mt-2"><input id="xiangongyun-token" className="glass-input flex-1" type="password" placeholder="仅提交到本地服务端保存" value={token} onChange={(event) => setToken(event.target.value)} /><button type="button" className="glass-button" onClick={bind}>更新令牌</button></div>
          <p className="text-xs text-text-muted mt-2">Token 不会回显到浏览器或日志；真实验证需要配置仙宫云 API 代理。</p>
          <div className="flex flex-wrap gap-2 justify-end mt-5"><a className="glass-button" href="https://www.xiangongyun.com/console/finance/recharge" target="_blank" rel="noreferrer">官方充值与控制台</a><button type="button" className="glass-button" onClick={() => setMessage("状态刷新将在 API 适配层接入后生效")}>刷新状态</button><button type="button" className="glass-button" onClick={clearBinding}>清除绑定</button></div>
          <p role="status" className="text-sm text-text-secondary mt-4">{message}</p>
        </div>
        <div className="p-6 border-b border-glass-border">
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">Running policy</p><h3 className="text-lg font-display text-foreground mt-2">运行与费用策略</h3>
          <div className="grid md:grid-cols-2 gap-4 mt-5"><label className="text-sm text-text-secondary">队列清空后自动释放 GPU<select className="glass-input w-full mt-2" value={releaseMinutes} onChange={(event) => setReleaseMinutes(event.target.value)}><option>5 分钟</option><option>10 分钟</option><option>不自动释放</option></select></label><label className="text-sm text-text-secondary">H3 并发实例上限<select className="glass-input w-full mt-2" value={concurrency} onChange={(event) => setConcurrency(event.target.value)}><option>5 个实例</option><option>3 个实例</option><option>1 个实例</option></select></label></div>
          <button type="button" className="bg-primary text-background rounded-lg px-4 py-2 mt-5 font-semibold" onClick={() => setMessage(`运行设置已保存：${releaseMinutes}，${concurrency}`)}>保存运行设置</button>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between"><div><p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">Instance pool</p><h3 className="text-lg font-display text-foreground mt-2">实例池</h3></div><span className="text-xs text-text-muted">{slots.length} 个槽位</span></div>
          <div className="overflow-x-auto mt-5"><table className="w-full text-sm"><thead><tr className="text-left text-text-muted border-b border-glass-border"><th className="p-3">槽位</th><th className="p-3">状态</th><th className="p-3">正在生成</th><th className="p-3">ComfyUI 排队</th><th className="p-3">操作</th></tr></thead><tbody>{slots.map((slot) => <tr key={slot.id} className="border-b border-glass-border"><td className="p-3 text-foreground font-medium">{slot.label}</td><td className="p-3 text-text-secondary">{slot.status}</td><td className="p-3 text-text-secondary">{slot.generation}</td><td className="p-3 text-text-secondary">{slot.queue}</td><td className="p-3"><button type="button" className="glass-button text-xs" disabled={slot.id !== 1} onClick={() => setSlots((items) => items.map((item) => item.id === slot.id ? { ...item, status: "已释放" } : item))}>释放</button></td></tr>)}</tbody></table></div>
          <button type="button" className="border border-status-failed-fg/60 text-status-failed-fg rounded-lg px-4 py-2 mt-5" onClick={() => setMessage("批量释放将在真实实例 API 接入后执行")}>释放全部本地实例</button>
        </div>
      </div>
    </div>
  );
}
