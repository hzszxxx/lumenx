// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import TaskSettings from '@/components/platform/TaskSettings';
import TaskCreateDialog from '@/components/platform/TaskCreateDialog';
import ContractSignDialog from '@/components/platform/ContractSignDialog';
import ContractViewerDialog from '@/components/platform/ContractViewerDialog';
import ClayWipeCompareModal from '@/components/atelier/v3/ClayWipeCompareModal';
import StoryboardBatchImportModal from '@/components/atelier/v3/StoryboardBatchImportModal';
import { resolveNodeRenderAndClay } from '@/components/atelier/v3/AtelierShell';
import { platformApi, type PlatformTask } from '@/lib/platformApi';

vi.mock('@/lib/platformApi', () => ({
  platformApi: {
    tasks: vi.fn(),
    claimTask: vi.fn(),
    deliverTask: vi.fn(),
    reviewTask: vi.fn(),
    getTaskContract: vi.fn(),
    createTask: vi.fn(),
  },
}));

const mockUser = { id: 'creator-uuid-888', username: 'top_director', role: 'creator' };
vi.mock('@/store/platformStore', () => ({
  usePlatformStore: () => ({
    user: mockUser,
    walletCents: 500000,
  }),
}));

describe('Commercial Creator End-to-End Workflow (Full Lifecycle)', () => {
  const publishedTask: PlatformTask = {
    id: 'task-e2e-1',
    title: '《深空迷航：代号零》先导片',
    category: 'ai_drama',
    demand_type: 'ai_drama',
    brief_markdown: '### 制作需求\n根据3D白模机位完成60秒连贯影视级运镜成片',
    bounty_cents: 500000,
    required_level: 'pro',
    level_tier: 'pro',
    deadline: '2026-12-01',
    status: 'published',
    version: 0,
    created_at: '2026-11-18T00:00:00Z',
    client_name: '星际互动影业',
    settlement_mode: 'milestone',
    milestone_specs_json: JSON.stringify([
      { title: '第一阶段：3D白模与分镜', percentage: 40, amount_cents: 200000 },
      { title: '第二阶段：次世代4K成片', percentage: 60, amount_cents: 300000 },
    ]),
    deliverable_specs_json: JSON.stringify({
      resolution: '4K UHD',
      duration_seconds: 60,
      anti_theft_watermark: true,
    }),
    copyright_terms_json: JSON.stringify({
      commercial_use: '全渠道独家商业买断',
      creator_credit: '导演署名权',
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.role = 'creator';
    vi.mocked(platformApi.tasks).mockResolvedValue([publishedTask]);
    vi.mocked(platformApi.claimTask).mockResolvedValue({
      task_id: 'task-e2e-1',
      status: 'claimed',
      contract_id: 'contract-task-e2e-1',
      digest_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    });
    vi.mocked(platformApi.getTaskContract).mockResolvedValue({
      id: 'contract-task-e2e-1',
      task_id: 'task-e2e-1',
      creator_id: 'creator-uuid-888',
      contract_type: 'commercial_undertaking_nda',
      status: 'signed',
      digest_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      terms_snapshot_json: JSON.stringify({
        contract_type: 'commercial_undertaking_nda',
        title: '商业制作承揽与保密协议',
        milestone_settlement: '40% 分镜确认结算 + 60% 成片验收结算',
        nda_clause: '严格保密',
        copyright_clause: '全额放款后商用权归发包方所有',
      }),
      terms: {
        contract_type: 'commercial_undertaking_nda',
        title: '商业制作承揽与保密协议',
        milestone_settlement: '40% 分镜确认结算 + 60% 成片验收结算',
        nda_clause: '严格保密',
        copyright_clause: '全额放款后商用权归发包方所有',
      },
      signer_name: 'top_director',
      signed_at: '2026-11-18T10:00:00Z',
    });
    vi.mocked(platformApi.deliverTask).mockResolvedValue({
      id: 'delivery-1',
      task_id: 'task-e2e-1',
      version_num: 1,
      status: 'delivered',
    });
    vi.mocked(platformApi.reviewTask).mockResolvedValue({
      task_id: 'task-e2e-1',
      status: 'settled',
      feedback: '验收合格，准予放款！',
    });
    vi.mocked(platformApi.createTask).mockResolvedValue(publishedTask);
  });

  it('Stage 1: Client publishes structured commercial demand via TaskCreateDialog', async () => {
    const handleCreated = vi.fn();
    const handleClose = vi.fn();

    render(
      <TaskCreateDialog
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleCreated}
      />
    );

    expect(screen.getByText('发布商业需求单')).toBeDefined();

    // Fill in title & budget
    const titleInput = screen.getByPlaceholderText(/例如: 悬疑短剧/);
    fireEvent.change(titleInput, { target: { value: '全息赛博漫剧先导片' } });

    const bountyInput = screen.getByDisplayValue('3500');
    fireEvent.change(bountyInput, { target: { value: '8000' } });

    // Submit dialog
    const submitBtn = screen.getByRole('button', { name: /立即托管赏金并发布/ });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleCreated).toHaveBeenCalledTimes(1);
    });
  });

  it('Stage 2: Creator claims task and signs electronic contract', async () => {
    render(<TaskSettings />);

    expect(await screen.findByText('《深空迷航：代号零》先导片')).toBeDefined();

    // Expand Brief
    const expandBtn = screen.getByText(/结构化需求|查看 Brief 简报/);
    fireEvent.click(expandBtn);

    // Click claim button -> opens contract dialog
    const claimBtn = screen.getByText('立即接单');
    fireEvent.click(claimBtn);

    // ContractSignDialog appears
    expect(await screen.findByText(/商业项目制作承揽与保密协议/)).toBeDefined();
    expect(screen.getAllByText(/星际互动影业/).length).toBeGreaterThanOrEqual(1);

    // Confirm signing
    const signBtn = screen.getByRole('button', { name: /确认签署并立即接单/ });
    fireEvent.click(signBtn);

    // API should be called
    await waitFor(() => {
      expect(platformApi.claimTask).toHaveBeenCalledWith('task-e2e-1');
    });

    // Verification message appears
    expect(await screen.findByText(/接单并电子签约成功/)).toBeDefined();
  });

  it('Stage 3: Previz & Storyboard Batch Import and Wipe Compare Modal in Atelier', async () => {
    // 1. Batch Import Modal parses storyboard with clay_url
    const handleImport = vi.fn();
    const { unmount: unmountImport } = render(
      <StoryboardBatchImportModal
        open={true}
        onClose={vi.fn()}
        onImportShots={handleImport}
      />
    );

    const importSubmitBtn = screen.getByRole('button', { name: /一键批量生成 4 个分镜节点/ });
    fireEvent.click(importSubmitBtn);
    expect(handleImport).toHaveBeenCalledTimes(1);
    const shots = handleImport.mock.calls[0][0];
    expect(shots).toHaveLength(4);
    unmountImport();

    // 2. Resolve render and clay URLs across nodes
    const mockClayNode: any = {
      id: 'shot-01-clay',
      type: 'image',
      media_urls: ['https://example.com/clay_blockout.jpg'],
      data: {},
    };
    const mockVideoNode: any = {
      id: 'shot-01-video',
      type: 'video',
      media_urls: ['https://example.com/shot_final.mp4'],
      data: {
        reference_node_ids: ['shot-01-clay'],
      },
    };
    const resolved = resolveNodeRenderAndClay(mockVideoNode, [mockClayNode, mockVideoNode]);
    expect(resolved.renderUrl).toBe('https://example.com/shot_final.mp4');
    expect(resolved.clayUrl).toBe('https://example.com/clay_blockout.jpg');

    // 3. Wipe Compare Modal operates in 4 visual modes
    render(
      <ClayWipeCompareModal
        open={true}
        onClose={vi.fn()}
        renderUrl={resolved.renderUrl!}
        renderKind="video"
        clayUrl={resolved.clayUrl!}
        clayKind="image"
        title="分镜比对: SHOT-01"
      />
    );

    expect(screen.getByText('卷帘对比 (Wipe)')).toBeDefined();

    // Switch to difference mode
    const diffBtn = screen.getByRole('button', { name: /差值对位/i });
    fireEvent.click(diffBtn);
    expect(screen.getByText(/差值透视对位/i)).toBeDefined();
  });

  it('Stage 4: Creator delivers with watermark and Client accepts release payment', async () => {
    // Modify task status to claimed
    vi.mocked(platformApi.tasks).mockResolvedValue([
      {
        ...publishedTask,
        status: 'claimed',
        claimed_by: 'creator-uuid-888',
      },
    ]);

    const { unmount } = render(<TaskSettings />);

    expect(await screen.findByText('《深空迷航：代号零》先导片')).toBeDefined();

    // Expand Brief
    const expandBtn = screen.getByText(/结构化需求|查看 Brief 简报/);
    fireEvent.click(expandBtn);

    // Delivery button should be active for claimed task
    const deliverTriggerBtn = screen.getByRole('button', { name: /\+ 提交交付样片/ });
    fireEvent.click(deliverTriggerBtn);

    // Delivery form area
    expect(screen.getByText('商业任务交付区')).toBeDefined();
    const watermarkCheckbox = screen.getByRole('checkbox');
    expect((watermarkCheckbox as HTMLInputElement).checked).toBe(true);

    // Submit delivery
    const confirmDeliverBtn = screen.getByRole('button', { name: /确认提交交付审核/ });
    fireEvent.click(confirmDeliverBtn);

    await waitFor(() => {
      expect(platformApi.deliverTask).toHaveBeenCalledTimes(1);
    });

    unmount();

    // Client/Admin reviews task
    mockUser.role = 'client';
    vi.mocked(platformApi.tasks).mockResolvedValue([
      {
        ...publishedTask,
        status: 'delivered',
        claimed_by: 'creator-uuid-888',
      },
    ]);

    render(<TaskSettings />);
    expect(await screen.findByText('《深空迷航：代号零》先导片')).toBeDefined();

    const expandClientBtn = screen.getByText(/结构化需求|查看 Brief 简报/);
    fireEvent.click(expandClientBtn);

    expect(screen.getByText('需求方终审验收台')).toBeDefined();
    const approveBtn = screen.getByRole('button', { name: /终审通过并全额放款/ });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(platformApi.reviewTask).toHaveBeenCalledWith('task-e2e-1', {
        approved: true,
        feedback: expect.any(String),
      });
    });
  });
});
