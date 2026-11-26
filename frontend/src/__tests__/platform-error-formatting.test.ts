import { describe, it, expect } from "vitest";
import { formatPlatformError } from "@/lib/platformApi";

describe("formatPlatformError", () => {
  it("formats Pydantic string_too_short errors into friendly Chinese", () => {
    const pydanticErrors = [
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
    ];

    const formatted = formatPlatformError(pydanticErrors);
    expect(formatted).toBe("用户名长度不能少于 2 位字符；密码长度不能少于 12 位字符");
  });

  it("handles stringified JSON error payloads gracefully", () => {
    const rawJsonString = JSON.stringify([
      {
        type: "string_too_short",
        loc: ["body", "username"],
        msg: "String should have at least 2 characters",
        ctx: { min_length: 2 },
      },
    ]);

    const formatted = formatPlatformError(rawJsonString);
    expect(formatted).toBe("用户名长度不能少于 2 位字符");
  });

  it("maps known error codes to Chinese explanations", () => {
    expect(formatPlatformError("invalid_credentials")).toBe("账号或密码错误");
    expect(formatPlatformError("weak_password")).toBe("密码长度至少需要 12 位字符");
    expect(formatPlatformError("user_exists")).toBe("该用户名已被注册，请尝试其他用户名或直接登录");
    expect(formatPlatformError("invite_required")).toBe("需要有效的内测邀请码");
    expect(formatPlatformError("invalid_invite")).toBe("邀请码无效、已过期或已被使用");
  });

  it("handles nested object errors", () => {
    expect(formatPlatformError({ message: "weak_password" })).toBe("密码长度至少需要 12 位字符");
    expect(formatPlatformError({ code: "invalid_credentials" })).toBe("账号或密码错误");
  });

  it("formats email format errors", () => {
    const emailError = [
      {
        type: "value_error.email",
        loc: ["body", "email"],
        msg: "value is not a valid email address",
      },
    ];
    expect(formatPlatformError(emailError)).toBe("请输入有效的电子邮箱格式");
  });
});
