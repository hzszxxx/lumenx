import { getApiUrl } from "./apiUrl";

const TOKEN_KEY = "lumenx_platform_token";

export type PlatformUser = { id: string; username: string; email?: string | null; role: string };
export type PlatformSession = { access_token: string; expires_at: string; user: PlatformUser };
export type PlatformSkillManifest = { name: string; version: string; title: string; description: string; category: "story" | "shot" | "review" | "sequence"; prompt_template: string; expected_tools: string[]; content_hash: string };
export type PlatformSkillVersion = { id: string; name: string; version: string; scope: string; owner_id?: string | null; project_id?: string | null; parent_version?: string | null; content_hash: string; status: string; created_at: string };
export type AdminUser = {
  id: string;
  username: string;
  email?: string | null;
  nickname?: string | null;
  role: string;
  is_active: boolean | number;
  created_at: string;
  updated_at: string;
  registered_invite_code?: string | null;
  registration_source?: "open" | "agent" | "admin" | "test_access" | null;
  inviter_user_id?: string | null;
  inviter_name?: string | null;
  inviter_username?: string | null;
};
export type AdminOverview = { users: { total: number; active: number; creators: number; admins: number }; tasks: { total: number; open: number }; competitions: { total: number; active: number }; submissions: { total: number; pending: number }; ledger_balance_cents: number };
export type XiangongyunStatus = { provider: "xiangongyun"; verified: true; credential_id: string; account: { nickname?: string; phone?: string; uuid?: string }; balance: number | null; instances: Array<Record<string, unknown>>; checked_at: string };

export type PlatformCompetition = {
  id: string;
  title: string;
  slug: string;
  description: string;
  rules_markdown?: string;
  whitelist_required: number | boolean;
  allocated_credits: number;
  status: "draft" | "enrolling" | "ongoing" | "judging" | "ended";
  enroll_deadline?: string | null;
  submit_deadline?: string | null;
  created_at: string;
};

export type DeliverableSpecs = {
  format?: string; // 9:16 / 16:9 / 1:1
  resolution?: string; // 1080P / 4K
  duration_seconds?: number; // 30s
  deliverable_count?: number; // 3条
  fps?: number; // 25 / 30 / 60
  assets_included?: string[]; // 分镜流, 角色定妆卡, 无损音频, 剪辑工程
};

export type MilestoneSpec = {
  stage: string;
  percentage: number;
  description: string;
};

export type CopyrightTerms = {
  scope: string; // "全网商业信息流" / "品牌电商主图与社媒" / "全版权买断"
  allow_derivative: boolean;
  require_ai_label: boolean;
};

export type PlatformTask = {
  id: string;
  title: string;
  category: string;
  brief_markdown: string;
  bounty_cents: number;
  required_level: string;
  deadline: string;
  status: string;
  version: number;
  created_at: string;
  claimed_by?: string | null;
  demand_type?: "visual_content" | "short_video_flow" | "ai_drama" | "interactive_game" | string;
  deliverable_specs_json?: string;
  budget_mode?: "fixed" | "range" | "per_unit";
  budget_min_cents?: number;
  budget_max_cents?: number;
  settlement_mode?: "one_time" | "milestone";
  milestone_specs_json?: string;
  copyright_terms_json?: string;
  acceptance_criteria_json?: string;
  reference_media_json?: string;
  client_name?: string;
  level_tier?: "beginner" | "standard" | "pro";
  contract_id?: string | null;
  contract_signed_at?: string | null;
};

export type PlatformContract = {
  id: string;
  task_id: string;
  creator_id: string;
  contract_type: string;
  status: string;
  digest_hash: string;
  signer_name: string;
  signed_at: string;
  terms: {
    contract_type?: string;
    title?: string;
    milestone_settlement?: string;
    nda_clause?: string;
    copyright_clause?: string;
    arbitration_clause?: string;
  };
};

export type PlatformCourse = {
  id: string;
  title: string;
  description: string;
  video_url: string;
  status: string;
};

export type PlatformTemplate = {
  id: string;
  title: string;
  source_project_id: string;
  version: string;
  metadata_json: string;
  status: string;
};

export type PlatformCertification = {
  status: "unapplied" | "reviewing" | "certified" | "rejected";
  level: string;
  source_type?: string;
  score?: number | null;
  feedback?: string | null;
  certified_at?: string | null;
};

