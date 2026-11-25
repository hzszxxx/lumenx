// @vitest-environment happy-dom
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApiKeySettings from '@/components/platform/ApiKeySettings';
import SettingsPage from '@/components/settings/SettingsPage';
import { api, type EnvConfigPayload } from '@/lib/api';
import { activateRuntimeEnvironment } from '@/lib/runtimeEnvironment';
import { renderWithIntl } from '@/components/series/__tests__/test-utils';

vi.mock('@/store/toastStore', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getEnvConfig: vi.fn(),
      saveEnvConfig: vi.fn(),
      testApiKey: vi.fn(),
      fetchPromptDefaults: vi.fn(),
      healthCheck: vi.fn(),
    },
  };
});

const STORAGE_KEY = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getEnvConfig).mockReset();
  vi.mocked(api.saveEnvConfig).mockReset();
  activateRuntimeEnvironment({ schema_version: 1, storage_id: STORAGE_KEY });
});

describe('MiniMax API Key Settings', () => {
  it('renders MiniMax card and allows input in ApiKeySettings', async () => {
    const initialConfig: EnvConfigPayload = {
      DASHSCOPE_API_KEY: 'sk-dash-123',
      MINIMAX_API_KEY: '',
      secrets_configured: {
        MINIMAX_API_KEY: false,
      },
    };
    vi.mocked(api.getEnvConfig).mockResolvedValueOnce(initialConfig);
    vi.mocked(api.saveEnvConfig).mockResolvedValueOnce({
      ...initialConfig,
      MINIMAX_API_KEY: 'minimax-secret-key-xyz',
    });

    render(<ApiKeySettings />);

    await waitFor(() => {
      expect(screen.getByText('MiniMax 开放平台 · 图像大模型')).toBeInTheDocument();
    });

    const minimaxInput = screen.getByPlaceholderText(/如: sk-cp-/);
    expect(minimaxInput).toBeInTheDocument();

    fireEvent.change(minimaxInput, { target: { value: 'minimax-secret-key-xyz' } });

    const submitBtn = screen.getByRole('button', { name: /保存大模型 API-Key 配置/ });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.saveEnvConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          MINIMAX_API_KEY: 'minimax-secret-key-xyz',
        })
      );
    });
  });

  it('renders MiniMax section in SettingsPage API tab', async () => {
    const initialConfig: EnvConfigPayload = {
      DASHSCOPE_API_KEY: 'sk-test',
      MINIMAX_API_KEY: 'mm-existing-key',
    };
    vi.mocked(api.getEnvConfig).mockResolvedValue(initialConfig);

    renderWithIntl(<SettingsPage />);
    fireEvent.click(await screen.findByRole('tab', { name: /API|密钥/ }));

    await waitFor(() => expect(screen.getByRole('button', { name: '保存配置' })).toBeEnabled());
    expect(screen.getByText('MiniMax 开放平台')).toBeInTheDocument();
    expect(screen.getByText(/H3-Image 旗舰图像大模型/)).toBeInTheDocument();

    // Verify MiniMax model setting buttons in API Keys tab
    expect(screen.getByText('MiniMax 生图模型设置')).toBeInTheDocument();
    const h3Button = screen.getByRole('button', { name: /MiniMax H3-Image/ });
    expect(h3Button).toBeInTheDocument();
    fireEvent.click(h3Button);
    expect(screen.getByText(/当前已启用为全局默认生图模型/)).toBeInTheDocument();

    // Verify test key button for MiniMax
    vi.mocked(api.testApiKey).mockResolvedValueOnce({
      success: true,
      message: '连接成功！MiniMax 开放平台响应正常',
      latency_ms: 120,
    });
    const testButtons = screen.getAllByRole('button', { name: /测试有效性/ });
    expect(testButtons.length).toBeGreaterThanOrEqual(2);
    // Click the MiniMax test button (the second one)
    fireEvent.click(testButtons[1]);
    await waitFor(() => {
      expect(api.testApiKey).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'minimax',
          api_key: 'mm-existing-key',
        })
      );
    });
  });
});
