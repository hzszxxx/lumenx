"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sparkles,
    X,
    Loader2,
    RotateCcw,
    Check,
    Copy,
    Wand2,
    BookOpen,
    Layers,
    MessageSquareQuote,
    Clapperboard,
    Video,
    SlidersHorizontal,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { toast } from "@/store/toastStore";

export interface RewriteSkill {
    id: string;
    name: string;
    tag: string;
    description: string;
    icon: typeof Wand2;
    prompt: string;
}

export const PRESET_REWRITE_SKILLS: RewriteSkill[] = [
    {
        id: "short_drama_scene",
        name: "短剧分场与视听化（推荐）",
        tag: "规范短剧",
        description: "按短剧规范分场（场景/时间/人物），动作节拍与台词交替，抽象描写转常见视听动作。",
        icon: Clapperboard,
        prompt: `请将输入的剧本文本重构为规范的短剧剧本：
1. 结构划分：严格按场次划分（统一标注：第X场 [场景名称] [时间/光线] [出场人物]）。
2. 节拍流排布：动作节拍与台词行严格交替，每场至少包含一个明确动作节拍，绝不写纯对白广播剧。
3. 视听动作转化：坚决杜绝散文心理描写与抽象修辞，只写摄像机能拍到的具体、常见动作（如坐下、递东西、猛然回头、起身对峙等）。
4. 台词规范：台词口语化、单句短小有力（单句≤35字，一口气能说完），带出说话人情绪或括号标注潜台词语气。
5. 整体节奏紧凑，便于下游 AI 镜头切分与音色合成。`,
    },
    {
        id: "dramatic_conflict",
        name: "快节奏冲突与钩子强化",
        tag: "高能反转",
        description: "黄金三秒冷开局，压缩寒暄废话，强化戏剧冲突、反转与结尾悬念钩子。",
        icon: Sparkles,
        prompt: `请强化剧本的戏剧张力与快节奏冲突：
1. 黄金开局：第1拍立即进入核心矛盾或危机情境（冷开场），前3秒必须带出具体行动与抓人悬念。
2. 节奏紧凑：删去平淡寒暄、无关过渡，加快对立人物之间的语言与动作交锋。
3. 爽点与情绪：突出身份反差、情绪拉扯或剧情反转，让每一个情节递进都有明确的情感落点。
4. 结尾钩子：每段结尾务必留下悬念或未解事件，形成强烈的追更钩子。`,
    },
    {
        id: "dialogue_refine",
        name: "对白精简与角色口语化",
        tag: "真实口语",
        description: "去书面腔与文艺病，谁的话像谁，增强潜台词，单句一口气说完，适合 TTS 演绎。",
        icon: MessageSquareQuote,
        prompt: `请对剧本中的台词与对白进行深度润色：
1. 彻底剔除书面腔、翻译腔和文学化修辞，改用真实、接地气、利落的生活口语。
2. 谁的话像谁：符合人物的年龄、身份与性格特征，市井、严肃、冷酷各具其声。
3. 潜台词与留白：不把所有心思说破，通过简短语言和语气标注表现角色的真实动机。
4. 单句精简，适合语音合成播报（单句尽量控制在 20-30 字内）。`,
    },
    {
        id: "visual_ambience",
        name: "光影氛围与细节扩写",
        tag: "电影质感",
        description: "丰富场景环境、色调光影、空间构图与现场声景，增强大片质感与画面感。",
        icon: Layers,
        prompt: `请丰富剧本的环境细节与视听质感：
1. 增加清晰的场景光影（如逆光、暗沉阴雨、斑驳霓虹、晨曦丁达尔）与主色调氛围。
2. 增加生动的现场声景与环境音（如雨打窗棂、嘈杂鸣笛、时钟滴答、风吹树叶）。
3. 细化关键人物的特写神态、视线方向与肢体微动作，为分镜画面生成提供生动的构图依据。`,
    },
    {
        id: "vlog_first_person",
        name: "短视频探店/第一人称口播",
        tag: "探店口播",
        description: "以第一人称口吻叙述，快节奏网感、幽默吐槽，适合短视频探店或自媒体解说。",
        icon: Video,
        prompt: `请将剧本改写为高网感的第一人称短视频探店/体验风格：
1. 视角转换：以第一人称（“我”/主播/特定角色如“一只猫”）的生动口吻叙述。
2. 抓人开场：前三秒抛出好奇心疑问或感官冲击点。
3. 过程生动：动作与体验并重，穿插幽默吐槽、细节特写与真实情绪反应。
4. 互动结尾：留下讨论话题或引导互动。`,
    },
    {
        id: "custom",
        name: "自定义改写指令",
        tag: "自由定制",
        description: "由您自由输入专属的改写指令与提示词，AI 将完全按照您的要求改写。",
        icon: SlidersHorizontal,
        prompt: `请对剧本进行智能改写：
[请在此输入您的具体改写要求，例如风格偏好、角色调整、情节增删等]`,
    },
];

