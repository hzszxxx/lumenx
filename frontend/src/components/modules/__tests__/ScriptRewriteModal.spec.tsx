import { fireEvent, screen, waitFor } from '@testing-library/react';
import axios, { type AxiosAdapter } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScriptRewriteModal, { PRESET_REWRITE_SKILLS } from '../ScriptRewriteModal';
import { renderWithIntl } from '../../series/__tests__/test-utils';
import { API_URL } from '@/lib/api';

describe('ScriptRewriteModal', () => {
    let requests: Array<{ url: string | undefined; body: Record<string, unknown> }> = [];
    let originalAdapter: typeof axios.defaults.adapter;

    beforeEach(() => {
        requests = [];
        originalAdapter = axios.defaults.adapter;
        const adapter: AxiosAdapter = async (config) => {
            requests.push({
                url: config.url,
                body: config.data ? JSON.parse(config.data) : {},
            });
            return {
                data: {
                    rewritten_text: '第1场 咖啡馆 日 外\n阳光透过玻璃窗洒在桌面上。\n小猫端坐桌前，好奇地眨着眼睛。',
                    model: 'qwen3.6-plus',
                },
                status: 200,
                statusText: '200',
                headers: {},
                config,
            };
        };
        axios.defaults.adapter = adapter;
    });

    afterEach(() => {
        axios.defaults.adapter = originalAdapter;
    });

    it('renders skills and updates editable prompt on skill selection', () => {
        const onClose = vi.fn();
        const onApply = vi.fn();

        renderWithIntl(
            <ScriptRewriteModal
                isOpen={true}
                scriptText="一只猫在探店咖啡馆"
                projectId="proj-1"
                onClose={onClose}
                onApply={onApply}
            />
        );

        // 默认应该显示短剧分场 Skill
        const textarea = screen.getByPlaceholderText('输入改写具体要求...') as HTMLTextAreaElement;
        expect(textarea.value).toContain('短剧');

        // 点击切换到第二个 Skill（快节奏冲突与钩子强化）
        const secondSkill = PRESET_REWRITE_SKILLS[1];
        const secondBtn = screen.getByText(secondSkill.name);
        fireEvent.click(secondBtn);

        // textarea 应该同步更新为第二个 skill 的 prompt
        expect(textarea.value).toEqual(secondSkill.prompt);
    });

    it('allows editing prompt and sends customized prompt to rewrite API, then applies', async () => {
        const onClose = vi.fn();
        const onApply = vi.fn();

        renderWithIntl(
            <ScriptRewriteModal
                isOpen={true}
                scriptText="一只猫在探店咖啡馆"
                projectId="proj-1"
                onClose={onClose}
                onApply={onApply}
            />
        );

        const textarea = screen.getByPlaceholderText('输入改写具体要求...') as HTMLTextAreaElement;
        // 用户自定义修改 prompt
        fireEvent.change(textarea, { target: { value: '我的自定义改写要求：加入更多猫咪心理描写' } });
        expect(textarea.value).toBe('我的自定义改写要求：加入更多猫咪心理描写');

        // 点击“改写”按钮
        const rewriteBtn = screen.getByRole('button', { name: 'start-rewrite' });
        fireEvent.click(rewriteBtn);

        await waitFor(() => {
            expect(requests.length).toBe(1);
        });

        expect(requests[0].url).toBe(`${API_URL}/projects/proj-1/rewrite_script`);
        expect(requests[0].body).toEqual({
            script_text: '一只猫在探店咖啡馆',
            skill_prompt: '我的自定义改写要求：加入更多猫咪心理描写',
            model: undefined,
        });

        // 改写结果展示
        await screen.findByText(/第1场 咖啡馆/);

        // 点击“采纳并替换剧本”
        const applyBtn = screen.getByRole('button', { name: /采纳并替换剧本/i });
        fireEvent.click(applyBtn);

        expect(onApply).toHaveBeenCalledWith('第1场 咖啡馆 日 外\n阳光透过玻璃窗洒在桌面上。\n小猫端坐桌前，好奇地眨着眼睛。');
        expect(onClose).toHaveBeenCalled();
    });

    it('falls back to standalone /script/rewrite endpoint when projectId is empty', async () => {
        renderWithIntl(
            <ScriptRewriteModal
                isOpen={true}
                scriptText="临时新建草稿剧本"
                projectId=""
                onClose={vi.fn()}
                onApply={vi.fn()}
            />
        );

        const rewriteBtn = screen.getByRole('button', { name: 'start-rewrite' });
        fireEvent.click(rewriteBtn);

        await waitFor(() => {
            expect(requests.length).toBe(1);
        });

        expect(requests[0].url).toBe(`${API_URL}/script/rewrite`);
        expect(requests[0].body).toEqual({
            script_text: '临时新建草稿剧本',
            skill_prompt: PRESET_REWRITE_SKILLS[0].prompt,
            model: undefined,
        });
    });

    it('formats timeout error into user-friendly message', async () => {
        const timeoutAdapter: AxiosAdapter = async () => {
            throw new Error('timeout exceeded');
        };
        axios.defaults.adapter = timeoutAdapter;

        renderWithIntl(
            <ScriptRewriteModal
                isOpen={true}
                scriptText="测试超时"
                projectId="proj-timeout"
                onClose={vi.fn()}
                onApply={vi.fn()}
            />
        );

        const rewriteBtn = screen.getByRole('button', { name: 'start-rewrite' });
        fireEvent.click(rewriteBtn);

        await screen.findByText('请求超时或网络中断，请检查网络或刷新页面后重试');
    });
});
