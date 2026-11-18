// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import TaskCreateDialog from "@/components/platform/TaskCreateDialog";
import { InteractiveSimulatorModal } from "@/components/atelier/v3/InteractiveSimulatorModal";
import { InteractiveBranchConfig } from "@/components/atelier/v3/InteractiveBranchConfig";
import { IdeaNode } from "@/components/atelier/v3/IdeaNode";
import { MediaNode } from "@/components/atelier/v3/MediaNode";
import {
  buildCanvasInteractiveLinks,
  computeBranchBezierPath,
  getInteractiveBranchData,
} from "@/lib/interactiveDrama";
import { platformApi } from "@/lib/platformApi";
import type { AtelierNode } from "@/lib/atelierTypes";

vi.mock("@/lib/platformApi", () => ({
  platformApi: {
    createTask: vi.fn(),
  },
}));

const messages = {
  atelier: {
    node: {
      expand: "展开",
      collapse: "收起",
      chars: "字",
      charsLong: "字（长文）",
      ideaStamp: "灵感",
      videoWord: "视频",
      noTakeYet: "暂无成片",
      typeVideo: "视频",
    },
  },
  common: {
    close: "Close",
    recommended: "推荐",
  },
  workspace: {
    newSeries: "新建剧集",
    seriesTitle: "剧集名称",
    seriesTitlePlaceholder: "输入剧集名称...",
    description: "剧集简介",
    descriptionPlaceholder: "简介...",
    createSeries: "创建剧集",
    creating: "创建中...",
    toastProjectsSyncFailed: "同步失败",
  },
  project: {
    productionMode: "制作形态",
    productionLinear: "🎬 普通线性短剧",
    productionLinearDesc: "单线时序分镜流",
    productionInteractive: "🎮 互动短剧 / 影游",
    productionInteractiveDesc: "网状决策树、多分支与多结局",
    workflowMode: "工作流模式",
    workflowR2V: "精简工作流",
    workflowR2VDesc: "5步流程",
    workflowI2V: "传统工作流",
    workflowI2VDesc: "9步流程",
    contentMode: "内容模式",
    contentScripted: "我有剧本",
    contentScriptedDesc: "导入剧本",
    contentFreeform: "我直接创作",
    contentFreeformDesc: "直接创作",
    visualControlPref: "视觉控制偏好",
    visualControlR2V: "节奏优先",
    visualControlR2VDesc: "节奏优先",
    visualControlI2V: "画面优先",
    visualControlI2VDesc: "画面优先",
  },
};

