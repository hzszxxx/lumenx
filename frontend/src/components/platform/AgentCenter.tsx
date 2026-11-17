"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit2,
  FileSpreadsheet,
  GraduationCap,
  KeyRound,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  UserCheck,
  Users,
} from "lucide-react";
import {
  platformApi,
  type AgentProfile,
  type AgentInviteBatch,
  type AgentInvite,
  type AgentStudent,
} from "@/lib/platformApi";
import { usePlatformStore } from "@/store/platformStore";

export default function AgentCenter() {
  const { user } = usePlatformStore();
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [batches, setBatches] = useState<AgentInviteBatch[]>([]);
  const [invites, setInvites] = useState<AgentInvite[]>([]);
  const [students, setStudents] = useState<AgentStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<"invites" | "students" | "batches" | "purchase" | "profile">("invites");

  // Filter & Search
  const [selectedBatchId, setSelectedBatchId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "unused" | "used">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Purchase Form
  const [purchaseQuantity, setPurchaseQuantity] = useState<number>(10);
  const [purchaseTitle, setPurchaseTitle] = useState("");
  const [purchasePackageType, setPurchasePackageType] = useState("standard");
  const [purchaseExpiresDays, setPurchaseExpiresDays] = useState<number>(180);
  const [purchasing, setPurchasing] = useState(false);

  // Profile Edit Form
  const [agencyType, setAgencyType] = useState<"individual" | "institution">("institution");
  const [institutionName, setInstitutionName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Note edit in table
  const [editingNoteInviteId, setEditingNoteInviteId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState("");

  const refreshAll = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [prof, batchList, inviteList, studentList] = await Promise.all([
        platformApi.agentProfile(),
        platformApi.agentBatches(),
        platformApi.agentInvites(),
        platformApi.agentStudents(),
      ]);
      setProfile(prof);
      setBatches(batchList);
      setInvites(inviteList);
      setStudents(studentList);

      setAgencyType(prof.agency_type || "institution");
      setInstitutionName(prof.institution_name || "");
      setContactName(prof.contact_name || "");
      setContactPhone(prof.contact_phone || "");
      setNotes(prof.notes || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取代理信息失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshAll();
  }, []);

  const handleCopy = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleBatchCopyUnused = () => {
    const unused = filteredInvites.filter((item) => item.used_count === 0).map((item) => item.code);
    if (unused.length === 0) {
      setMessage("当前没有未激活的邀请码");
      return;
    }
    const text = unused.join("\n");
    void navigator.clipboard.writeText(text);
    setMessage(`已成功复制 ${unused.length} 个未激活注册码到剪贴板`);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleBatchCopyCards = () => {
    const unused = filteredInvites.filter((item) => item.used_count === 0);
    if (unused.length === 0) {
      setMessage("当前没有未激活的邀请码");
      return;
    }
    const formatted = unused
      .map((item, idx) => {
        return `【LumenX / 影伴学员专属激活码】\n序号：#${idx + 1}\n班级：${item.batch_title || "实训班"}\n注册码：${item.code}\n学生备注：${item.student_note || "待分配"}\n注册地址：https://yingban.renban.net/#/platform\n`;
      })
      .join("\n-------------------------\n");
    void navigator.clipboard.writeText(formatted);
    setMessage(`已格式化复制 ${unused.length} 张学员发放卡片`);
    setTimeout(() => setMessage(null), 3500);
  };

  const handleSaveInviteNote = async (inviteId: string) => {
    try {
      await platformApi.updateAgentInviteNote(inviteId, editingNoteValue);
      setInvites((prev) =>
        prev.map((item) => (item.id === inviteId ? { ...item, student_note: editingNoteValue } : item))
      );
      setEditingNoteInviteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新备注失败");
    }
  };

  const calculatePrice = (qty: number) => {
    let base = 5000;
    if (qty >= 100) base = 2500;
    else if (qty >= 50) base = 3500;
    else if (qty >= 10) base = 4000;
    const discount = profile?.discount_rate || 1.0;
    const unitPrice = Math.max(100, Math.floor(base * discount));
    const total = unitPrice * qty;
    return { baseUnitYuan: (base / 100).toFixed(0), unitYuan: (unitPrice / 100).toFixed(2), totalYuan: (total / 100).toFixed(2) };
  };

  const handlePurchase = async (e: FormEvent) => {
    e.preventDefault();
    if (!purchaseTitle.trim()) {
      setError("请填写采购批次或班级名称");
      return;
    }
    setPurchasing(true);
    setError(null);
    try {
      const expiresAt =
        purchaseExpiresDays > 0
          ? new Date(Date.now() + purchaseExpiresDays * 24 * 3600 * 1000).toISOString()
          : undefined;
      const res = await platformApi.purchaseAgentInvites({
        quantity: purchaseQuantity,
        title: purchaseTitle.trim(),
        package_type: purchasePackageType,
        expires_at: expiresAt,
      });
      setMessage(`采购成功！已生成 ${res.batch.quantity} 个学员注册码 (批次号: ${res.batch.batch_no})`);
      setPurchaseTitle("");
      await refreshAll();
      setActiveTab("invites");
    } catch (err) {
      setError(err instanceof Error ? err.message : "采购失败");
    } finally {
      setPurchasing(false);
    }
  };

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    setError(null);
    try {
      const updated = await platformApi.updateAgentProfile({
        agency_type: agencyType,
        institution_name: institutionName.trim(),
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        notes: notes.trim(),
      });
      setProfile(updated);
      setMessage("代理机构信息已更新");
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新代理信息失败");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const filteredInvites = invites.filter((inv) => {
    if (selectedBatchId !== "all" && inv.batch_id !== selectedBatchId) return false;
    if (statusFilter === "unused" && inv.used_count > 0) return false;
    if (statusFilter === "used" && inv.used_count === 0) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const codeMatch = inv.code.toLowerCase().includes(q);
      const noteMatch = (inv.student_note || "").toLowerCase().includes(q);
      const studentMatch = (inv.student_username || "").toLowerCase().includes(q);
      const batchMatch = (inv.batch_title || "").toLowerCase().includes(q);
      if (!codeMatch && !noteMatch && !studentMatch && !batchMatch) return false;
    }
    return true;
  });

  const priceInfo = calculatePrice(purchaseQuantity);

  return (
    <div className="space-y-6">
      {/* Agent Top Banner / Profile Summary */}
      <section className="glass-panel p-6 border-glass-border">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-primary/20 p-4 text-primary border border-primary/30">
              <Building2 size={32} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-display font-semibold text-foreground">
                  {profile?.institution_name || user?.username || "渠道合作代理中心"}
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/30">
                  <ShieldCheck size={13} />
                  {profile?.agency_type === "institution" ? "培训机构" : "个人代理"}
                </span>
                {profile?.discount_rate && profile.discount_rate < 1.0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-status-success-bg text-status-success-fg border border-status-success-fg/30">
                    <Sparkles size={12} />
                    专属 {(profile.discount_rate * 10).toFixed(1)} 折
                  </span>
                )}
              </div>
              <p className="text-sm text-text-secondary mt-1">
                负责人：{profile?.contact_name || user?.username || "—"} · 电话：{profile?.contact_phone || "未设置"} · 批量采购注册码与学员归属统一管理
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={refreshing}
              className="glass-button text-xs py-2 px-3"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              刷新数据
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("purchase")}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-foreground hover:bg-primary/90 transition shadow-sm flex items-center gap-1.5"
            >
              <Plus size={15} />
              批采学员注册码
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-surface/50 border border-glass-border p-4 rounded-xl">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span>总批采注册码</span>
              <KeyRound size={16} className="text-primary" />
            </div>
            <p className="text-2xl font-mono font-bold mt-2 text-foreground">
              {profile?.metrics.purchased_invites ?? 0}
            </p>
            <span className="text-[11px] text-text-secondary mt-0.5 block">平台批采总容量</span>
          </div>

          <div className="bg-surface/50 border border-glass-border p-4 rounded-xl">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span>已激活学员</span>
              <UserCheck size={16} className="text-status-success-fg" />
            </div>
            <p className="text-2xl font-mono font-bold mt-2 text-status-success-fg">
              {profile?.metrics.total_students ?? 0}
            </p>
            <span className="text-[11px] text-text-secondary mt-0.5 block">已绑定注册并核销</span>
          </div>

          <div className="bg-surface/50 border border-glass-border p-4 rounded-xl">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span>剩余可用库存</span>
              <Package size={16} className="text-primary" />
            </div>
            <p className="text-2xl font-mono font-bold mt-2 text-foreground">
              {profile?.metrics.remaining_invites ?? 0}
            </p>
            <span className="text-[11px] text-text-secondary mt-0.5 block">待分发给学员</span>
          </div>

          <div className="bg-surface/50 border border-glass-border p-4 rounded-xl">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span>采购批次数</span>
              <GraduationCap size={16} className="text-primary" />
            </div>
            <p className="text-2xl font-mono font-bold mt-2 text-foreground">
              {profile?.metrics.total_batches ?? 0}
            </p>
            <span className="text-[11px] text-text-secondary mt-0.5 block">班级 / 实训期次</span>
          </div>
        </div>
      </section>

      {/* Notifications */}
      {message && (
        <div className="p-3.5 rounded-xl bg-status-success-bg/20 text-status-success-fg border border-status-success-fg/30 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            {message}
          </span>
          <button type="button" onClick={() => setMessage(null)} className="text-xs hover:underline">
            关闭
          </button>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-status-failed-bg/20 text-status-failed-fg border border-status-failed-fg/30 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-xs hover:underline">
            关闭
          </button>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-glass-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("invites")}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition ${
            activeTab === "invites"
              ? "bg-primary text-foreground font-semibold shadow-sm"
              : "text-text-secondary hover:text-foreground hover:bg-hover-bg"
          }`}
        >
          注册码库存与分发 ({invites.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("students")}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition ${
            activeTab === "students"
              ? "bg-primary text-foreground font-semibold shadow-sm"
              : "text-text-secondary hover:text-foreground hover:bg-hover-bg"
          }`}
        >
          学员花名册 ({students.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("batches")}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition ${
            activeTab === "batches"
              ? "bg-primary text-foreground font-semibold shadow-sm"
              : "text-text-secondary hover:text-foreground hover:bg-hover-bg"
          }`}
        >
          采购批次记录 ({batches.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("purchase")}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition ${
            activeTab === "purchase"
              ? "bg-primary text-foreground font-semibold shadow-sm"
              : "text-text-secondary hover:text-foreground hover:bg-hover-bg"
          }`}
        >
          采购新注册码
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition ${
            activeTab === "profile"
              ? "bg-primary text-foreground font-semibold shadow-sm"
              : "text-text-secondary hover:text-foreground hover:bg-hover-bg"
          }`}
        >
          代理资质设置
        </button>
      </div>

      {/* TAB 1: INVITES INVENTORY & DISTRIBUTION */}
      {activeTab === "invites" && (
        <section className="glass-panel p-6 border-glass-border space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Batch Filter */}
              <select
                className="glass-input text-xs py-1.5"
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
              >
                <option value="all">全部采购批次</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.quantity}码)
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                className="glass-input text-xs py-1.5"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "unused" | "used")}
              >
                <option value="all">全部使用状态</option>
                <option value="unused">仅显示未激活 ({invites.filter((i) => i.used_count === 0).length})</option>
                <option value="used">仅显示已激活 ({invites.filter((i) => i.used_count > 0).length})</option>
              </select>

              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-text-muted" />
                <input
                  className="glass-input text-xs pl-8 py-1.5 w-44"
                  placeholder="搜索邀请码/备注/学员"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Batch Export / Copy Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBatchCopyUnused}
                className="glass-button text-xs py-1.5 px-3 flex items-center gap-1.5"
                title="一键复制所有未激活的纯邀请码，按行分割"
              >
                <Copy size={13} />
                复制未激活码
              </button>
              <button
                type="button"
                onClick={handleBatchCopyCards}
                className="glass-button text-xs py-1.5 px-3 flex items-center gap-1.5"
                title="复制包含注册链接与说明的完整卡片文本，方便发到微信/学员群"
              >
                <FileSpreadsheet size={13} />
                导出学员卡片
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-glass-border">
            <table className="w-full text-xs">
              <thead className="bg-surface/70 text-text-muted border-b border-glass-border">
                <tr>
                  <th className="py-3 px-4 text-left">注册邀请码</th>
                  <th className="py-3 px-4 text-left">所属班级/批次</th>
                  <th className="py-3 px-4 text-left">学员备注</th>
                  <th className="py-3 px-4 text-left">激活状态</th>
                  <th className="py-3 px-4 text-left">核销学员</th>
                  <th className="py-3 px-4 text-left">有效期</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {filteredInvites.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-text-muted">
                      暂无匹配的注册邀请码，可点击右上角「批采学员注册码」生成
                    </td>
                  </tr>
                ) : (
                  filteredInvites.map((item) => {
                    const isUsed = item.used_count > 0;
                    const isCopied = copiedCode === item.id;
                    return (
                      <tr key={item.id} className="hover:bg-hover-bg transition">
                        {/* Code */}
                        <td className="py-3 px-4 font-mono font-semibold text-foreground">
                          <span className="tracking-wider">{item.code}</span>
                        </td>

                        {/* Batch Title */}
                        <td className="py-3 px-4 text-text-secondary">
                          {item.batch_title || "普通批次"}
                        </td>

                        {/* Student Note */}
                        <td className="py-3 px-4">
                          {editingNoteInviteId === item.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                className="glass-input py-0.5 px-2 text-xs w-32"
                                value={editingNoteValue}
                                onChange={(e) => setEditingNoteValue(e.target.value)}
                                placeholder="输入学员姓名/学号"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => void handleSaveInviteNote(item.id)}
                                className="p-1 rounded bg-primary text-foreground hover:bg-primary/80"
                              >
                                <Check size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 group">
                              <span className={item.student_note ? "text-foreground" : "text-text-muted italic"}>
                                {item.student_note || "点击备注学员"}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNoteInviteId(item.id);
                                  setEditingNoteValue(item.student_note || "");
                                }}
                                className="text-text-muted hover:text-primary opacity-0 group-hover:opacity-100 transition"
                              >
                                <Edit2 size={12} />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          {isUsed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-status-success-bg/20 text-status-success-fg border border-status-success-fg/30">
                              <CheckCircle2 size={11} />
                              已激活
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-primary/10 text-primary border border-primary/20">
                              待激活
                            </span>
                          )}
                        </td>

                        {/* Bound Student Info */}
                        <td className="py-3 px-4 text-text-secondary">
                          {isUsed ? (
                            <div>
                              <p className="font-medium text-foreground">{item.student_username}</p>
                              <p className="text-[10px] text-text-muted">
                                {item.student_registered_at ? new Date(item.student_registered_at).toLocaleDateString() : ""}
                              </p>
                            </div>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>

                        {/* Expiration */}
                        <td className="py-3 px-4 text-text-muted">
                          {item.expires_at ? new Date(item.expires_at).toLocaleDateString() : "永久有效"}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleCopy(item.code, item.id)}
                            className="glass-button text-xs py-1 px-2.5 inline-flex items-center gap-1"
                          >
                            {isCopied ? (
                              <>
                                <Check size={12} className="text-status-success-fg" />
                                <span className="text-status-success-fg">已复制</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                复制
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: BOUND STUDENTS */}
      {activeTab === "students" && (
        <section className="glass-panel p-6 border-glass-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">已绑定学员花名册</h3>
              <p className="text-xs text-text-secondary mt-0.5">
                学员使用您的机构邀请码注册后自动与您的代理机构绑定，终身归属于您的渠道
              </p>
            </div>
            <span className="text-xs text-text-muted">共 {students.length} 名学员</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-glass-border">
            <table className="w-full text-xs">
              <thead className="bg-surface/70 text-text-muted border-b border-glass-border">
                <tr>
                  <th className="py-3 px-4 text-left">学员账号</th>
                  <th className="py-3 px-4 text-left">学员邮箱</th>
                  <th className="py-3 px-4 text-left">核销注册码</th>
                  <th className="py-3 px-4 text-left">班级批次</th>
                  <th className="py-3 px-4 text-left">注册绑定时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-text-muted">
                      暂无激活学员。将您的邀请码发送给学员注册即可完成自动绑定
                    </td>
                  </tr>
                ) : (
                  students.map((st) => (
                    <tr key={st.id} className="hover:bg-hover-bg transition">
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {st.student_username}
                      </td>
                      <td className="py-3 px-4 text-text-secondary">{st.student_email || "未填写邮箱"}</td>
                      <td className="py-3 px-4 font-mono text-primary">{st.invite_code}</td>
                      <td className="py-3 px-4 text-text-secondary">{st.batch_title || "标准学员包"}</td>
                      <td className="py-3 px-4 text-text-muted">
                        {new Date(st.registered_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: BATCH PURCHASE HISTORY */}
      {activeTab === "batches" && (
        <section className="glass-panel p-6 border-glass-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">采购批次记录</h3>
              <p className="text-xs text-text-secondary mt-0.5">历次学员码批采单据与结算明细</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("purchase")}
              className="glass-button text-xs py-1.5 px-3"
            >
              <Plus size={13} />
              新建采购
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-glass-border">
            <table className="w-full text-xs">
              <thead className="bg-surface/70 text-text-muted border-b border-glass-border">
                <tr>
                  <th className="py-3 px-4 text-left">批次号</th>
                  <th className="py-3 px-4 text-left">采购主题/班级</th>
                  <th className="py-3 px-4 text-left">采购数量</th>
                  <th className="py-3 px-4 text-left">批采单价</th>
                  <th className="py-3 px-4 text-left">总计金额</th>
                  <th className="py-3 px-4 text-left">状态</th>
                  <th className="py-3 px-4 text-left">采购时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-text-muted">
                      暂无采购记录
                    </td>
                  </tr>
                ) : (
                  batches.map((b) => (
                    <tr key={b.id} className="hover:bg-hover-bg transition">
                      <td className="py-3 px-4 font-mono text-primary">{b.batch_no}</td>
                      <td className="py-3 px-4 font-medium text-foreground">{b.title}</td>
                      <td className="py-3 px-4 font-mono">{b.quantity} 个</td>
                      <td className="py-3 px-4 text-text-secondary">¥{(b.unit_price_cents / 100).toFixed(2)}</td>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        ¥{(b.total_price_cents / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-status-success-bg/20 text-status-success-fg border border-status-success-fg/30">
                          已交付出码
                        </span>
                      </td>
                      <td className="py-3 px-4 text-text-muted">{new Date(b.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 4: PURCHASE NEW REGISTRATION CODES */}
      {activeTab === "purchase" && (
        <section className="glass-panel p-6 border-glass-border max-w-3xl mx-auto space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-foreground">批量采购学员注册码</h3>
            <p className="text-xs text-text-secondary mt-1">
              按阶梯优惠批量采购学员邀请码，生成后可打包分发给培训班学员，学员注册后自动归属机构
            </p>
          </div>

          {/* Pricing Tiers Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { qty: 10, label: "小班实战包 (10码)", unit: "¥40/码", desc: "适合短期精品班/集训营" },
              { qty: 50, label: "进阶中班包 (50码)", unit: "¥35/码", desc: "适合常规学期培训班", popular: true },
              { qty: 100, label: "机构定制包 (100码)", unit: "¥25/码", desc: "适合大型培训机构/院校采购" },
            ].map((pkg) => {
              const isSelected = purchaseQuantity === pkg.qty;
              return (
                <div
                  key={pkg.qty}
                  onClick={() => setPurchaseQuantity(pkg.qty)}
                  className={`cursor-pointer p-4 rounded-xl border transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-glass-border bg-surface/40 hover:bg-hover-bg"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">{pkg.label}</span>
                    {pkg.popular && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary text-foreground">推荐</span>
                    )}
                  </div>
                  <p className="text-lg font-mono font-bold text-primary mt-2">{pkg.unit}</p>
                  <p className="text-[11px] text-text-muted mt-1">{pkg.desc}</p>
                </div>
              );
            })}
          </div>

          <form onSubmit={handlePurchase} className="space-y-4">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">采购数量 (可自定义)</label>
              <input
                type="number"
                min={1}
                max={1000}
                className="glass-input w-full font-mono text-sm"
                value={purchaseQuantity}
                onChange={(e) => setPurchaseQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                required
              />
              <p className="text-[11px] text-text-muted mt-1">
                定价规则：1-9码 (¥50/码) · 10-49码 (¥40/码) · 50-99码 (¥35/码) · 100码以上 (¥25/码)
              </p>
            </div>

            <div>
              <label className="text-xs text-text-secondary mb-1 block">班级/期次名称 (必填)</label>
              <input
                type="text"
                className="glass-input w-full text-sm"
                placeholder="例如：2026春季视效实战营-第一期"
                value={purchaseTitle}
                onChange={(e) => setPurchaseTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs text-text-secondary mb-1 block">注册码有效期</label>
              <select
                className="glass-input w-full text-xs"
                value={purchaseExpiresDays}
                onChange={(e) => setPurchaseExpiresDays(parseInt(e.target.value))}
              >
                <option value={30}>30 天内有效</option>
                <option value={90}>90 天内有效 (一季度)</option>
                <option value={180}>180 天内有效 (半年)</option>
                <option value={365}>365 天内有效 (一年)</option>
                <option value={0}>永久有效 (不设过期)</option>
              </select>
            </div>

            {/* Price Breakdown Card */}
            <div className="bg-surface/60 border border-glass-border p-4 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-text-secondary">
                <span>阶梯基础单价</span>
                <span className="font-mono">¥{priceInfo.baseUnitYuan} / 码</span>
              </div>
              {profile?.discount_rate && profile.discount_rate < 1.0 && (
                <div className="flex justify-between text-status-success-fg font-medium">
                  <span>机构代理专属折扣</span>
                  <span>{(profile.discount_rate * 10).toFixed(1)} 折优惠</span>
                </div>
              )}
              <div className="flex justify-between text-text-secondary">
                <span>折后结算单价</span>
                <span className="font-mono text-primary font-semibold">¥{priceInfo.unitYuan} / 码</span>
              </div>
              <div className="pt-2 border-t border-glass-border flex justify-between items-center text-sm font-semibold text-foreground">
                <span>应付总计 ({purchaseQuantity} 码)</span>
                <span className="text-xl font-mono text-primary">¥{priceInfo.totalYuan}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={purchasing}
              className="w-full py-3 rounded-xl bg-primary text-foreground font-semibold text-sm hover:bg-primary/90 transition shadow-md disabled:opacity-50"
            >
              {purchasing ? "正在生成邀请码..." : `确认采购并出码 (总计 ¥${priceInfo.totalYuan})`}
            </button>
          </form>
        </section>
      )}

      {/* TAB 5: AGENT PROFILE & QUALIFICATION SETTINGS */}
      {activeTab === "profile" && (
        <section className="glass-panel p-6 border-glass-border max-w-2xl mx-auto space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-foreground">代理合作与资质设置</h3>
            <p className="text-xs text-text-secondary mt-1">完善机构信息与对接人联系方式</p>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">代理类型</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAgencyType("institution")}
                  className={`p-3 rounded-xl border text-xs font-medium text-left transition ${
                    agencyType === "institution"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-glass-border bg-surface/40 text-text-secondary"
                  }`}
                >
                  <Building2 size={16} className="text-primary mb-1" />
                  <p className="font-semibold">培训机构 / 院校</p>
                  <p className="text-[11px] text-text-muted mt-0.5">有线下或线上授课资质的教育实体</p>
                </button>
                <button
                  type="button"
                  onClick={() => setAgencyType("individual")}
                  className={`p-3 rounded-xl border text-xs font-medium text-left transition ${
                    agencyType === "individual"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-glass-border bg-surface/40 text-text-secondary"
                  }`}
                >
                  <Users size={16} className="text-primary mb-1" />
                  <p className="font-semibold">个人代理 / 独立导师</p>
                  <p className="text-[11px] text-text-muted mt-0.5">个人创作者、自媒体博主或技术导师</p>
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-text-secondary mb-1 block">机构全称 / 代理品牌名称</label>
              <input
                className="glass-input w-full text-sm"
                placeholder="例如：北京星火数字传媒培训学院"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-secondary mb-1 block">负责人姓名</label>
                <input
                  className="glass-input w-full text-sm"
                  placeholder="例如：王老师"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">联系电话 / 微信</label>
                <input
                  className="glass-input w-full text-sm"
                  placeholder="例如：13800138000"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-text-secondary mb-1 block">机构简介与合作备注</label>
              <textarea
                className="glass-input w-full text-xs h-20 resize-none"
                placeholder="例如：专注于AIGC影视实训，每期学员规模约30人..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={updatingProfile}
              className="w-full py-2.5 rounded-xl bg-primary text-foreground font-semibold text-xs hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
            >
              {updatingProfile ? "保存中..." : "保存资质与信息"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
