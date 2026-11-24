// @vitest-environment happy-dom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '@/components/settings/SettingsPage';
import { api, type EnvConfigPayload } from '@/lib/api';
import { activateRuntimeEnvironment } from '@/lib/runtimeEnvironment';
import { toast } from '@/store/toastStore';
import { renderWithIntl } from '@/components/series/__tests__/test-utils';

vi.mock('@/store/toastStore', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/api', async importOriginal => {
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

async function renderApiKeys(initial: EnvConfigPayload = { DASHSCOPE_API_KEY: 'sk-test-key-12345' }) {
  vi.mocked(api.getEnvConfig).mockResolvedValueOnce(initial);
  const rendered = renderWithIntl(<SettingsPage />);
  fireEvent.click(await screen.findByRole('tab', { name: /API|密钥/ }));
  await waitFor(() => expect(screen.getByRole('button', { name: '保存配置' })).toBeEnabled());
  return rendered;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getEnvConfig).mockReset();
  vi.mocked(api.testApiKey).mockReset();
  activateRuntimeEnvironment({ schema_version: 1, storage_id: STORAGE_KEY });
});

describe('SettingsPage API Key Testing', () => {
  it('renders the test button next to DashScope key field', async () => {
    await renderApiKeys();
    expect(screen.getByRole('button', { name: '测试有效性' })).toBeInTheDocument();
  });

  it('calls api.testApiKey and displays success message and latency', async () => {
    vi.mocked(api.testApiKey).mockResolvedValueOnce({
      success: true,
      message: '连接成功！通义千问模型 (qwen-plus) 响应正常',
      latency_ms: 350,
    });

    await renderApiKeys();
    const testBtn = screen.getByRole('button', { name: '测试有效性' });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(api.testApiKey).toHaveBeenCalledWith({
        provider: 'dashscope',
        api_key: 'sk-test-key-12345',
        base_url: undefined,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('连接成功！通义千问模型 (qwen-plus) 响应正常')).toBeInTheDocument();
      expect(screen.getByText('350ms')).toBeInTheDocument();
      expect(toast.success).toHaveBeenCalledWith('连接成功！通义千问模型 (qwen-plus) 响应正常');
    });
  });

  it('displays failure diagnostics and calls toast.error when key test fails', async () => {
    vi.mocked(api.testApiKey).mockResolvedValueOnce({
      success: false,
      message: '密钥认证失败 (401 Unauthorized)：请检查 API Key 是否完整正确。',
    });

    await renderApiKeys();
    const testBtn = screen.getByRole('button', { name: '测试有效性' });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(screen.getByText('密钥认证失败 (401 Unauthorized)：请检查 API Key 是否完整正确。')).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('clears test result when key is edited', async () => {
    vi.mocked(api.testApiKey).mockResolvedValueOnce({
      success: true,
      message: '连接成功！通义千问模型 (qwen-plus) 响应正常',
      latency_ms: 200,
    });

    await renderApiKeys();
    const testBtn = screen.getByRole('button', { name: '测试有效性' });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(screen.getByText('连接成功！通义千问模型 (qwen-plus) 响应正常')).toBeInTheDocument();
    });

    // Type new key into the input
    const input = screen.getByPlaceholderText('sk-...');
    fireEvent.change(input, { target: { value: 'sk-new-different-key' } });

    await waitFor(() => {
      expect(screen.queryByText('连接成功！通义千问模型 (qwen-plus) 响应正常')).not.toBeInTheDocument();
    });
  });
});