interface ScriptRewriteModalProps {
    isOpen: boolean;
    scriptText: string;
    projectId: string;
    onClose: () => void;
    onApply: (rewrittenText: string) => void;
}

export default function ScriptRewriteModal({
    isOpen,
    scriptText,
    projectId,
    onClose,
    onApply,
}: ScriptRewriteModalProps) {
    const t = useTranslations("script");
    const [selectedSkillId, setSelectedSkillId] = useState<string>(PRESET_REWRITE_SKILLS[0].id);
    const [editedPrompt, setEditedPrompt] = useState<string>(PRESET_REWRITE_SKILLS[0].prompt);
    const [isRewriting, setIsRewriting] = useState(false);
    const [rewrittenText, setRewrittenText] = useState<string>("");
    const [copied, setCopied] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // 当切换选中的 Skill 时，自动将 Skill 提示词载入可编辑文本框
    const handleSelectSkill = (skill: RewriteSkill) => {
        setSelectedSkillId(skill.id);
        setEditedPrompt(skill.prompt);
        setErrorMsg(null);
    };

    // 恢复当前选中 Skill 的默认 Prompt
    const handleResetPrompt = () => {
        const found = PRESET_REWRITE_SKILLS.find((s) => s.id === selectedSkillId);
        if (found) {
            setEditedPrompt(found.prompt);
            toast.info(t("resetSkillPrompt") || "已恢复默认指令");
        }
    };

    // 执行 AI 改写
    const handleStartRewrite = async () => {
        if (!scriptText || !scriptText.trim()) {
            toast.error(t("noScriptForRewrite") || "剧本内容为空，请先输入剧本后再进行智能改写");
            return;
        }
        if (!editedPrompt || !editedPrompt.trim()) {
            toast.error("改写 Skill 指令不能为空");
            return;
        }

        setIsRewriting(true);
        setErrorMsg(null);
        try {
            const res = await api.rewriteScript(projectId, scriptText, editedPrompt);
            if (res && res.rewritten_text) {
                setRewrittenText(res.rewritten_text);
                toast.success("AI 改写完成！请在下方预览并采纳");
            } else {
                throw new Error("返回改写内容为空");
            }
        } catch (err: any) {
            let msg = err?.response?.data?.detail || err?.message || t("rewriteFailed") || "改写失败，请重试";
            if (typeof msg === "string") {
                if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("ECONNABORTED") || msg.includes("ETIMEDOUT")) {
                    msg = "请求超时或网络中断，请检查网络或刷新页面后重试";
                } else if (msg.includes("Runtime environment is not active") || msg.includes("runtime_environment_unavailable")) {
                    msg = "服务连接已更新，请刷新网页后重新改写";
                }
            }
            setErrorMsg(String(msg));
            toast.error(String(msg));
        } finally {
            setIsRewriting(false);
        }
    };

    // 复制改写后文本
    const handleCopy = async () => {
        if (!rewrittenText) return;
        try {
            await navigator.clipboard.writeText(rewrittenText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.info(t("copied") || "已复制到剪贴板");
        } catch {
            toast.error("复制失败");
        }
    };

    // 采纳并替换
    const handleApply = () => {
        if (!rewrittenText) return;
        onApply(rewrittenText);
        toast.success(t("appliedSuccess") || "改写内容已采纳并更新至剧本");
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] grid place-items-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.96, opacity: 0, y: 8 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.96, opacity: 0, y: 8 }}
                    transition={{ duration: 0.2 }}
                    className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-glass-border bg-surface shadow-2xl overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-glass-border px-6 py-4 bg-surface-elevated/40">
                        <div className="flex items-center gap-3">
                            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary border border-primary/25">
                                <Sparkles size={18} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-semibold text-text-primary">
                                        {t("rewriteScript") || "剧本智能改写"}
                                    </h2>
                                    <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[0.7rem] font-medium text-primary">
                                        AI Skill
                                    </span>
                                </div>
                                <p className="text-xs text-text-muted mt-0.5">
                                    {t("rewriteModalSubtitle") ||
                                        "选择改写 Skill 或自定义指令，由 AI 为剧本优化叙事结构、视听动作与对白"}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary focus-visible:outline-none"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Content Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Section 1: Skill Selection */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                                    <BookOpen size={13} className="text-primary" />
                                    <span>{t("selectSkill") || "选择改写 Skill"}</span>
                                </label>
                                <span className="text-[0.75rem] text-text-muted">
                                    原稿字数：{scriptText?.length || 0} 字
                                </span>
                            </div>

                            {/* Skills Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {PRESET_REWRITE_SKILLS.map((skill) => {
                                    const Icon = skill.icon;
                                    const isSelected = selectedSkillId === skill.id;
                                    return (
                                        <button
                                            key={skill.id}
                                            type="button"
                                            onClick={() => handleSelectSkill(skill)}
                                            className={`group text-left p-3 rounded-xl border transition-all duration-fast ${
                                                isSelected
                                                    ? "bg-primary/15 border-primary shadow-[0_0_12px_rgba(var(--primary-rgb),0.15)] ring-1 ring-primary/40"
                                                    : "bg-surface-elevated/40 border-glass-border hover:bg-surface-elevated hover:border-glass-border-hover"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-1.5 font-medium text-xs text-text-primary">
                                                    <Icon
                                                        size={14}
                                                        className={isSelected ? "text-primary" : "text-text-muted group-hover:text-primary"}
                                                    />
                                                    <span>{skill.name}</span>
                                                </div>
                                                <span
                                                    className={`text-[0.65rem] px-1.5 py-0.5 rounded font-mono ${
                                                        isSelected
                                                            ? "bg-primary text-white"
                                                            : "bg-white/5 text-text-muted border border-glass-border"
                                                    }`}
                                                >
                                                    {skill.tag}
                                                </span>
                                            </div>
                                            <p className="text-[0.75rem] text-text-muted line-clamp-2 leading-relaxed">
                                                {skill.description}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Section 2: Editable Skill Prompt */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                                    <SlidersHorizontal size={13} className="text-primary" />
                                    <span>{t("editSkillPrompt") || "Skill 提示词与指令（可自由编辑调整）"}</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={handleResetPrompt}
                                    className="inline-flex items-center gap-1 text-[0.75rem] text-text-muted hover:text-text-primary transition-colors"
                                >
                                    <RotateCcw size={12} />
                                    <span>{t("resetSkillPrompt") || "恢复默认指令"}</span>
                                </button>
                            </div>
                            <div className="relative rounded-xl border border-glass-border bg-black/25 focus-within:border-primary/60 transition-colors">
                                <textarea
                                    value={editedPrompt}
                                    onChange={(e) => setEditedPrompt(e.target.value)}
                                    placeholder="输入改写具体要求..."
                                    rows={5}
                                    className="w-full bg-transparent p-3 text-xs font-mono text-text-secondary leading-relaxed resize-y focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Error Message */}
                        {errorMsg && (
                            <div className="p-3 rounded-xl bg-status-failed/10 border border-status-failed/30 text-xs text-status-failed-fg">
                                {errorMsg}
                            </div>
                        )}

                        {/* Section 3: Rewritten Result (if available) */}
                        {rewrittenText && (
                            <div className="space-y-2 pt-2 border-t border-glass-border">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                                            {t("rewrittenScript") || "改写后剧本"}
                                        </span>
                                        <span className="rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-[0.7rem] text-emerald-400 font-mono">
                                            {scriptText?.length || 0} 字 → {rewrittenText.length} 字
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleCopy}
                                        className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
                                    >
                                        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                        <span>{copied ? t("copied") || "已复制" : t("copyRewritten") || "复制文本"}</span>
                                    </button>
                                </div>
                                <div className="max-h-64 overflow-y-auto p-4 rounded-xl border border-glass-border bg-black/35 text-text-primary text-xs font-mono leading-relaxed whitespace-pre-wrap">
                                    {rewrittenText}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between border-t border-glass-border px-6 py-4 bg-surface-elevated/40">
                        <div className="text-xs text-text-muted">
                            {isRewriting ? (
                                <span className="inline-flex items-center gap-2 text-primary font-medium">
                                    <Loader2 size={13} className="animate-spin" />
                                    {t("rewriting") || "AI 正在智能改写中..."}
                                </span>
                            ) : rewrittenText ? (
                                <span>核对满意后，点击右侧按钮直接替换当前剧本正文</span>
                            ) : (
                                <span>准备就绪，点击右侧「改写」开始</span>
                            )}
                        </div>

                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isRewriting}
                                className="rounded-full border border-glass-border bg-transparent px-4 py-2 text-xs font-medium text-text-secondary hover:bg-white/5 hover:text-text-primary transition-colors"
                            >
                                取消
                            </button>

                            {/* Rewrite Button */}
                            <button
                                type="button"
                                aria-label="start-rewrite"
                                onClick={handleStartRewrite}
                                disabled={isRewriting || !scriptText?.trim() || !editedPrompt?.trim()}
                                className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/20 px-4 py-2 text-xs font-semibold text-primary shadow-[0_0_12px_rgba(var(--primary-rgb),0.12)] hover:bg-primary/30 hover:border-primary/60 transition-all disabled:opacity-50"
                            >
                                {isRewriting ? (
                                    <Loader2 size={13} className="animate-spin" />
                                ) : (
                                    <Wand2 size={13} />
                                )}
                                <span>{isRewriting ? t("rewriting") || "改写中..." : t("startRewrite") || "改写"}</span>
                            </button>

                            {/* Apply Button */}
                            {rewrittenText && (
                                <button
                                    type="button"
                                    onClick={handleApply}
                                    disabled={isRewriting}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-on-accent shadow-[var(--btn-pri-glow)] hover:bg-primary-hover transition-all"
                                >
                                    <Check size={13} />
                                    <span>{t("applyToScript") || "采纳并替换剧本"}</span>
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