describe("Interactive Drama Separation & Simulator", () => {
  it("TaskCreateDialog supports publishing an interactive drama task with structured specifications", async () => {
    vi.mocked(platformApi.createTask).mockResolvedValueOnce({
      id: "task-interactive-1",
      title: "悬疑解谜互动微影游《迷雾公馆》首章",
      category: "互动影游",
      demand_type: "interactive_game",
      status: "published",
      bounty_cents: 780000,
      deadline: new Date().toISOString(),
      required_level: "pro",
      brief_markdown: "分支需求",
      version: 1,
      created_at: new Date().toISOString(),
    });

    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(
      <NextIntlClientProvider locale="zh" messages={messages}>
        <TaskCreateDialog isOpen={true} onClose={handleClose} onSuccess={handleSuccess} />
      </NextIntlClientProvider>
    );

    // 模板快捷点击
    const tmplBtn = screen.getByText("+ 互动微影游/多结局短剧模板");
    fireEvent.click(tmplBtn);

    // 验证赛道切换为互动影游提示
    expect(screen.getByText(/🎮 互动影游专属需求约定/)).toBeDefined();

    // 提交需求单
    const submitBtn = screen.getByRole("button", { name: /立即托管赏金并发布/ });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(platformApi.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          demand_type: "interactive_game",
          category: "互动影游",
          deliverable_specs_json: expect.stringContaining('"interactive_mode":true'),
        })
      );
      expect(handleSuccess).toHaveBeenCalled();
    });
  });

  it("InteractiveSimulatorModal renders decision branches, navigates choices, and reaches endings", () => {
    const mockNodes = [
      {
        id: "node-1",
        type: "idea",
        title: "起始镜头：雨夜旧宅",
        prompt: "主角在封闭公馆中苏醒，门锁已锁死。",
        x: 100,
        y: 100,
        width: 300,
        height: 180,
      },
      {
        id: "node-2",
        type: "idea",
        title: "分支A：点燃火柴搜寻暗格",
        prompt: "顺着暗格发现密室暗道，无声潜入。",
        x: 450,
        y: 50,
        width: 300,
        height: 180,
      },
      {
        id: "node-3",
        type: "idea",
        title: "结局1：智取逃生 (Normal End)",
        prompt: "穿过暗室通道从废弃花园翻出公馆，成功生还。",
        x: 800,
        y: 50,
        width: 300,
        height: 180,
      },
    ] as unknown as AtelierNode[];

    const handleClose = vi.fn();

    render(
      <InteractiveSimulatorModal
        isOpen={true}
        onClose={handleClose}
        nodes={mockNodes}
        taskTitle="迷雾公馆互动剧"
      />
    );

    // 初始渲染应该显示起始镜头
    expect(screen.getByText(/当前播放镜头：起始镜头：雨夜旧宅/)).toBeDefined();
    expect(screen.getByText(/请玩家做出选择/)).toBeDefined();

    // 应该显示分支选项
    const choiceBtn = screen.getByText("分支A：点燃火柴搜寻暗格");
    expect(choiceBtn).toBeDefined();

    // 模拟玩家选择分支 A
    fireEvent.click(choiceBtn);

    // 应该切换到分支 A 镜头
    expect(screen.getByText(/当前播放镜头：分支A：点燃火柴搜寻暗格/)).toBeDefined();

    // 继续选择结局 1
    const endingBtn = screen.getByText("结局1：智取逃生 (Normal End)");
    fireEvent.click(endingBtn);

    // 应该显示通关结局
    expect(screen.getByText(/恭喜！已通关此剧情分支/)).toBeDefined();
  });

  it("InteractiveBranchConfig configures node branch choices and triggers downstream branch creation", () => {
    const currentNode = {
      id: "node-1",
      type: "idea",
      title: "起始镜头：雨夜旧宅",
      prompt: "主角在封闭公馆中苏醒",
      x: 100,
      y: 100,
      width: 300,
      height: 180,
    } as unknown as AtelierNode;

    const allNodes = [
      currentNode,
      {
        id: "node-2",
        type: "idea",
        title: "分支A：点燃火柴搜寻暗格",
        prompt: "",
        x: 450,
        y: 50,
        width: 300,
        height: 180,
      } as unknown as AtelierNode,
    ];

    const handleUpdatePrompt = vi.fn();
    const handleOpenSimulator = vi.fn();
    const handleCreateBranchNode = vi.fn();

    render(
      <InteractiveBranchConfig
        node={currentNode}
        nodes={allNodes}
        onUpdateNodePrompt={handleUpdatePrompt}
        onOpenSimulator={handleOpenSimulator}
        onCreateBranchNode={handleCreateBranchNode}
      />
    );

    expect(screen.getByText("互动影游 · 决策分支配置")).toBeDefined();
    expect(screen.getByText("分支决策点")).toBeDefined();

    // 切换到结局收敛点
    const endingBtn = screen.getByText("结局收敛点");
    fireEvent.click(endingBtn);
    expect(screen.getByText("结局类型设定")).toBeDefined();

    // 切换回分支决策点
    const branchBtn = screen.getByText("分支决策点");
    fireEvent.click(branchBtn);

    // 输入新分支并生成
    const input = screen.getByPlaceholderText("例如: 分支镜头：破门逃跑");
    fireEvent.change(input, { target: { value: "分支B：强行撞门" } });
    const createBtn = screen.getByRole("button", { name: /生成/ });
    fireEvent.click(createBtn);

    expect(handleCreateBranchNode).toHaveBeenCalledWith("分支B：强行撞门");
  });

  it("buildCanvasInteractiveLinks builds links from node interactive data and computeBranchBezierPath generates SVG curve", () => {
    const nodes = [
      {
        id: "source-1",
        type: "video",
        title: "大厅抉择",
        prompt: "面对两条路",
        x: 100,
        y: 100,
        width: 320,
        height: 180,
        data: {
          interactive: {
            isEnding: false,
            choices: [
              { id: "c1", label: "左转去密室", targetNodeId: "target-1" },
              { id: "c2", label: "右转上二楼", targetNodeId: "target-2" },
            ],
          },
        },
      } as unknown as AtelierNode,
      {
        id: "target-1",
        type: "idea",
        title: "密室分镜",
        x: 500,
        y: 60,
        width: 320,
        height: 180,
      } as unknown as AtelierNode,
      {
        id: "target-2",
        type: "idea",
        title: "二楼分镜",
        x: 500,
        y: 280,
        width: 320,
        height: 180,
      } as unknown as AtelierNode,
    ];

    const links = buildCanvasInteractiveLinks(nodes);
    expect(links).toHaveLength(2);
    expect(links[0].fromNode.id).toBe("source-1");
    expect(links[0].toNode.id).toBe("target-1");
    expect(links[0].choiceLabel).toBe("左转去密室");
    expect(links[1].toNode.id).toBe("target-2");

    const path = computeBranchBezierPath(100, 100, 500, 60);
    expect(path).toContain("M 100 100 C");
  });

  it("IdeaNode and MediaNode trigger onAddNextStep when add button is clicked", () => {
    const handleAddNextIdea = vi.fn();
    const handleAddNextMedia = vi.fn();

    const { rerender } = render(
      <NextIntlClientProvider locale="zh" messages={messages}>
        <IdeaNode
          id="idea-test"
          body="测试灵感节点"
          x={100}
          y={100}
          onAddNextStep={handleAddNextIdea}
        />
      </NextIntlClientProvider>
    );

    const ideaAddBtn = screen.getByLabelText("添加下一步任务");
    expect(ideaAddBtn).toBeDefined();
    fireEvent.click(ideaAddBtn);
    expect(handleAddNextIdea).toHaveBeenCalledWith("idea-test");

    rerender(
      <NextIntlClientProvider locale="zh" messages={messages}>
        <MediaNode
          id="media-test"
          kind="video"
          status="completed"
          x={100}
          y={100}
          onAddNextStep={handleAddNextMedia}
        />
      </NextIntlClientProvider>
    );

    const mediaAddBtn = screen.getByLabelText("添加下一步任务");
    expect(mediaAddBtn).toBeDefined();
    fireEvent.click(mediaAddBtn);
    expect(handleAddNextMedia).toHaveBeenCalledWith("media-test");
  });
});
