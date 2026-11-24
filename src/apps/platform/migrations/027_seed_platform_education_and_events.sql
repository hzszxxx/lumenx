-- 027_seed_platform_education_and_events.sql
-- 预置培训学院实战课程、官方工程模板库、公开赛事活动与专业认证实操试卷

-- 1. 修复商业任务描述中的换行符格式
UPDATE commercial_tasks SET brief_markdown = replace(brief_markdown, '\n', char(10));

-- 2. 培训学院精品实战课程
INSERT OR IGNORE INTO courses (id, title, description, video_url, status) VALUES
(
    'course-seed-01',
    '《AI 短剧商业化实战：分镜语言与镜头动量掌控》',
    '系统讲授影视级短剧分镜设计、运镜 Prompt 组装与镜头间角色一致性锁定技巧，助你快速承接商单并过审。',
    'https://yingban.dajilin.net/assets/courses/demo-course-1.mp4',
    'published'
),
(
    'course-seed-02',
    '《Wanx 2.1 与 Qwen 多模态角色一致性定妆深度解析》',
    '实战演练现代都市、国风玄幻与二次元短剧的角色定妆卡训练、LoRA 微调配合与正反打光影统一。',
    'https://yingban.dajilin.net/assets/courses/demo-course-2.mp4',
    'published'
),
(
    'course-seed-03',
    '《互动影游决策树与分支叙事视觉制作指南》',
    '网状剧情树架构搭建，限时倒计时动态转场，多结局高能成片工业化输出规范。',
    'https://yingban.dajilin.net/assets/courses/demo-course-3.mp4',
    'published'
),
(
    'course-seed-04',
    '《商业信息流与广告视频高转化爆款剪辑技巧》',
    '3秒黄金完播率抓手、前置悬念钩子、动态字幕与快节奏动量剪辑核心方法论。',
    'https://yingban.dajilin.net/assets/courses/demo-course-4.mp4',
    'published'
);

-- 3. 官方工程模板库
INSERT OR IGNORE INTO templates (id, title, source_project_id, version, metadata_json, status) VALUES
(
    'template-seed-01',
    '《赛博朋克都市雨夜先导片》高保真分镜工程模板',
    'proj-template-cyber-01',
    '1.0.0',
    '{"shots_count": 8, "style": "赛博科幻", "aspect_ratio": "16:9", "duration": "45s"}',
    'published'
),
(
    'template-seed-02',
    '《国风悬疑神探大理寺》全套 LoRA 角色定妆与场景分镜',
    'proj-template-wuxia-02',
    '1.0.0',
    '{"shots_count": 6, "style": "国风玄幻", "aspect_ratio": "9:16", "duration": "60s"}',
    'published'
),
(
    'template-seed-03',
    '《现代都市爽剧战神归来》经典 3 幕剧本与分镜资产',
    'proj-template-urban-03',
    '1.0.0',
    '{"shots_count": 12, "style": "都市爽剧", "aspect_ratio": "9:16", "duration": "90s"}',
    'published'
);

-- 4. 赛事活动中心
INSERT OR IGNORE INTO competitions (
    id, title, slug, description, rules_markdown, whitelist_required, allocated_credits,
    status, enroll_deadline, submit_deadline, created_at
) VALUES
(
    'comp-seed-01',
    '第一届全球 AI 影视短片大赛 · 奇幻新纪元',
    'global-ai-film-fantasy-2026',
    '面向全球 AI 创作者开放的年度短片大奖赛。题材不限，重点考核分镜视听语言、跨镜头人物一致性与电影质感。获奖者可瓜分 500,000 算力点奖池及平台签约资格。',
    '### 参赛规则\n1. 影片时长 60-180 秒，需使用平台 Atelier 画布或 Studio 管线制作。\n2. 具备完整叙事逻辑与多镜头景别组接。\n3. 原创作品，严禁洗稿抄袭。\n4. 截稿时间：2026-12-31。',
    0,
    500000,
    'ongoing',
    '2026-12-25T18:00:00Z',
    '2026-12-31T23:59:59Z',
    '2026-11-20T00:00:00Z'
),
(
    'comp-seed-02',
    '48 小时限时 AI 漫剧创作冲刺挑战赛',
    '48h-ai-comic-sprint',
    '极限创作冲刺！发榜当日公布主题关键词，48 小时内完成一部 30 秒至 60 秒的竖屏短剧先导。前 10 名优胜团队瓜分 100,000 算力点。',
    '### 冲刺挑战赛规则\n1. 竖屏 9:16，时长 30-60 秒。\n2. 报名即赠送冲刺创作专属算力。\n3. 提交作品自动进入大众点赞与专家评审流。',
    0,
    100000,
    'enrolling',
    '2026-12-15T12:00:00Z',
    '2026-12-17T12:00:00Z',
    '2026-11-22T00:00:00Z'
);

-- 5. 专业创作者等级认证实操考题
INSERT OR IGNORE INTO certification_exams (id, prompt, version, is_active, created_at) VALUES
(
    'exam-seed-01',
    '【官方考核认证实操试卷 · 影视工业标准】' || char(10) ||
    '请根据平台提供的规范，制作一段 30 秒至 60 秒的连贯短片分镜。具体考核要求：' || char(10) ||
    '1. 景别组接：至少包含 4 个镜头景别（远景、全景、中景、特写）。' || char(10) ||
    '2. 角色一致性：主角面部与服装特征跨镜头保持稳定。' || char(10) ||
    '3. 视听叙事：包含一段正反打人物对话，口型自然无撕裂。' || char(10) ||
    '4. 完成导出成片并提交至评审中心，官方评审组将在 1-3 个工作日内评定并发放专业认证证书。',
    'v1.0',
    1,
    '2026-11-20T00:00:00Z'
);
