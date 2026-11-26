"use client";

import { useState } from "react";
import {
  X,
  FileText,
  Image as ImageIcon,
  Video,
  Copy,
  Check,
  Download,
  Sparkles,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { publicAssetPath } from "@/lib/publicAsset";

interface TestAssetsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_SCRIPT = `# 《雨夜黎明》短剧分镜剧本（测试验收样例）

## 角色表
1. 陆云风：二十八岁，身着黑色修身风衣，神色冷峻，眼神深邃锐利。
2. 薇拉：二十五岁，干练的短发赛博探员，佩戴单侧全息护目镜，银白色战术制服。

## 场景表
1. 雨夜十字路口：霓虹倒影在湿滑的路面上，雨丝穿透泛蓝的探照灯光。
2. 秘密避难所：昏暗的地下防空洞，中央有一台闪烁的量子终端。

## 正文分镜

【镜头 1】
景别：特写
画面：暴雨如注，雨水顺着黑色帽檐不断滴落。陆云风抬起头，眼神如鹰隼般扫视前方。
对白（陆云风）：“他们已经追上来了，时间只剩最后三分钟。”

【镜头 2】
景别：全景
画面：远处两辆闪烁红蓝警戒灯的悬浮车急刹在路口，数名全副武装的追捕者跃下车门，激光瞄准线瞬间割裂黑夜。
音效：刺耳的刹车轰鸣与急促脚步声。

【镜头 3】
景别：中景
画面：薇拉从阴影中猛然跃出，手中的电磁脉冲发生器瞬间释放出环形冲击波，将正前方的全息围栏彻底瓦解。
对白（薇拉）：“走这边！量子终端的密匙在我手里！”`;

export default function TestAssetsModal({ isOpen, onClose }: TestAssetsModalProps) {
  const [activeTab, setActiveTab] = useState<"script" | "media" | "guide">("media");
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2500);
  };

  const videoUrl = publicAssetPath("/sample-assets/sample_preview.mp4");
  const characterUrl = publicAssetPath("/sample-assets/sample_character.png");
  const sceneUrl = publicAssetPath("/sample-assets/sample_scene.png");

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border border-glass-border bg-surface p-6 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-glass-border pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">功能验收测试素材箱</h3>
              <p className="text-xs text-text-secondary mt-0.5">
                为全平台功能验收提供标准样片、测试角色图及分镜剧本
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-foreground hover:bg-hover-bg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-2 mt-4 pb-2 border-b border-glass-border shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("media")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "media"
                ? "bg-primary text-white shadow-xs"
                : "text-text-secondary hover:text-foreground hover:bg-hover-bg"
            }`}
          >
            <Video size={13} />
            样片与图像素材
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("script")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "script"
                ? "bg-primary text-white shadow-xs"
                : "text-text-secondary hover:text-foreground hover:bg-hover-bg"
            }`}
          >
            <FileText size={13} />
            标准分镜剧本
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("guide")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "guide"
                ? "bg-primary text-white shadow-xs"
                : "text-text-secondary hover:text-foreground hover:bg-hover-bg"
            }`}
          >
            <HelpCircle size={13} />
            验收对照清单
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {activeTab === "media" && (
            <div className="space-y-4">
              {/* Sample Video */}
              <div className="p-4 rounded-xl border border-glass-border bg-surface-inset/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video size={16} className="text-primary" />
                    <div>
                      <h4 className="text-xs font-bold text-foreground">影视短剧测试样片 (MP4)</h4>
                      <p className="text-[11px] text-text-muted">适用于：商业任务样片交付、赛事作品提交、考核认证作品</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(videoUrl, "video-url")}
                      className="glass-button text-xs py-1 px-2.5 flex items-center gap-1"
                    >
                      {copied === "video-url" ? <Check size={12} className="text-status-success-fg" /> : <Copy size={12} />}
                      {copied === "video-url" ? "已复制链接" : "复制链接"}
                    </button>
                    <a
                      href={videoUrl}
                      download="lumenx-sample-preview.mp4"
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-hover transition flex items-center gap-1 shadow-xs"
                    >
                      <Download size={12} />
                      下载 MP4
                    </a>
                  </div>
                </div>

                <div className="rounded-xl overflow-hidden border border-glass-border bg-black max-h-48 flex items-center justify-center">
                  <video
                    src={videoUrl}
                    controls
                    className="max-h-48 w-auto mx-auto object-contain"
                  />
                </div>
              </div>

              {/* Sample Images */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-glass-border bg-surface-inset/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <ImageIcon size={14} className="text-primary" /> 角色参考图 (PNG)
                    </span>
                    <a
                      href={characterUrl}
                      download="sample-character.png"
                      className="text-xs text-primary hover:underline flex items-center gap-0.5"
                    >
                      <Download size={12} /> 下载
                    </a>
                  </div>
                  <div className="h-32 rounded-lg bg-surface/80 border border-glass-border/50 flex items-center justify-center overflow-hidden">
                    <img src={characterUrl} alt="角色图" className="h-28 object-contain" />
                  </div>
                  <p className="text-[11px] text-text-muted">用于 Studio 角色三视图、一致性锁脸与头像定调</p>
                </div>

                <div className="p-4 rounded-xl border border-glass-border bg-surface-inset/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <ImageIcon size={14} className="text-primary" /> 场景风格图 (PNG)
                    </span>
                    <a
                      href={sceneUrl}
                      download="sample-scene.png"
                      className="text-xs text-primary hover:underline flex items-center gap-0.5"
                    >
                      <Download size={12} /> 下载
                    </a>
                  </div>
                  <div className="h-32 rounded-lg bg-surface/80 border border-glass-border/50 flex items-center justify-center overflow-hidden">
                    <img src={sceneUrl} alt="场景图" className="h-28 object-contain" />
                  </div>
                  <p className="text-[11px] text-text-muted">用于 Studio/Atelier 场景氛围烘托与 I2V 参考</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "script" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-secondary">
                  点击右侧按钮复制标准剧本，可直接用于【剧本分析】或【Atelier 画布生成】：
                </p>
                <button
                  type="button"
                  onClick={() => handleCopy(SAMPLE_SCRIPT, "script")}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-hover transition flex items-center gap-1 shadow-sm shrink-0"
                >
                  {copied === "script" ? <Check size={13} /> : <Copy size={13} />}
                  {copied === "script" ? "已复制全文" : "复制剧本全文"}
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-surface-inset border border-glass-border text-xs text-text-secondary leading-relaxed font-mono whitespace-pre-wrap max-h-80 overflow-y-auto">
                {SAMPLE_SCRIPT}
              </pre>
            </div>
          )}

          {activeTab === "guide" && (
            <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
              <div className="p-3.5 rounded-xl bg-surface-inset border border-glass-border space-y-2">
                <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-primary/20 text-primary flex items-center justify-center text-[11px] font-bold">1</span>
                  注册与登录页验收对照
                </h4>
                <p>• 用户名支持 2 字中文名（如“大鹏”、“张三”）。</p>
                <p>• 密码长度需不少于 12 位字符；若未达标展示规范中文提示，严禁回传明文密码。</p>
                <p>• 内测阶段邀请码标记为【必填】，与后台校验规则完全一致。</p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-inset border border-glass-border space-y-2">
                <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-primary/20 text-primary flex items-center justify-center text-[11px] font-bold">2</span>
                  赛事活动规则验收对照
                </h4>
                <p>• 展开赛事规则卡片，Markdown 标题（###）、换行转义及条目编号均已自动排版为结构化卡片，呈现规整视听指南。</p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-inset border border-glass-border space-y-2">
                <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-primary/20 text-primary flex items-center justify-center text-[11px] font-bold">3</span>
                  联系电话填写与修改验收对照
                </h4>
                <p>• 在【个人中心】与【渠道代理】页面均提供“修改联系电话”入口与点击设置按钮。</p>
                <p>• 弹窗填写手机号后点击保存，本地与服务端即时更新，不再出现无法修改的“未设置”状态。</p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-inset border border-glass-border space-y-2">
                <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md bg-primary/20 text-primary flex items-center justify-center text-[11px] font-bold">4</span>
                  商业任务与考核交付验收对照
                </h4>
                <p>• 任务市场接单后，在“商业任务交付区”可点击【一键填入验收测试样片】并提交交付；在创作者认证考核区可一键填入测试作品。</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-glass-border flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-hover-bg border border-glass-border text-foreground transition"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