export type PlatformExam = {
  id: string;
  prompt: string;
  version: string;
  is_active: number;
  created_at: string;
};

export function getPlatformToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearPlatformToken() {
  if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
}

export function formatPlatformError(detail: unknown): string {
  if (typeof detail === "string") {
    const trimmed = detail.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        return formatPlatformError(parsed);
      } catch {
        // Not valid JSON, continue with string handling
      }
    }
    const knownMessages: Record<string, string> = {
      invalid_credentials: "账号或密码错误",
      weak_password: "密码长度至少需要 12 位字符",
      invite_required: "需要有效的内测邀请码",
      invalid_invite: "邀请码无效、已过期或已被使用",
      user_exists: "该用户名已被注册，请尝试其他用户名或直接登录",
      user_not_found: "用户不存在",
      account_disabled: "账户已被禁用，请联系管理员",
      session_invalid: "登录会话已失效，请重新登录",
      permission_denied: "权限不足",
    };
    return knownMessages[trimmed] || trimmed;
  }
  if (!detail) return "请求处理失败，请稍后重试";

  if (typeof detail === "object" && !Array.isArray(detail)) {
    const obj = detail as Record<string, any>;
    if (obj.message && typeof obj.message === "string") {
      return formatPlatformError(obj.message);
    }
    if (obj.code && typeof obj.code === "string") {
      return formatPlatformError(obj.code);
    }
    if (obj.error && typeof obj.error === "string") {
      return formatPlatformError(obj.error);
    }
  }

  if (Array.isArray(detail)) {
    const fieldLabels: Record<string, string> = {
      username: "用户名",
      password: "密码",
      email: "电子邮箱",
      invite_code: "邀请码",
      code: "邀请码",
    };

    const messages = detail.map((err) => {
      if (typeof err === "string") return formatPlatformError(err);
      if (!err || typeof err !== "object") return "输入内容不符合要求";
      const loc = Array.isArray(err.loc) ? err.loc : [];
      const fieldKey = String(loc[loc.length - 1] || "");
      const fieldLabel = fieldLabels[fieldKey] || (fieldKey ? fieldKey : "输入项");
      const errType = String(err.type || "");
      const ctx = (err.ctx && typeof err.ctx === "object") ? err.ctx : {};
      const msg = String(err.msg || "");

      if (errType === "string_too_short" || msg.includes("at least")) {
        const minLen = ctx.min_length || (msg.match(/at least (\d+)/)?.[1]);
        return `${fieldLabel}长度不能少于 ${minLen || ""} 位字符`.replace(/\s+/g, " ").trim();
      }
      if (errType === "string_too_long" || msg.includes("at most")) {
        const maxLen = ctx.max_length || (msg.match(/at most (\d+)/)?.[1]);
        return `${fieldLabel}长度不能超过 ${maxLen || ""} 位字符`.replace(/\s+/g, " ").trim();
      }
      if (errType === "value_error.email" || fieldKey === "email") {
        return "请输入有效的电子邮箱格式";
      }
      if (msg) {
        return `${fieldLabel}: ${msg}`;
      }
      return `${fieldLabel}格式不符合要求`;
    });

    const uniqueMessages = Array.from(new Set(messages.filter(Boolean)));
    return uniqueMessages.join("；");
  }

  return String(detail);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getPlatformToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${getApiUrl()}/api/platform${path}`, { ...init, headers });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const rawDetail = body?.detail?.message || body?.detail;
    const message = formatPlatformError(rawDetail) || `Platform request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

