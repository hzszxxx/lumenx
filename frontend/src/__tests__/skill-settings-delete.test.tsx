// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SkillSettings from '../components/platform/SkillSettings';
import { platformApi, type PlatformSkillVersion } from '@/lib/platformApi';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock platformApi
vi.mock('@/lib/platformApi', () => ({
  platformApi: {
    skills: vi.fn(),
    bindSkillVersion: vi.fn(),
    deleteSkillVersion: vi.fn(),
    createSkillVersion: vi.fn(),
  },
}));

describe('SkillSettings custom vs system skill actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  const mockSkills: PlatformSkillVersion[] = [
    {
      id: 'skill-sys-1',
      name: 'aesthetic-director',
      version: '1.0.0',
      scope: 'system',
      status: 'active',
      content_hash: 'hash-sys-1234567890',
      created_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 'skill-custom-2',
      name: 'my-custom-adapter',
      version: '1.0.0',
      scope: 'user',
      status: 'inactive',
      content_hash: 'hash-custom-1234567890',
      created_at: '2026-11-01T00:00:00Z',
    },
  ];

  it('renders system skills with only toggle active button (no delete button), while custom skills have delete button', async () => {
    vi.mocked(platformApi.skills).mockResolvedValue(mockSkills);
    vi.mocked(platformApi.deleteSkillVersion).mockResolvedValue({ id: 'skill-custom-2', deleted: true, name: 'my-custom-adapter' });

    render(<SkillSettings />);

    // 等待技能加载完成
    await waitFor(() => {
      expect(screen.getByText(/已启用的专家 Skill 列表/)).toBeDefined();
    });

    // 1. 系统内置 Skill:
    // 应该显示 "关闭激活" 按钮
    const systemCloseBtn = screen.getByRole('button', { name: /关闭激活/ });
    expect(systemCloseBtn).toBeDefined();

    // 2. 自定义 Skill:
    // 应该显示 "开启激活" 按钮
    const customOpenBtn = screen.getByRole('button', { name: /开启激活/ });
    expect(customOpenBtn).toBeDefined();

    // 3. 删除按钮：界面中应该只有 1 个“删除”按钮，且属于自定义技能
    const deleteButtons = screen.getAllByRole('button', { name: /删除/ });
    expect(deleteButtons.length).toBe(1);

    // 4. 点击删除自定义 Skill
    fireEvent.click(deleteButtons[0]);
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(platformApi.deleteSkillVersion).toHaveBeenCalledWith('skill-custom-2');
    });
  });
});
