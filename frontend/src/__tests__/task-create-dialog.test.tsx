// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaskCreateDialog from '@/components/platform/TaskCreateDialog';
import { platformApi, type PlatformTask } from '@/lib/platformApi';

vi.mock('@/lib/platformApi', () => ({
  platformApi: {
    createTask: vi.fn(),
  },
}));

describe('TaskCreateDialog commercial demand publishing', () => {
  const mockCreatedTask: PlatformTask = {
    id: 'new-task-1',
    title: '修仙短剧 · 前三集高燃分镜编排与出片',
    category: '短剧分镜',
    brief_markdown: '### 需求背景与剧情说明',
    bounty_cents: 350000,
    required_level: 'standard',
    deadline: '2026-12-15T00:00:00Z',
    status: 'published',
    version: 0,
    created_at: '2026-11-18T00:00:00Z',
    demand_type: 'ai_drama',
    deliverable_specs_json: JSON.stringify({ format: '9:16', resolution: '1080P', fps: 30 }),
    settlement_mode: 'milestone',
    level_tier: 'standard',
    client_name: '华策影视制片组',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal, supports template prefill, and submits structured task to platformApi.createTask', async () => {
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();
    vi.mocked(platformApi.createTask).mockResolvedValue(mockCreatedTask);

    render(<TaskCreateDialog isOpen={true} onClose={handleClose} onSuccess={handleSuccess} />);

    // 1. 验证标题和光厂需求大厅标识
    expect(screen.getByText(/光厂需求大厅 · 发包模式/)).toBeDefined();
    expect(screen.getByText('发布商业需求单')).toBeDefined();

    // 2. 点击套用快速模板
    const templateBtn = screen.getByRole('button', { name: /\+ 玄幻短剧分镜模板/ });
    fireEvent.click(templateBtn);

    // 3. 校验自动预填字段
    expect(screen.getByDisplayValue('修仙短剧 · 前三集高燃分镜编排与出片')).toBeDefined();
    expect(screen.getByDisplayValue('华策影视制片组')).toBeDefined();

    // 4. 点击立即托管赏金并发布
    const submitBtn = screen.getByRole('button', { name: /立即托管赏金并发布/ });
    fireEvent.click(submitBtn);

    // 5. 校验接口调用与回调
    await waitFor(() => {
      expect(platformApi.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '修仙短剧 · 前三集高燃分镜编排与出片',
          client_name: '华策影视制片组',
          demand_type: 'ai_drama',
          bounty_cents: 350000,
          status: 'published',
          settlement_mode: 'milestone',
        })
      );
      expect(handleSuccess).toHaveBeenCalledWith(mockCreatedTask);
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