export const platformApi = {
  register: (payload: { username: string; password: string; email?: string; invite_code?: string }) => request<PlatformUser>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: async (payload: { username: string; password: string }) => {
    const session = await request<PlatformSession>("/auth/login", { method: "POST", body: JSON.stringify(payload) });
    if (typeof window !== "undefined") window.localStorage.setItem(TOKEN_KEY, session.access_token);
    return session;
  },
  me: () => request<PlatformUser & { wallet?: { simulated_balance_cents: number } }>("/auth/me"),
  logout: async () => { await request("/auth/logout", { method: "POST" }); clearPlatformToken(); },
  competitions: () => request<PlatformCompetition[]>("/competitions"),
  competitionDetail: (id: string) => request<PlatformCompetition>(`/competitions/${id}`),
  competitionLeaderboard: (id: string) => request<Array<{ submission_id: string; user_id: string; title: string; score: number; award_title?: string; status: string }>>(`/competitions/${id}/leaderboard`),
  enrollCompetition: (id: string, inviteCode?: string, idempotencyKey = crypto.randomUUID()) => request<{ status: string }>(`/competitions/${id}/enroll${inviteCode ? `?invite_code=${encodeURIComponent(inviteCode)}` : ""}`, { method: "POST", headers: { "Idempotency-Key": idempotencyKey } }),

  courses: () => request<PlatformCourse[]>("/academy/courses"),
  templates: () => request<PlatformTemplate[]>("/academy/templates"),
  forkTemplate: (templateId: string, forkProjectId = crypto.randomUUID()) => request(`/academy/templates/${templateId}/fork`, { method: "POST", body: JSON.stringify({ fork_project_id: forkProjectId }) }),

  tasks: () => request<PlatformTask[]>("/tasks/square"),
  createTask: (payload: {
    title: string;
    category: string;
    brief_markdown: string;
    bounty_cents: number;
    deadline: string;
    required_level?: string;
    status?: string;
    demand_type?: string;
    deliverable_specs_json?: string | Record<string, unknown>;
    budget_mode?: string;
    budget_min_cents?: number;
    budget_max_cents?: number;
    settlement_mode?: string;
    milestone_specs_json?: string | Array<unknown>;
    copyright_terms_json?: string | Record<string, unknown>;
    acceptance_criteria_json?: string | Array<unknown>;
    reference_media_json?: string | Array<unknown>;
    client_name?: string;
    level_tier?: string;
  }) => request<PlatformTask>("/tasks", { method: "POST", body: JSON.stringify(payload) }),
  claimTask: (taskId: string, idempotencyKey = crypto.randomUUID()) => request<{ task_id: string; status: string; contract_id?: string; contract_signed_at?: string; digest_hash?: string }>(`/tasks/${taskId}/claim`, { method: "POST", headers: { "Idempotency-Key": idempotencyKey } }),
  taskContract: (taskId: string) => request<PlatformContract>(`/tasks/${taskId}/contract`),
  deliverTask: (taskId: string, payload: {
    product?: "studio" | "atelier";
    artifact_id: string;
    artifact_version: string;
    sha256: string;
    media_type?: string;
    project_id: string;
    project_title_snapshot?: string;
    title?: string;
    description?: string;
    delivery_note?: string;
  }) => request<{ id: string; task_id: string; version_num: number; status: string }>(`/tasks/${taskId}/deliver`, { method: "POST", body: JSON.stringify(payload) }),
  reviewTask: (taskId: string, payload: { approved: boolean; feedback?: string }) => request<{ task_id: string; status: string; feedback: string }>(`/tasks/${taskId}/review`, { method: "POST", body: JSON.stringify(payload) }),
  wallet: () => request<{ user_id: string; simulated_balance_cents: number }>("/settlement/wallet"),
  transactions: () => request<Array<{ entry_id: string; transaction_id: string; amount_cents: number; direction: string; reference_type: string; reference_id: string; created_at: string }>>("/settlement/transactions"),
  convertCredits: (amountCents: number) => request<{ converted_cents: number; granted_credits: number; available_credits: number; simulated_balance_cents: number }>("/settlement/convert-credits", { method: "POST", body: JSON.stringify({ amount_cents: amountCents }) }),
  withdraw: (payload: { amount_cents: number; payout_channel: string; account_info: string }) => request<{ withdrawal_id: string; amount_cents: number; payout_channel: string; simulated_balance_cents: number; status: string }>("/settlement/withdraw", { method: "POST", body: JSON.stringify(payload) }),

  certification: () => request<PlatformCertification | null>("/certifications/status"),
  activeExam: () => request<PlatformExam | null>("/certifications/exam/prompt"),
  applyCertification: (payload: { exam_id: string; artifact: Record<string, unknown> }) => request("/certifications/apply", { method: "POST", body: JSON.stringify(payload) }),
  tokenUsage: (limit = 20) => request<{ prompt_tokens: number; completion_tokens: number; total_tokens: number; records: Array<Record<string, unknown>> }>(`/usage/tokens?limit=${limit}`),
  creditPricing: () => request<Array<{ provider: string; model: string; pricing_version: string; input_credits_per_1k: number; output_credits_per_1k: number }>>("/credits/pricing"),
  creditBalance: () => request<{ user_id: string; available_credits: number; credited_credits: number; debited_credits: number }>("/credits/balance"),
  creditLedger: (limit = 50) => request<Array<Record<string, unknown>>>(`/credits/ledger?limit=${limit}`),
  estimateCredits: (payload: { provider: string; model: string; prompt_tokens: number; completion_tokens: number }) => request<{ estimated_credits: number; pricing_version: string }>("/credits/estimate", { method: "POST", body: JSON.stringify(payload) }),
  mediaPricing: () => request<Array<{ provider: string; model: string; media_kind: string; pricing_version: string; credits_per_unit: number }>>("/credits/media-pricing"),
  estimateMediaCredits: (payload: { provider: string; model: string; media_kind: string; units: number }) => request<{ estimated_credits: number; pricing_version: string; credits_per_unit: number }>("/credits/media-estimate", { method: "POST", body: JSON.stringify(payload) }),
  reserveCredits: (payload: { estimated_credits: number; generation_id: string; pricing_version: string; idempotency_key: string }) => request<{ reservation_id: string; estimated_credits: number; status: string }>("/credits/reservations", { method: "POST", body: JSON.stringify(payload) }),
  settleCredits: (reservationId: string, actual_credits: number) => request(`/credits/reservations/${reservationId}/settle`, { method: "POST", body: JSON.stringify({ actual_credits }) }),
  releaseCredits: (reservationId: string) => request(`/credits/reservations/${reservationId}/release`, { method: "POST" }),
  credentials: () => request<Array<{ id: string; provider: string; label: string; masked_key: string; status: string; last_verified_at?: string | null }>>("/credentials"),
  createCredential: (payload: { provider: string; label: string; api_key: string }) => request("/credentials", { method: "POST", body: JSON.stringify(payload) }),
  verifyCredential: (credentialId: string) => request(`/credentials/${credentialId}/verify`, { method: "POST" }),
  rotateCredential: (credentialId: string, api_key: string) => request(`/credentials/${credentialId}/rotate`, { method: "POST", body: JSON.stringify({ api_key }) }),
  revokeCredential: (credentialId: string) => request(`/credentials/${credentialId}/revoke`, { method: "POST" }),
  skills: (name?: string, projectId?: string) => request<PlatformSkillVersion[]>(`/skills${name || projectId ? `?${new URLSearchParams({ ...(name ? { name } : {}), ...(projectId ? { project_id: projectId } : {}) }).toString()}` : ""}`),
  createSkillVersion: (payload: { manifest: PlatformSkillManifest; scope?: string; project_id?: string; parent_version?: string }) => request<PlatformSkillVersion>("/skills/versions", { method: "POST", body: JSON.stringify(payload) }),
  deleteSkillVersion: (skillVersionId: string) => request<{ id: string; deleted: boolean; name: string }>(`/skills/versions/${skillVersionId}`, { method: "DELETE" }),
  bindSkillVersion: (skillVersionId: string, active = true) => request(`/skills/versions/${skillVersionId}/bind?active=${active ? "true" : "false"}`, { method: "POST" }),
  resolveSkill: (name: string, projectId?: string) => request<Record<string, unknown>>(`/skills/${encodeURIComponent(name)}/resolve${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ""}`),
  adminOverview: () => request<AdminOverview>("/admin/overview"),
  authConfig: () => request<{ registration_invite_required: boolean }>("/auth/config"),
  adminSettings: () => request<{ registration_invite_required: boolean }>("/admin/settings"),
  adminUpdateRegistrationInvite: (required: boolean) => request<{ registration_invite_required: boolean }>("/admin/settings/registration-invite", { method: "POST", body: JSON.stringify({ required }) }),
  adminUsers: (params: { query?: string; role?: string; active?: string } = {}) => request<{ items: AdminUser[]; total: number; limit: number; offset: number }>(`/admin/users?${new URLSearchParams(params).toString()}`),
  adminUpdateUser: (id: string, payload: { role?: string; is_active?: boolean }) => request<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  adminAuditEvents: () => request<{ items: Array<{ id: string; actor_id: string | null; event_type: string; entity_type: string; entity_id: string | null; payload_json: string; created_at: string }>; total: number }>("/admin/audit-events?limit=100"),
  adminInvites: () => request<Array<{ id: string; code: string; max_uses: number; used_count: number; expires_at?: string | null; created_at: string }>>("/auth/invites"),
  createAdminInvite: (payload: { code?: string; max_uses?: number; expires_at?: string }) => request("/auth/invites", { method: "POST", body: JSON.stringify(payload) }),
  verifyXiangongyun: (access_token: string, idempotencyKey = crypto.randomUUID()) => request<XiangongyunStatus>("/xiangongyun/verify", { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ access_token }) }),
  xiangongyunStatus: () => request<XiangongyunStatus | null>("/xiangongyun/status"),
  clearXiangongyunBinding: (idempotencyKey = crypto.randomUUID()) => request<{ status: string }>("/xiangongyun/binding", { method: "DELETE", headers: { "Idempotency-Key": idempotencyKey } }),

  // Agent / Agency APIs
  agentProfile: () => request<AgentProfile>("/agent/profile"),
  updateAgentProfile: (payload: { agency_type?: string; institution_name?: string; contact_name?: string; contact_phone?: string; notes?: string }) => request<AgentProfile>("/agent/profile", { method: "PUT", body: JSON.stringify(payload) }),
  purchaseAgentInvites: (payload: { quantity: number; title: string; package_type?: string; expires_at?: string }) => request<{ batch: AgentInviteBatch; codes: AgentInvite[] }>("/agent/invites/purchase", { method: "POST", body: JSON.stringify(payload) }),
  agentBatches: () => request<AgentInviteBatch[]>("/agent/batches"),
  agentInvites: (batchId?: string) => request<AgentInvite[]>(`/agent/invites${batchId ? `?batch_id=${encodeURIComponent(batchId)}` : ""}`),
  updateAgentInviteNote: (inviteId: string, student_note: string) => request<{ id: string; student_note: string }>(`/agent/invites/${inviteId}/note`, { method: "PATCH", body: JSON.stringify({ student_note }) }),
  agentStudents: () => request<AgentStudent[]>("/agent/students"),
  agentCommissions: () => request<AgentCommission[]>("/agent/commissions"),
  adminAgents: () => request<AdminAgentItem[]>("/admin/agents"),
  adminUpdateAgent: (userId: string, payload: { agency_type?: string; institution_name?: string; contact_name?: string; contact_phone?: string; discount_rate?: number; commission_rate?: number; status?: string; notes?: string }) => request<AgentProfile>(`/admin/agents/${userId}`, { method: "PUT", body: JSON.stringify(payload) }),
};

