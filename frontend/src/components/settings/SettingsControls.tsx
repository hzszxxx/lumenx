"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Copy, Check, CircleAlert, Loader2, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";

/* ── Section card (Line B clean `.panel` — serif title + desc, no eyebrow) ─ */
export function SectionCard({
  eyebrow: _eyebrow,
  index: _index,
  title,
  desc,
  children,
  id,
}: {
  eyebrow?: string;
  index?: string;
  title: string;
  desc?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="glass-panel atelier-card rounded-[20px] overflow-hidden"
      aria-labelledby={id ? `${id}-title` : undefined}
    >
      <div className="atelier-card-head px-[22px] pt-[18px] pb-3.5 border-b border-glass-border">
        <h2
          id={id ? `${id}-title` : undefined}
          className="font-display atelier-display text-xl font-semibold text-foreground tracking-tight"
        >
          {title}
        </h2>
        {desc && <p className="text-[0.75rem] text-text-secondary mt-1 leading-relaxed">{desc}</p>}
      </div>
      <div className="px-[22px] pt-[18px] pb-[22px]">{children}</div>
    </section>
  );
}

/* ── Form row (Line B `.field` — stacked: label/hint on top, control below) ─ */
export function FormRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="mb-2.5">
        <div className="text-[0.875rem] font-semibold text-foreground leading-snug">{label}</div>
        {hint && <div className="text-[0.75rem] text-text-muted mt-1 leading-relaxed">{hint}</div>}
      </div>
      <div className="atelier-field min-w-0">{children}</div>
    </div>
  );
}

/* ── Mono uppercase field label (Line B `.field label`) ─────────── */
export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block font-mono text-[0.59375rem] uppercase tracking-[0.1em] text-text-muted mb-2">
      {children}
    </label>
  );
}

export const settingsInputClass =
  "w-full bg-input-bg border border-glass-border rounded-md px-3.5 py-2.5 text-[0.8125rem] text-foreground placeholder-text-muted focus:outline-none focus:border-primary/50 transition-colors";

/* ── Masked key field (Line A `.key-field`) ─────────────────────── */
export function KeyField({
  value,
  onChange,
  placeholder,
  status,
  onTest,
  isTesting,
  testResult,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  status?: { kind: "ok" | "warn"; text: string };
  onTest?: () => void;
  isTesting?: boolean;
  testResult?: { success: boolean; message: string; latency_ms?: number } | null;
}) {
  const t = useTranslations("settings");
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  return (
    <div className="atelier-field space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <input
            type={revealed ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={settingsInputClass + " pr-[78px] font-mono text-[0.75rem] tracking-wide"}
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-0.5">
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              aria-label={revealed ? t("hideKey") : t("showKey")}
              title={revealed ? t("hide") : t("show")}
              className="w-7 h-7 rounded-md grid place-items-center text-text-muted hover:bg-hover-bg hover:text-foreground transition-colors"
            >
              {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button
              type="button"
              onClick={copy}
              aria-label={t("copyKey")}
              title={t("copy")}
              className="w-7 h-7 rounded-md grid place-items-center text-text-muted hover:bg-hover-bg hover:text-foreground transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
        {onTest && (
          <button
            type="button"
            onClick={onTest}
            disabled={isTesting}
            className="shrink-0 h-[38px] px-3.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isTesting ? (
              <>
                <Loader2 size={13} className="animate-spin text-primary" />
                <span>{t("testingKey")}</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>{t("testKey")}</span>
              </>
            )}
          </button>
        )}
      </div>

      {testResult && (
        <div
          className={`p-2.5 rounded-lg border text-xs transition-all ${
            testResult.success
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5 leading-relaxed">
              {testResult.success ? (
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="whitespace-pre-line font-medium text-[0.75rem]">
                {testResult.message}
              </div>
            </div>
            {testResult.latency_ms !== undefined && (
              <span className="shrink-0 font-mono text-[0.6875rem] px-1.5 py-0.5 rounded bg-surface-inset border border-glass-border text-text-muted">
                {testResult.latency_ms}ms
              </span>
            )}
          </div>
        </div>
      )}

      {status && !testResult && (
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[0.59375rem] tracking-wide ${
            status.kind === "ok" ? "text-emerald-400" : "text-amber-400"
          }`}
        >
          {status.kind === "ok" ? <Check size={11} /> : <CircleAlert size={11} />}
          {status.text}
        </span>
      )}
    </div>
  );
}

/* ── Toggle switch (Line A `.toggle`) ───────────────────────────── */
export function Toggle({
  checked,
  onChange,
  label,
  sub,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sub?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? label}
        onClick={() => onChange(!checked)}
        className={`relative w-[42px] h-6 rounded-full border flex-shrink-0 transition-colors ${
          checked ? "bg-primary/25 border-primary" : "bg-input-bg border-glass-border"
        }`}
      >
        <span
          className={`absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all ${
            checked ? "left-[21px] bg-primary" : "left-0.5 bg-text-muted"
          }`}
        />
      </button>
      <div className="flex-1">
        <div className="text-[0.9375rem] font-semibold text-foreground">{label}</div>
        {sub && <div className="text-[0.75rem] text-text-muted mt-1 leading-relaxed">{sub}</div>}
      </div>
    </div>
  );
}

/* ── Provider mode segmented buttons ────────────────────────────── */
export function ModeSegment({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="inline-flex gap-1.5 flex-wrap">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`px-3 py-1.5 text-xs rounded-md border font-medium transition-colors ${
              active
                ? "bg-primary text-on-accent border-primary"
                : "border-glass-border bg-surface text-text-secondary hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
