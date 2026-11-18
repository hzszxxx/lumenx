// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaskSettings from '@/components/platform/TaskSettings';
import { platformApi, type PlatformTask } from '@/lib/platformApi';

vi.mock('@/lib/platformApi', () => ({
  platformApi: {
    tasks: vi.fn(),
    claimTask: vi.fn(),
  },
}));

vi.mock('@/store/platformStore', () => ({
  usePlatformStore: () => ({
    user: { id: 'user-creator-1', role: 'creator', username: 'test_creator' },
  }),
}));

const mockTasks: PlatformTask[] = [
  {
    id: 'task-1',
    title: '玄幻修仙爆款短剧',
    category: '短剧分镜',
    brief_markdown: '### 需求说明\n头部小说 IP 改编短剧',
    bounty_cents: 350000,
    required_level: 'standard',
    deadline: '2026-11-24',
    status: 'published',
    version: 0,
    created_at: '2026-11-18T00:00:00Z',
  },
];

describe('TaskSettings commercial task claim workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(platformApi.tasks).mockResolvedValue(mockTasks);
    vi.mocked(platformApi.claimTask).mockResolvedValue({ task_id: 'task-1', status: 'claimed' });
  });

  it('requires claiming the task before enabling the canvas button', async () => {
    render(<TaskSettings />);

    // 等待任务加载完成
    expect(await screen.findByText('玄幻修仙爆款短剧')).toBeDefined();

    // 点击“结构化需求”展开卡片
    const expandBtn = screen.getByText(/结构化需求|查看 Brief 简报/);
    fireEvent.click(expandBtn);

    // 未接单状态下：
    // 1. 上方显示“立即接单”
    const claimBtn = screen.getByText('立即接单');
    expect(claimBtn).toBeDefined();

    // 2. 下方“前往画布开始分镜制作（需先接单）”处于禁用状态
    const canvasBtn = screen.getByRole('button', { name: /前往画布开始分镜制作（需先接单）/ });
    expect(canvasBtn).toBeDefined();
    expect((canvasBtn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/接单后任务将专属于您；请先在上方点击【立即接单】，接单后方可前往画布制作。/)).toBeDefined();

    // 点击上方【立即接单】
    fireEvent.click(claimBtn);

    // 弹出极简电子协议签署弹窗
    expect(screen.getByText('商业项目制作承揽与保密协议 (NDA)')).toBeDefined();
    expect(screen.getByText('赏金全额托管与阶段结算')).toBeDefined();

    // 点击弹窗中的【确认签署并立即接单】
    const signBtn = screen.getByRole('button', { name: /确认签署并立即接单/ });
    fireEvent.click(signBtn);

    // 验证接单 API 被调用
    await waitFor(() => {
      expect(platformApi.claimTask).toHaveBeenCalledWith('task-1');
    });

    // 接单成功后：
    // 1. 上方显示“已接单锁定”和“协议存证”
    expect(await screen.findByText(/已接单/)).toBeDefined();
    expect(screen.getByText('协议存证')).toBeDefined();

    // 2. 下方按钮解锁为启用状态，文案更新为“前往画布开始分镜制作”
    const unlockedCanvasBtn = screen.getByRole('button', { name: /前往画布开始分镜制作/ });
    expect((unlockedCanvasBtn as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/任务已锁定专属于您，进入创作台或画布导入分镜流即刻开始制作。/)).toBeDefined();

    // 3. 点击可以正常跳转并带参直通
    fireEvent.click(unlockedCanvasBtn);
    expect(window.location.hash).toBe('#/atelier?from_task=task-1');
    expect(window.sessionStorage.getItem('active_commercial_task')).toContain('task-1');
  });
});