export type AgentProfile = {
  id?: string;
  user_id: string;
  username: string;
  email?: string | null;
  role: string;
  agency_type: "individual" | "institution";
  institution_name: string;
  contact_name?: string | null;
  contact_phone?: string | null;
  discount_rate: number;
  commission_rate: number;
  status: "active" | "pending" | "disabled" | "unapplied";
  notes?: string | null;
  created_at: string;
  updated_at: string;
  metrics: {
    total_batches: number;
    purchased_invites: number;
    total_invites: number;
    used_invites: number;
    remaining_invites: number;
    total_students: number;
    total_commissions_cents: number;
  };
};

export type AgentInviteBatch = {
  id: string;
  agent_id: string;
  batch_no: string;
  title: string;
  package_type: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
  status: string;
  created_at: string;
};

export type AgentInvite = {
  id: string;
  code: string;
  max_uses: number;
  used_count: number;
  expires_at?: string | null;
  created_by?: string | null;
  created_at: string;
  last_used_at?: string | null;
  batch_id?: string | null;
  student_note?: string | null;
  batch_title?: string | null;
  student_user_id?: string | null;
  student_username?: string | null;
  student_registered_at?: string | null;
};

export type AgentStudent = {
  id: string;
  agent_id: string;
  student_user_id: string;
  invite_id: string;
  invite_code: string;
  batch_id?: string | null;
  notes?: string | null;
  registered_at: string;
  student_username: string;
  student_email?: string | null;
  batch_title?: string | null;
};

export type AdminAgentItem = AgentProfile & {
  id: string;
  total_batches: number;
  total_purchased: number;
  total_invites: number;
  used_invites: number;
  total_students: number;
  total_commissions_cents: number;
};

export type AgentCommission = {
  id: string;
  agent_id: string;
  student_user_id: string;
  student_username?: string;
  source_type: string;
  source_id?: string | null;
  amount_cents: number;
  commission_rate: number;
  commission_cents: number;
  status: string;
  description?: string | null;
  created_at: string;
};

