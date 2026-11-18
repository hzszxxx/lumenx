// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaskSettings from '@/components/platform/TaskSettings';
import { platformApi, type PlatformTask } from '@/lib/platformApi';
import { usePlatformStore } from '@/store/platformStore';

vi.mock('@/lib/platformApi', () => ({
  platformApi: {
    tasks: vi.fn(),
    claimTask: vi.fn(),
    deliverTask: vi.fn(),
    reviewTask: vi.fn(),
  },
}));

describe('TaskSettings commercial delivery and client review flow', () => {
  const mockClaimedTask: PlatformTask = {
    id: 'task-delivery-1',
    title: '玄幻短剧前3集高燃分镜制作',
    category: '短剧分镜',
    brief_markdown: '### 需求说明\n- 交付前3集分镜与初剪样片\n- 必须带影伴审阅防盗水印',
    bounty_cents: 350000,
    required_level: 'standard',
    deadline: '2026-12-01T00:00:00Z',
    status: 'claimed',
    version: 1,
    created_at: '2026-11-01T00:00:00Z',
    claimed_by: 'creator-me',
    demand_type: 'ai_drama',
    deliverable_specs_json: JSON.stringify({ format: '9:16', resolution: '1080P', fps: 30 }),
    settlement_mode: 'milestone',
    level_tier: 'standard',
    client_name: '华策影业',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    usePlatformStore.setState({
      user: {
        id: 'creator-me',
        username: 'test_creator',
        role: 'admin', // 具有审核权限
        email: 'creator@yingban.ai',
      },
    });
  });

  it('allows creator to expand delivery drawer and submit watermarked preview', async () => {
    vi.mocked(platformApi.tasks).mockResolvedValue([mockClaimedTask]);
    vi.mocked(platformApi.deliverTask).mockResolvedValue({
      id: 'delivery-1',
      task_id: 'task-delivery-1',
      version_num: 1,
      status: 'delivered',
    });

    render(<TaskSettings />);

    // 展开需求简报
    await waitFor(() => {
      expect(screen.getByText('玄幻短剧前3集高燃分镜制作')).toBeDefined();
    });
    const expandBtn = screen.getByRole('button', { name: /结构化需求/ });
    fireEvent.click(expandBtn);

    // 点击 "+ 提交交付样片" 展开交付表单
    const submitDrawerBtn = await screen.findByRole('button', { name: /\+ 提交交付样片/ });
    fireEvent.click(submitDrawerBtn);

    // 验证防盗水印确认项默认勾选
    expect(screen.getByText(/已为初剪样片嵌入【影伴交付审阅样片 · 严禁商用】半透明防盗水印/)).toBeDefined();

    // 点击提交
    const confirmDeliverBtn = screen.getByRole('button', { name: /确认提交交付审核/ });
    fireEvent.click(confirmDeliverBtn);

    await waitFor(() => {
      expect(platformApi.deliverTask).toHaveBeenCalledWith(
        'task-delivery-1',
        expect.objectContaining({
          product: 'atelier',
          artifact_version: 'v1.0.0',
          media_type: 'video/mp4',
        })
      );
    });
  });

  it('allows admin / client to review and approve delivered task', async () => {
    const deliveredTask: PlatformTask = {
      ...mockClaimedTask,
      status: 'delivered',
    };
    vi.mocked(platformApi.tasks).mockResolvedValue([deliveredTask]);
    vi.mocked(platformApi.reviewTask).mockResolvedValue({
      task_id: 'task-delivery-1',
      status: 'settled',
      feedback: '验收合格',
    });

    render(<TaskSettings />);

    await waitFor(() => {
      expect(screen.getByText('玄幻短剧前3集高燃分镜制作')).toBeDefined();
    });

    // 展开详情
    fireEvent.click(screen.getByRole('button', { name: /结构化需求/ }));

    // 需求方终审验收台呈现
    expect(await screen.findByText(/需求方终审验收台/)).toBeDefined();

    // 点击终审通过并全额放款
    const approveBtn = screen.getByRole('button', { name: /终审通过并全额放款/ });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(platformApi.reviewTask).toHaveBeenCalledWith('task-delivery-1', {
        approved: true,
        feedback: expect.any(String),
      });
    });
  });
});
