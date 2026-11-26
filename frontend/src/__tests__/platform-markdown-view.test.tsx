// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import PlatformMarkdownView from "@/components/platform/PlatformMarkdownView";

describe("PlatformMarkdownView", () => {
  it("renders heading and numbered lists from escaped markdown text", () => {
    const rawMarkdown = "### 参赛规则\\n1. 影片时长 60-180 秒，需使用平台 Atelier 画布或 Studio 管线制作。\\n2. 具备完整叙事逻辑与多镜头景别组接。\\n3. 原创作品，严禁洗稿抄袭。";

    const { container } = render(<PlatformMarkdownView content={rawMarkdown} />);

    // Heading rendered without raw ###
    expect(screen.getByText("参赛规则")).toBeDefined();
    expect(container.textContent).not.toContain("###");
    expect(container.textContent).not.toContain("\\n");

    // List items rendered
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText(/影片时长 60-180 秒/)).toBeDefined();
    expect(screen.getByText(/具备完整叙事逻辑/)).toBeDefined();
  });

  it("renders bold text and bullet points properly", () => {
    const markdown = "### 重点要求\n- 必须带**影伴**审阅水印\n- **严禁商用**";
    render(<PlatformMarkdownView content={markdown} />);

    expect(screen.getByText("重点要求")).toBeDefined();
    expect(screen.getByText("影伴")).toBeDefined();
    expect(screen.getByText("严禁商用")).toBeDefined();
  });
});
