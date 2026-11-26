// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TestAssetsModal from "@/components/platform/TestAssetsModal";

describe("TestAssetsModal", () => {
  it("renders sample video and images", () => {
    render(<TestAssetsModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText("功能验收测试素材箱")).toBeDefined();
    expect(screen.getByText("影视短剧测试样片 (MP4)")).toBeDefined();
    expect(screen.getByText(/角色参考图/)).toBeDefined();
    expect(screen.getByText(/场景风格图/)).toBeDefined();
  });

  it("switches to script tab and allows copying", () => {
    render(<TestAssetsModal isOpen={true} onClose={vi.fn()} />);

    const scriptTab = screen.getByRole("button", { name: /标准分镜剧本/ });
    fireEvent.click(scriptTab);

    expect(screen.getByText(/《雨夜黎明》短剧分镜剧本/)).toBeDefined();
    expect(screen.getByRole("button", { name: /复制剧本全文/ })).toBeDefined();
  });

  it("switches to guide tab and shows acceptance checkpoints", () => {
    render(<TestAssetsModal isOpen={true} onClose={vi.fn()} />);

    const guideTab = screen.getByRole("button", { name: /验收对照清单/ });
    fireEvent.click(guideTab);

    expect(screen.getByText(/注册与登录页验收对照/)).toBeDefined();
    expect(screen.getByText(/赛事活动规则验收对照/)).toBeDefined();
    expect(screen.getByText(/联系电话填写与修改验收对照/)).toBeDefined();
    expect(screen.getByText(/商业任务与考核交付验收对照/)).toBeDefined();
  });
});
