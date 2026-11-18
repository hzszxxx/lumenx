// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContractSignDialog from '@/components/platform/ContractSignDialog';
import ContractViewerDialog from '@/components/platform/ContractViewerDialog';
import { platformApi, type PlatformTask } from '@/lib/platformApi';

vi.mock('@/lib/platformApi', () => ({
  platformApi: {
    taskContract: vi.fn(),
  },
}));

const mockTask: PlatformTask = {
  id: 'task-test-contract',
  title: '高端新能源汽车 30 秒未来科技概念片',
  category: '商业广告',
  brief_markdown: '### 需求说明\n高科技车身流线',
  bounty_cents: 680000,
  required_level: 'standard',
  deadline: '2026-12-01',
  status: 'published',
  version: 0,
  created_at: '2026-11-18T00:00:00Z',
  client_name: '未来极智汽车',
};

describe('Commercial Electronic Contract Components', () => {
  it('renders ContractSignDialog with TL;DR points and triggers onConfirm', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ContractSignDialog
        task={mockTask}
        signerName="测试创作者_张导"
        onConfirm={onConfirm}
        onClose={onClose}
        isSigning={false}
      />
    );

    // 检查标题与标的信息
    expect(screen.getByText('商业项目制作承揽与保密协议 (NDA)')).toBeDefined();
    expect(screen.getByText('高端新能源汽车 30 秒未来科技概念片')).toBeDefined();
    expect(screen.getByText('¥6,800')).toBeDefined();

    // 检查 TL;DR 核心三大胶囊
    expect(screen.getByText('赏金全额托管与阶段结算')).toBeDefined();
    expect(screen.getByText('商业保密与素材资产防泄密 (NDA)')).toBeDefined();
    expect(screen.getByText('商用版权移交与创作者永久署名权')).toBeDefined();

    // 检查实名签署主体
    expect(screen.getByText('测试创作者_张导')).toBeDefined();

    // 展开完整法务正文
    const toggleBtn = screen.getByText(/查看完整法务协议正文/);
    fireEvent.click(toggleBtn);
    expect(screen.getByText('一、合同订立与生效')).toBeDefined();

    // 点击一键签署按钮
    const confirmBtn = screen.getByRole('button', { name: /确认签署并立即接单/ });
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders ContractViewerDialog with signed contract hash and details', async () => {
    vi.mocked(platformApi.taskContract).mockResolvedValue({
      id: 'contract-task-test-contract',
      task_id: 'task-test-contract',
      creator_id: 'creator-1',
      contract_type: 'commercial_undertaking_nda',
      status: 'signed',
      digest_hash: 'sha256:abcd1234efgh5678ijkl9012mnop3456qrst7890',
      signer_name: '测试创作者_张导',
      signed_at: '2026-11-18T12:00:00Z',
      terms: {
        title: '商业制作承揽与保密协议',
        milestone_settlement: '40% 分镜确认结算 + 60% 成片验收结算',
        nda_clause: '严格保密',
        copyright_clause: '商用权归发包方',
        arbitration_clause: '影伴平台专员仲裁',
      },
    });

    const onClose = vi.fn();
    render(<ContractViewerDialog task={mockTask} onClose={onClose} />);

    expect(await screen.findByText('电子承揽协议凭证与数字存证')).toBeDefined();
    expect(screen.getByText('已在线签署·生效中')).toBeDefined();
    expect(screen.getByText(/sha256:abcd1234/)).toBeDefined();
    expect(screen.getByText('未来极智汽车')).toBeDefined();

    // 点击完成查看
    const closeBtn = screen.getByRole('button', { name: '完成查看' });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
