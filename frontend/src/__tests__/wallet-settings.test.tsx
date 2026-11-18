// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WalletSettings from '@/components/platform/WalletSettings';
import { platformApi } from '@/lib/platformApi';

vi.mock('@/lib/platformApi', () => ({
  platformApi: {
    wallet: vi.fn(),
    transactions: vi.fn(),
    convertCredits: vi.fn(),
    withdraw: vi.fn(),
  },
}));

vi.mock('@/store/platformStore', () => ({
  usePlatformStore: () => ({
    user: { id: 'user-creator-1', role: 'creator', username: 'test_creator' },
  }),
}));

const mockTransactions = [
  {
    entry_id: 'entry-1',
    transaction_id: 'tx-1',
    amount_cents: 350000,
    direction: 'credit',
    reference_type: 'task',
    reference_id: 'task-1',
    created_at: '2026-11-18T10:00:00Z',
  },
];

describe('WalletSettings Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(platformApi.wallet).mockResolvedValue({
      user_id: 'user-1',
      simulated_balance_cents: 350000,
    });
    vi.mocked(platformApi.transactions).mockResolvedValue(mockTransactions);
    vi.mocked(platformApi.convertCredits).mockResolvedValue({
      converted_cents: 10000,
      granted_credits: 12000,
      available_credits: 12000,
      simulated_balance_cents: 250000,
    });
    vi.mocked(platformApi.withdraw).mockResolvedValue({
      withdrawal_id: 'w-1',
      amount_cents: 10000,
      payout_channel: 'alipay',
      simulated_balance_cents: 250000,
      status: 'pending',
    });
  });

  it('renders wallet balance and transaction list', async () => {
    render(<WalletSettings />);

    expect(await screen.findByText('创作者收益中心')).toBeDefined();
    // 可提现商业收益与累计总放款均为 ¥3500.00
    const amounts = screen.getAllByText('¥3500.00');
    expect(amounts.length).toBeGreaterThanOrEqual(2);
    // 流水明细
    expect(screen.getByText('商单终审放款')).toBeDefined();
    expect(screen.getByText('+¥3500.00')).toBeDefined();
  });

  it('handles credit conversion successfully', async () => {
    render(<WalletSettings />);
    expect(await screen.findByText('创作者收益中心')).toBeDefined();

    // 点击兑换算力
    const convertBtn = screen.getByRole('button', { name: /收益兑换算力/ });
    fireEvent.click(convertBtn);

    // 弹窗出现
    expect(screen.getByText('收益兑换平台算力')).toBeDefined();

    // 提交兑换
    const submitBtn = screen.getByRole('button', { name: /确认兑换到账/ });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(platformApi.convertCredits).toHaveBeenCalledWith(10000); // 默认 100 元 = 10000 cents
    });

    expect(await screen.findByText(/兑换成功！已将 ¥100 商单收益兑换为 12,000 点平台算力/)).toBeDefined();
  });

  it('handles withdrawal application successfully', async () => {
    render(<WalletSettings />);
    expect(await screen.findByText('创作者收益中心')).toBeDefined();

    // 点击申请提现
    const withdrawBtn = screen.getByRole('button', { name: /申请收益提现/ });
    fireEvent.click(withdrawBtn);

    // 弹窗出现
    expect(screen.getByText('商业任务收益提现')).toBeDefined();

    // 填入收款账号
    const accountInput = screen.getByPlaceholderText(/例如: 13800000000/);
    fireEvent.change(accountInput, { target: { value: '13800138000 (张三)' } });

    // 提交提现
    const submitBtn = screen.getByRole('button', { name: /确认提交申请/ });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(platformApi.withdraw).toHaveBeenCalledWith({
        amount_cents: 50000, // 默认 500 元 = 50000 cents
        payout_channel: 'alipay',
        account_info: '13800138000 (张三)',
      });
    });

    expect(await screen.findByText(/提现申请已提交！已从钱包预扣 ¥500/)).toBeDefined();
  });
});
