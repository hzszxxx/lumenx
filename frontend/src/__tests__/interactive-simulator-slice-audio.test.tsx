// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InteractiveSimulatorModal } from "@/components/atelier/v3/InteractiveSimulatorModal";
import {
  resolveNodeMediaSlice,
  interactiveMediaPreloadPool,
} from "@/lib/interactiveDrama";
import { interactiveSoundEngine } from "@/lib/interactiveAudio";
import type { AtelierNode } from "@/lib/atelierTypes";

describe("Interactive Simulator Slice Cache & Sound Effects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    interactiveMediaPreloadPool.clear();
    interactiveSoundEngine.setMuted(false);
  });

  describe("resolveNodeMediaSlice and Preload Cache", () => {
    it("correctly identifies video and image slices", () => {
      const videoNode: AtelierNode = {
        id: "node-v1",
        type: "video",
        title: "分支A视频切片",
        media_urls: ["https://example.com/slice_a.mp4"],
        data: {},
      };
      const sliceV = resolveNodeMediaSlice(videoNode);
      expect(sliceV.kind).toBe("video");
      expect(sliceV.url).toBe("https://example.com/slice_a.mp4");

      const imageNode: AtelierNode = {
        id: "node-i1",
        type: "image",
        title: "分支B剧照切片",
        media_urls: ["https://example.com/slice_b.png"],
        data: {},
      };
      const sliceI = resolveNodeMediaSlice(imageNode);
      expect(sliceI.kind).toBe("image");
      expect(sliceI.url).toBe("https://example.com/slice_b.png");

      const textNode: AtelierNode = {
        id: "node-t1",
        type: "idea",
        title: "纯文本节点",
        data: {},
      };
      const sliceT = resolveNodeMediaSlice(textNode);
      expect(sliceT.kind).toBe("none");
      expect(sliceT.url).toBeNull();
    });

    it("preloads media slices into cache pool and tracks stats", () => {
      interactiveMediaPreloadPool.preloadSlice("https://example.com/slice_a.mp4", true);
      interactiveMediaPreloadPool.preloadSlice("https://example.com/slice_b.png", false);

      expect(interactiveMediaPreloadPool.isPreloaded("https://example.com/slice_a.mp4")).toBe(true);
      expect(interactiveMediaPreloadPool.isPreloaded("https://example.com/slice_b.png")).toBe(true);
      expect(interactiveMediaPreloadPool.isPreloaded("https://example.com/not_exist.png")).toBe(false);

      const stats = interactiveMediaPreloadPool.getCacheStats();
      expect(stats.count).toBe(2);

      interactiveMediaPreloadPool.clear();
      expect(interactiveMediaPreloadPool.getCacheStats().count).toBe(0);
    });
  });

  describe("InteractiveSoundEngine synthesizer", () => {
    it("handles play methods without crashing even when audio context is unavailable", () => {
      expect(() => {
        interactiveSoundEngine.playCountdownTick(false);
        interactiveSoundEngine.playCountdownTick(true);
        interactiveSoundEngine.playChoiceSelected();
        interactiveSoundEngine.playEndingSuccess(false);
        interactiveSoundEngine.playEndingSuccess(true);
        interactiveSoundEngine.playEndingDefeat();
      }).not.toThrow();
    });

    it("toggles mute properly", () => {
      interactiveSoundEngine.setMuted(true);
      expect(interactiveSoundEngine.getMuted()).toBe(true);
      interactiveSoundEngine.setMuted(false);
      expect(interactiveSoundEngine.getMuted()).toBe(false);
    });
  });

  describe("InteractiveSimulatorModal component", () => {
    const mockNodes: AtelierNode[] = [
      {
        id: "start-node",
        type: "video",
        title: "开端：雨夜旧宅",
        prompt: "雷声大作，你站在公馆大门前...",
        media_urls: ["https://example.com/start_video.mp4"],
        data: {
          interactive: {
            isEnding: false,
            choices: [
              {
                id: "c-1",
                label: "选项A：强行推门调查",
                targetNodeId: "investigate-node",
                timeoutSeconds: 8,
              },
              {
                id: "c-2",
                label: "选项B：绕行后花园",
                targetNodeId: "garden-bad-end",
                timeoutSeconds: 8,
              },
            ],
          },
        },
      },
      {
        id: "investigate-node",
        type: "image",
        title: "大堂：神秘日记",
        prompt: "你进入大堂，壁炉火光摇曳，桌上放着一本染血的日记...",
        media_urls: ["https://example.com/hall_art.jpg"],
        data: {
          interactive: {
            isEnding: false,
            choices: [
              {
                id: "c-3",
                label: "选项A：翻开日记通关",
                targetNodeId: "victory-end",
                timeoutSeconds: 5,
              },
            ],
          },
        },
      },
      {
        id: "garden-bad-end",
        type: "video",
        title: "后花园陷阱（挫败结局）",
        prompt: "花丛中突然涌出机械守卫将你围困，行动失败！",
        media_urls: ["https://example.com/defeat.mp4"],
        data: {
          interactive: {
            isEnding: true,
            endingType: "bad",
          },
        },
      },
      {
        id: "victory-end",
        type: "image",
        title: "揭开公馆秘密（终极通关）",
        prompt: "日记揭示了公馆主人的遗嘱，你成功破译了全部线索！",
        media_urls: ["https://example.com/victory.png"],
        data: {
          interactive: {
            isEnding: true,
            endingType: "normal",
          },
        },
      },
    ];

    it("renders video element, preloads candidate slice and shows countdown", () => {
      const handleClose = vi.fn();
      render(
        <InteractiveSimulatorModal
          isOpen={true}
          onClose={handleClose}
          nodes={mockNodes}
          taskTitle="《迷雾公馆》先导试玩"
        />
      );

      // Verify title & video slice
      expect(screen.getByText(/互动影游 · 决策模拟试玩器/)).toBeDefined();
      expect(screen.getByText(/当前播放镜头：开端：雨夜旧宅/)).toBeDefined();
      expect(screen.getByText(/选项A：强行推门调查/)).toBeDefined();
      expect(screen.getByText(/选项B：绕行后花园/)).toBeDefined();

      // Candidate slices should be preloaded into pool
      expect(interactiveMediaPreloadPool.isPreloaded("https://example.com/hall_art.jpg")).toBe(true);
      expect(interactiveMediaPreloadPool.isPreloaded("https://example.com/defeat.mp4")).toBe(true);

      // Verify cache badge
      expect(screen.getByText(/分支切片缓存：/)).toBeDefined();
    });

    it("allows user to choose branch, advances story, and reaches normal ending", () => {
      render(
        <InteractiveSimulatorModal
          isOpen={true}
          onClose={vi.fn()}
          nodes={mockNodes}
        />
      );

      // Choose Option A -> Go to investigate-node
      const choiceA = screen.getByText(/强行推门调查/);
      fireEvent.click(choiceA);

      // Now at hall node
      expect(screen.getByText(/当前播放镜头：大堂：神秘日记/)).toBeDefined();
      expect(screen.getByText(/选项A：翻开日记通关/)).toBeDefined();

      // Choose Option A again -> Go to victory-end
      const choiceFinal = screen.getByText(/翻开日记通关/);
      fireEvent.click(choiceFinal);

      // Ending reached
      expect(screen.getByText(/🏆 正常通关结局达成/)).toBeDefined();
      expect(screen.getByText(/恭喜！已通关此剧情分支/)).toBeDefined();
      expect(screen.getByText("重新探索其他结局")).toBeDefined();
    });

    it("supports stepping back and reaching bad end", () => {
      render(
        <InteractiveSimulatorModal
          isOpen={true}
          onClose={vi.fn()}
          nodes={mockNodes}
        />
      );

      // Choose Option B -> Garden Bad End
      const choiceB = screen.getByText(/绕行后花园/);
      fireEvent.click(choiceB);

      expect(screen.getByText(/💀 挫败结局达成/)).toBeDefined();

      // Step back
      const stepBackBtn = screen.getByText("撤销上一步");
      fireEvent.click(stepBackBtn);

      // Back to start node
      expect(screen.getByText(/当前播放镜头：开端：雨夜旧宅/)).toBeDefined();
    });

    it("allows toggling mute sound effects button", () => {
      render(
        <InteractiveSimulatorModal
          isOpen={true}
          onClose={vi.fn()}
          nodes={mockNodes}
        />
      );

      const muteBtn = screen.getByLabelText("静音");
      fireEvent.click(muteBtn);
      expect(interactiveSoundEngine.getMuted()).toBe(true);

      const unmuteBtn = screen.getByLabelText("取消静音");
      fireEvent.click(unmuteBtn);
      expect(interactiveSoundEngine.getMuted()).toBe(false);
    });
  });
});
