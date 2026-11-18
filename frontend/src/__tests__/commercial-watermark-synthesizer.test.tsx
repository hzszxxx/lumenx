// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  renderWatermarkOnCanvas,
  buildFFmpegWatermarkFilter,
  buildFFmpegWatermarkCommand,
} from "@/lib/watermarkSynthesizer";
import { WatermarkPreviewModal } from "@/components/platform/WatermarkPreviewModal";
import TaskSettings from "@/components/platform/TaskSettings";
import { platformApi, type PlatformTask } from "@/lib/platformApi";

vi.mock("@/lib/platformApi", () => ({
  platformApi: {
    tasks: vi.fn(),
    claimTask: vi.fn(),
    deliverTask: vi.fn(),
    reviewTask: vi.fn(),
    getTaskContract: vi.fn(),
    createTask: vi.fn(),
  },
}));

const mockUser = { id: "creator-uuid-888", username: "top_director", role: "creator" };
vi.mock("@/store/platformStore", () => ({
  usePlatformStore: () => ({
    user: mockUser,
    walletCents: 500000,
  }),
}));

describe("Commercial Watermark Synthesizer & Preview", () => {
  const dummyTask: PlatformTask = {
    id: "task-watermark-test-1",
    title: "《深空迷航》先导片制作",
    client_name: "华策影视制片组",
    category: "ai_drama",
    demand_type: "ai_drama",
    status: "claimed",
    claimed_by: "creator-uuid-888",
    required_level: "pro",
    bounty_cents: 800000,
    deadline: "2026-12-01",
    brief_markdown: "制作高燃科幻先导片",
    version: 1,
    created_at: "2026-11-18T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(platformApi.tasks).mockResolvedValue([dummyTask]);
  });

  describe("Watermark Synthesizer Unit Tests", () => {
    it("generates valid FFmpeg watermark filter and command", () => {
      const filter = buildFFmpegWatermarkFilter({
        primaryText: "影伴交付审阅样片 · 严禁商用",
        opacity: 0.3,
        digestHash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      });

      expect(filter).toContain("drawtext=text='影伴交付审阅样片 · 严禁商用'");
      expect(filter).toContain("fontcolor=white@0.3");
      expect(filter).toContain("存证: 9f86d081884c");

      const cmd = buildFFmpegWatermarkCommand("source.mp4", "protected.mp4", {
        opacity: 0.25,
      });
      expect(cmd).toContain('ffmpeg -y -i "source.mp4"');
      expect(cmd).toContain('-vf "');
      expect(cmd).toContain('"protected.mp4"');
    });

    it("draws diagonal matrix, center shield and bottom strip on Canvas context", () => {
      const mockCtx: any = {
        save: vi.fn(),
        restore: vi.fn(),
        rotate: vi.fn(),
        strokeText: vi.fn(),
        fillText: vi.fn(),
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
      };

      renderWatermarkOnCanvas(mockCtx, 1280, 720, {
        creatorName: "top_director",
        taskId: "task-watermark-test-1",
        clientName: "华策影视",
        opacity: 0.25,
        digestHash: "9f86d081884c7d65",
      });

      expect(mockCtx.fillText).toHaveBeenCalled();
      expect(mockCtx.strokeText).toHaveBeenCalled();
    });
  });

  describe("WatermarkPreviewModal Component", () => {
    it("renders preview modal with canvas, opacity slider and FFmpeg command snippet", () => {
      const handleClose = vi.fn();
      render(
        <WatermarkPreviewModal
          isOpen={true}
          onClose={handleClose}
          task={dummyTask}
          creatorName="top_director"
        />
      );

      expect(screen.getByText(/商业交付样片 · 动态防盗水印合成预览/)).toBeDefined();
      expect(screen.getByText(/水印半透明度:/)).toBeDefined();
      expect(screen.getByText(/本地硬件加速压制指令（FFmpeg 原生管线）：/)).toBeDefined();

      // Adjust opacity slider
      const slider = screen.getByLabelText("水印透明度滑块");
      fireEvent.change(slider, { target: { value: "35" } });
      expect(screen.getByText("35%")).toBeDefined();

      // Click copy button
      const copyBtn = screen.getByRole("button", { name: /复制命令/ });
      fireEvent.click(copyBtn);

      // Close modal
      const closeBtn = screen.getByRole("button", { name: "确定并返回交付" });
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("TaskSettings Integration with Watermark Preview", () => {
    it("opens WatermarkPreviewModal from delivery drawer", async () => {
      render(<TaskSettings />);

      // Find task card
      expect(await screen.findByText("《深空迷航》先导片制作")).toBeDefined();

      // Expand brief
      const expandBtn = screen.getByText(/结构化需求|查看 Brief 简报/);
      fireEvent.click(expandBtn);

      // Open delivery drawer
      const deliverBtn = screen.getByRole("button", { name: /\+ 提交交付样片/ });
      fireEvent.click(deliverBtn);

      // Click watermark preview trigger
      const previewTriggerBtn = screen.getByText(/预览防盗水印效果与 FFmpeg 压制指令/);
      fireEvent.click(previewTriggerBtn);

      // Modal should appear
      expect(screen.getByText(/商业交付样片 · 动态防盗水印合成预览/)).toBeDefined();

      // Close preview modal
      const confirmBackBtn = screen.getByRole("button", { name: "确定并返回交付" });
      fireEvent.click(confirmBackBtn);

      // Modal disappears and returns to delivery drawer
      await waitFor(() => {
        expect(screen.queryByText(/商业交付样片 · 动态防盗水印合成预览/)).toBeNull();
      });
      expect(screen.getByText("商业任务交付区")).toBeDefined();
    });
  });
});
