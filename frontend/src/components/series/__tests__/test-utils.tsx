import { type ReactElement, type ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { vi } from "vitest";
import { platformApi } from "@/lib/platformApi";
import zhMessages from "../../../../messages/zh.json";

function IntlTestProvider({ children }: { children: ReactNode }) {
    return (
        <NextIntlClientProvider locale="zh" messages={zhMessages} timeZone="Asia/Shanghai">
            {children}
        </NextIntlClientProvider>
    );
}

export function renderWithIntl(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
    window.localStorage.setItem("lumenx_platform_token", "ui-test-platform-session");
    vi.spyOn(platformApi, "me").mockResolvedValue({
        id: "ui-test-user",
        username: "ui-test-user",
        role: "user",
        wallet: { simulated_balance_cents: 0 },
    });
    return render(ui, { wrapper: IntlTestProvider, ...options });
}
