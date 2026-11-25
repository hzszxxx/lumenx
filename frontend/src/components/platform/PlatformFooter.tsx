"use client";

import { ShieldCheck, Sparkles, Film, GraduationCap, Trophy, BriefcaseBusiness, Cpu, FileCheck, Layers, ChevronRight, Lock } from "lucide-react";
import LumenXBranding from "@/components/layout/LumenXBranding";

export default function PlatformFooter() {
  const navigateTo = (hash: string) => {
    window.location.hash = hash;
  };

  return (
    <footer className="mt-16 border-t border-glass-border/70 bg-surface/40 backdrop-blur-xl pt-12 pb-10 text-text-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Top bar: Brand + Value Proposition Banner */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-8 border-b border-glass-border/50">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <LumenXBranding size="sm" />
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                工业级 AIGC 影视生产中枢
              </span>
            </div>
            <p className="text-xs text-text-secondary max-w-xl leading-relaxed">
              影伴（YingBan）融合先进大模型生成与电影导演工业化流水线，为创作者、品牌方与影视短剧团队提供标准化需求分发、全额资金托管与版权可信存证服务。
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => navigateTo("#/atelier")}
              className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all shadow-md flex items-center gap-1.5"
            >
              <Sparkles size={13} />
              进入 Atelier 画布创作
            </button>
            <button
              type="button"
              onClick={() => navigateTo("#/platform?section=certification")}
              className="glass-button text-xs font-medium flex items-center gap-1.5"
            >
              <ShieldCheck size={13} className="text-primary" />
              申请导演级认证
            </button>
          </div>
        </div>

        {/* 4-Columns Navigation & Ecosystem Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-xs">
          {/* Col 1: 平台生态 */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <BriefcaseBusiness size={14} className="text-primary" /> 平台生态
            </h4>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo("#/tasks")}
                  className="hover:text-primary transition-colors flex items-center gap-1"
                >
                  <ChevronRight size={11} className="text-text-muted" /> 商业任务市场
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo("#/academy")}
                  className="hover:text-primary transition-colors flex items-center gap-1"
                >
                  <ChevronRight size={11} className="text-text-muted" /> 创作者培训学院
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo("#/competitions")}
                  className="hover:text-primary transition-colors flex items-center gap-1"
                >
                  <ChevronRight size={11} className="text-text-muted" /> 赛事与挑战赛
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo("#/certification")}
                  className="hover:text-primary transition-colors flex items-center gap-1"
                >
                  <ChevronRight size={11} className="text-text-muted" /> 创作者专业认证
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo("#/platform?section=agent")}
                  className="hover:text-primary transition-colors flex items-center gap-1"
                >
                  <ChevronRight size={11} className="text-text-muted" /> 渠道代理与分销
                </button>
              </li>
            </ul>
          </div>

          {/* Col 2: 创作系统 */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={14} className="text-emerald-400" /> 创作与管线
            </h4>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo("#/atelier")}
                  className="hover:text-primary transition-colors flex items-center gap-1"
                >
                  <ChevronRight size={11} className="text-text-muted" /> Atelier 无限节点画布
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo("#/studio")}
                  className="hover:text-primary transition-colors flex items-center gap-1"
                >
                  <ChevronRight size={11} className="text-text-muted" /> Studio 漫剧流水线
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo("#/platform?section=skills")}
                  className="hover:text-primary transition-colors flex items-center gap-1"
                >
                  <ChevronRight size={11} className="text-text-muted" /> 视频技能扩展包 (Skill)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo("#/academy")}
                  className="hover:text-primary transition-colors flex items-center gap-1"
                >
                  <ChevronRight size={11} className="text-text-muted" /> 官方高分工程模板
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigateTo("#/platform?section=compute")}
                  className="hover:text-primary transition-colors flex items-center gap-1 font-medium text-foreground/90"
                >
                  <ChevronRight size={11} className="text-primary" /> 算力与凭证 / API-Key 对接
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: 交易安全与存证 */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FileCheck size={14} className="text-blue-400" /> 交易与合规保障
            </h4>
            <ul className="space-y-2">
              <li className="flex items-center gap-1.5 text-text-secondary">
                <Lock size={12} className="text-emerald-400" /> 平台全额资金第三方托管
              </li>
              <li className="flex items-center gap-1.5 text-text-secondary">
                <FileCheck size={12} className="text-emerald-400" /> 电子 NDA 商业承揽协议
              </li>
              <li className="flex items-center gap-1.5 text-text-secondary">
                <ShieldCheck size={12} className="text-emerald-400" /> 交付样片数字水印防盗
              </li>
              <li className="flex items-center gap-1.5 text-text-secondary">
                <CheckCircleIcon /> 终审放款自动授权证书
              </li>
              <li className="flex items-center gap-1.5 text-text-secondary">
                <ClockIcon /> 48小时超时自动托管保护
              </li>
            </ul>
          </div>

          {/* Col 4: 基础引擎与算力 */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Cpu size={14} className="text-amber-400" /> 基础设施与模型
            </h4>
            <ul className="space-y-2">
              <li className="flex items-center gap-1.5 text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> 阿里云 Wan 2.6 电影级视频
              </li>
              <li className="flex items-center gap-1.5 text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> 通义千问 Qwen 2.5 剧本智能体
              </li>
              <li className="flex items-center gap-1.5 text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> 快手可灵 Kling 1.5 / 2.0
              </li>
              <li className="flex items-center gap-1.5 text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> 阿里 CosyVoice 角色音色克隆
              </li>
              <li className="flex items-center gap-1.5 text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> 仙宫云 H3 GPU 分布式算力池
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Compliance */}
        <div className="pt-8 border-t border-glass-border/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-[0.6875rem] text-text-muted">
          <div>
            © 2026 YingBan (影伴) & LumenX Studio. All rights reserved.
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <span>工业级 AIGC 影视生产管线</span>
            <span>·</span>
            <span>官方担保交易</span>
            <span>·</span>
            <span>电子签署与存证</span>
            <span>·</span>
            <span className="font-mono">v0.2.6-enterprise</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-3 h-3 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-3 h-3 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l3 3" />
    </svg>
  );
}
