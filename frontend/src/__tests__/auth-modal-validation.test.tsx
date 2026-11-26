// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AuthModal from "@/components/auth/AuthModal";
import { usePlatformStore } from "@/store/platformStore";

describe("AuthModal Validation & Error Display", () => {
  beforeEach(() => {
    usePlatformStore.setState({
      user: null,
      error: null,
      loading: false,
    });
  });

  it("validates username length >= 2 on registration submit", async () => {
    render(<AuthModal isOpen={true} onClose={vi.fn()} />);

    // Switch to register mode
    const registerBtn = screen.getByRole("button", { name: "免费注册" });
    fireEvent.click(registerBtn);

    // Input 1-character username and 12-char password
    const usernameInput = screen.getByPlaceholderText(/至少 2 个字符/);
    const passwordInput = screen.getByPlaceholderText(/至少 12 位字符/);

    fireEvent.change(usernameInput, { target: { value: "a" } });
    fireEvent.change(passwordInput, { target: { value: "validpassword123" } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: "立即注册并登录" });
    const form = submitBtn.closest("form")!;
    fireEvent.submit(form);

    expect(screen.getByRole("alert")).toHaveTextContent("用户名长度不能少于 2 位字符");
  });

  it("validates password length >= 12 on registration submit", async () => {
    render(<AuthModal isOpen={true} onClose={vi.fn()} />);

    // Switch to register mode
    const registerBtn = screen.getByRole("button", { name: "免费注册" });
    fireEvent.click(registerBtn);

    // Input 2-character Chinese username and 8-character password
    const usernameInput = screen.getByPlaceholderText(/至少 2 个字符/);
    const passwordInput = screen.getByPlaceholderText(/至少 12 位字符/);

    fireEvent.change(usernameInput, { target: { value: "大鹏" } });
    fireEvent.change(passwordInput, { target: { value: "13572468" } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: "立即注册并登录" });
    const form = submitBtn.closest("form")!;
    fireEvent.submit(form);

    expect(screen.getByRole("alert")).toHaveTextContent("密码长度不能少于 12 位字符");
  });

  it("formats backend raw JSON error string into user-friendly message without leaking raw JSON", () => {
    const rawJsonError = JSON.stringify([
      {
        type: "string_too_short",
        loc: ["body", "username"],
        msg: "String should have at least 2 characters",
        ctx: { min_length: 2 },
      },
      {
        type: "string_too_short",
        loc: ["body", "password"],
        msg: "String should have at least 12 characters",
        ctx: { min_length: 12 },
      },
    ]);

    usePlatformStore.setState({ error: rawJsonError });

    render(<AuthModal isOpen={true} onClose={vi.fn()} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("用户名长度不能少于 2 位字符；密码长度不能少于 12 位字符");
    expect(alert.textContent).not.toContain("string_too_short");
    expect(alert.textContent).not.toContain("[{");
  });

  it("enforces invite code requirement when registration_invite_required is true", async () => {
    const { platformApi } = await import("@/lib/platformApi");
    vi.spyOn(platformApi, "authConfig").mockResolvedValueOnce({ registration_invite_required: true });

    render(<AuthModal isOpen={true} onClose={vi.fn()} />);

    // Switch to register mode
    const registerBtn = screen.getByRole("button", { name: "免费注册" });
    fireEvent.click(registerBtn);

    // Fill valid username and password, but leave invite code empty
    const usernameInput = screen.getByPlaceholderText(/至少 2 个字符/);
    const passwordInput = screen.getByPlaceholderText(/至少 12 位字符/);

    fireEvent.change(usernameInput, { target: { value: "李四" } });
    fireEvent.change(passwordInput, { target: { value: "validpassword123" } });

    // Wait for authConfig resolution
    await vi.waitFor(() => {
      expect(screen.getByText("（必填）")).toBeDefined();
    });

    const submitBtn = screen.getByRole("button", { name: "立即注册并登录" });
    const form = submitBtn.closest("form")!;
    fireEvent.submit(form);

    expect(screen.getByRole("alert")).toHaveTextContent("当前平台开放注册需要有效的内测邀请码");
  });
});
