// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UserSettings from "@/components/platform/UserSettings";
import { usePlatformStore } from "@/store/platformStore";
import { platformApi } from "@/lib/platformApi";

describe("UserSettings Contact Phone Editing", () => {
  beforeEach(() => {
    usePlatformStore.setState({
      user: {
        id: "test-user-1",
        username: "testcreator",
        email: "test@example.com",
        role: "creator",
      },
      walletCents: 10000,
      loading: false,
      error: null,
    });
  });

  it("displays contact phone and opens modal to update phone", async () => {
    vi.spyOn(platformApi, "tokenUsage").mockResolvedValue({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, records: [] });
    const mockProfile = {
      user_id: "test-user-1",
      username: "testcreator",
      role: "creator",
      agency_type: "individual" as const,
      institution_name: "",
      contact_name: "张三",
      contact_phone: "13800138000",
      discount_rate: 1,
      commission_rate: 0.01,
      status: "active" as const,
      notes: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metrics: {
        total_batches: 0,
        purchased_invites: 0,
        total_invites: 0,
        used_invites: 0,
        remaining_invites: 0,
        total_students: 0,
        total_commissions_cents: 0,
      },
    };

    vi.spyOn(platformApi, "agentProfile").mockResolvedValue(mockProfile);

    const updateSpy = vi.spyOn(platformApi, "updateAgentProfile").mockResolvedValue({
      ...mockProfile,
      contact_phone: "13911112222",
    });

    render(<UserSettings />);

    // Wait for initial profile load
    await waitFor(() => {
      expect(screen.getByText("13800138000")).toBeDefined();
    });

    // Click 修改 button
    const editBtn = screen.getByRole("button", { name: "修改联系电话" });
    fireEvent.click(editBtn);

    // Modal should be visible
    expect(screen.getByRole("heading", { name: "填写与修改联系电话" })).toBeDefined();

    const phoneInput = screen.getByPlaceholderText(/例如：13800000000/);
    fireEvent.change(phoneInput, { target: { value: "13911112222" } });

    const saveBtn = screen.getByRole("button", { name: "保存联系电话" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
        contact_phone: "13911112222",
      }));
    });
  });
});
