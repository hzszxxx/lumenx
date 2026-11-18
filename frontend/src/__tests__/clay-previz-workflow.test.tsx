// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { MediaNode } from "@/components/atelier/v3/MediaNode";
import ClayWipeCompareModal from "@/components/atelier/v3/ClayWipeCompareModal";
import StoryboardBatchImportModal from "@/components/atelier/v3/StoryboardBatchImportModal";
import { CLAY_STYLE_PRESETS } from "@/components/atelier/v3/AtelierShell";

describe("Clay Previz & Comparison Workflow", () => {
  it("renders ClayWipeCompareModal and switches comparison modes", () => {
    const handleClose = vi.fn();
    const { rerender } = render(
      <ClayWipeCompareModal
        open={true}
        onClose={handleClose}
        renderUrl="https://example.com/render.mp4"
        renderKind="video"
        clayUrl="https://example.com/clay.jpg"
        clayKind="image"
        title="测试白模成片比对"
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("测试白模成片比对")).toBeInTheDocument();
    expect(screen.getByText("卷帘对比 (Wipe)")).toBeInTheDocument();

    // Switch to side-by-side mode
    const sideBySideBtn = screen.getByRole("button", { name: /左右并排/i });
    fireEvent.click(sideBySideBtn);
    expect(screen.getByText("3D 白模底模 (Previz / Clay)")).toBeInTheDocument();
    expect(screen.getByText("AI 真实成片 (Rendered Shot)")).toBeInTheDocument();

    // Switch to onion skin mode
    const onionBtn = screen.getByRole("button", { name: /叠化透视/i });
    fireEvent.click(onionBtn);
    expect(screen.getByText(/白模叠化透明度/i)).toBeInTheDocument();

    // Click close
    const closeBtn = screen.getByRole("button", { name: /关闭/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Escape closes modal
    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(2);

    // Modal when open=false renders nothing
    rerender(
      <ClayWipeCompareModal
        open={false}
        onClose={handleClose}
        renderUrl="https://example.com/render.mp4"
        clayUrl="https://example.com/clay.jpg"
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("parses CSV and triggers onImportShots in StoryboardBatchImportModal", async () => {
    const handleImport = vi.fn();
    const handleClose = vi.fn();

    render(
      <StoryboardBatchImportModal
        open={true}
        onClose={handleClose}
        onImportShots={handleImport}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/白模分镜表批量导入/i)).toBeInTheDocument();

    // The default template contains 4 sample shots
    expect(screen.getByText("SHOT-01")).toBeInTheDocument();
    expect(screen.getByText("神殿走廊远景")).toBeInTheDocument();
    expect(screen.getByText("SHOT-02")).toBeInTheDocument();
    expect(screen.getByText("主角拔剑特写")).toBeInTheDocument();

    // Trigger submit
    const submitBtn = screen.getByRole("button", { name: /一键批量生成 4 个分镜节点/i });
    fireEvent.click(submitBtn);

    expect(handleImport).toHaveBeenCalledTimes(1);
    const importedShots = handleImport.mock.calls[0][0];
    expect(importedShots).toHaveLength(4);
    expect(importedShots[0].shotId).toBe("SHOT-01");
    expect(importedShots[0].title).toBe("神殿走廊远景");
    expect(importedShots[0].durationSec).toBe(6);
  });

  it("validates CLAY_STYLE_PRESETS definitions and prompt snippets", () => {
    expect(CLAY_STYLE_PRESETS.length).toBeGreaterThanOrEqual(5);

    const ue5 = CLAY_STYLE_PRESETS.find(p => p.id === "ue5_scifi");
    expect(ue5).toBeDefined();
    expect(ue5?.promptSnippet).toContain("Unreal Engine 5");

    const film = CLAY_STYLE_PRESETS.find(p => p.id === "panavision_35mm");
    expect(film).toBeDefined();
    expect(film?.promptSnippet).toContain("Panavision");

    const xianxia = CLAY_STYLE_PRESETS.find(p => p.id === "oriental_xianxia");
    expect(xianxia).toBeDefined();
    expect(xianxia?.promptSnippet).toContain("仙侠");
  });

  it("renders wipe compare button on completed MediaNode and calls onWipeCompare", () => {
    const handleWipe = vi.fn();
    render(
      <NextIntlClientProvider
        locale="zh"
        messages={{
          atelier: {
            node: {
              videoWord: "视频",
              imageWord: "图片",
              finalResult: "最终结果",
              selectedPill: "已选成片",
              addNextStep: "衍生下游分镜",
            },
          },
        }}
      >
        <MediaNode
          id="node-v1"
          kind="video"
          status="completed"
          src="https://example.com/shot.mp4"
          x={100}
          y={100}
          onWipeCompare={handleWipe}
        />
      </NextIntlClientProvider>
    );

    const compareBtn = screen.getByTitle("开启白模与成片卷帘对比 (Wipe View)");
    expect(compareBtn).toBeInTheDocument();
    fireEvent.click(compareBtn);
    expect(handleWipe).toHaveBeenCalledWith("node-v1");
  });

  it("resolves renderUrl and clayUrl correctly across node and upstream relationships", async () => {
    const { resolveNodeRenderAndClay } = await import("@/components/atelier/v3/AtelierShell");

    const clayNode = {
      id: "node-clay-1",
      project_id: "p1",
      type: "image",
      title: "SHOT-01 3D白模底图",
      prompt: "3D blockout",
      status: "completed",
      x: 100,
      y: 0,
      width: 260,
      height: 180,
      source_project_id: null,
      frame_id: null,
      asset_id: null,
      video_task_id: null,
      media_urls: ["https://example.com/clay_3d.jpg"],
      data: {},
      created_by: "user-1",
      created_at: 1000,
      updated_at: 1000,
    };

    const videoNode = {
      id: "node-video-1",
      project_id: "p1",
      type: "video",
      title: "SHOT-01 成片渲染",
      prompt: "cinematic shot",
      status: "completed",
      x: 100,
      y: 200,
      width: 260,
      height: 180,
      source_project_id: null,
      frame_id: null,
      asset_id: null,
      video_task_id: null,
      media_urls: ["https://example.com/render_final.mp4"],
      data: {
        reference_node_ids: ["node-clay-1"],
      },
      created_by: "user-1",
      created_at: 1000,
      updated_at: 1000,
    };

    const res = resolveNodeRenderAndClay(videoNode, [clayNode, videoNode]);
    expect(res.renderUrl).toBe("https://example.com/render_final.mp4");
    expect(res.clayUrl).toBe("https://example.com/clay_3d.jpg");
  });
});
