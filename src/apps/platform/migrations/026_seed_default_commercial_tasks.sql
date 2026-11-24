-- 026_seed_default_commercial_tasks.sql
-- 初始化官方精选商业短剧与AI内容商单数据（覆盖AI短剧、互动影游、品牌信息流、国潮视觉等核心赛道）

INSERT OR IGNORE INTO commercial_tasks (
    id, title, category, brief_markdown, bounty_cents, required_level,
    deadline, status, version, created_at, demand_type, deliverable_specs_json,
    budget_mode, budget_min_cents, budget_max_cents, settlement_mode,
    milestone_specs_json, copyright_terms_json, acceptance_criteria_json,
    reference_media_json, client_name, level_tier
) VALUES (
    'task-seed-drama-01',
    '《都市之逆天神医》商业短剧前3集分镜设计与连贯成片',
    'video',
    '【剧本简介】主角叶凡本为隐世宗门医圣传人，入世历练遭遇豪门退婚退市，凭借一手出神入化的造化医术逆风翻盘。\n\n【交付要求】\n1. 角色一致性：主角叶凡与女主角苏倾城须保持面部特征与关键服饰高度一致。\n2. 格式规范：标准 9:16 短剧竖屏，1080x1920，25fps，前3集每集时长约60-90秒。\n3. 官方提供：分镜分段Prompt参考及音效预制库。\n4. 结算：40% 首批分镜确认放款，60% 终审成片验收放款。',
    350000,
    'standard',
    '2026-12-15T18:00:00Z',
    'published',
    0,
    '2026-11-24T00:00:00Z',
    'ai_drama',
    '{"format":"9:16","resolution":"1080x1920","duration_seconds":180,"count":3,"fps":25}',
    'fixed',
    350000,
    350000,
    'milestone',
    '[{"name":"分镜关键帧确认","ratio":0.4,"description":"前3集全部分镜画面与角色锁定"},{"name":"终审成片验收","ratio":0.6,"description":"带混音完整连贯成品视频交付"}]',
    '{"scope":"commercial_exclusive","attribution_required":false,"derivative_allowed":true}',
    '["角色面部与关键服装跨镜头一致性稳定","对白音频口型匹配自然无撕裂","运镜符合竖屏爽剧快节奏转场要求"]',
    '[]',
    '星瀚互动影业 MCN',
    'beginner'
);

INSERT OR IGNORE INTO commercial_tasks (
    id, title, category, brief_markdown, bounty_cents, required_level,
    deadline, status, version, created_at, demand_type, deliverable_specs_json,
    budget_mode, budget_min_cents, budget_max_cents, settlement_mode,
    milestone_specs_json, copyright_terms_json, acceptance_criteria_json,
    reference_media_json, client_name, level_tier
) VALUES (
    'task-seed-game-02',
    '《诡秘降临：调查员笔记》互动影游分支关键抉择节点制作',
    'video',
    '【项目背景】中世纪克苏鲁克制风悬疑探案互动短剧。玩家扮演调查员进入黑石庄园，面临生死抉择。\n\n【制作范围】\n1. 制作第4幕核心分支路口：选择【留在客厅调查壁炉暗门】或【跟随黑影前往地下酒窖】。\n2. 包含5秒紧张倒计时动态UI转场以及两个完全不同的高能剧情走向分镜与成片（各45秒）。\n3. 风格质感：古典油画胶片感、低饱和浓重暗调光影。',
    880000,
    'standard',
    '2026-12-20T20:00:00Z',
    'published',
    0,
    '2026-11-24T00:00:00Z',
    'interactive_game',
    '{"format":"16:9","resolution":"1920x1080","duration_seconds":120,"count":2,"fps":30}',
    'fixed',
    880000,
    880000,
    'milestone',
    '[{"name":"概念分镜与转场DEMO","ratio":0.4,"description":"完成分支决策树线稿及第一版动作动态"},{"name":"双分支高能成片交付","ratio":0.6,"description":"完成最终4K渲染与立体声混音交付"}]',
    '{"scope":"interactive_game_global","attribution_required":true,"derivative_allowed":true}',
    '["克苏鲁暗黑胶片氛围还原精准","分支决策点无缝对接互动播放器转场","怪物局部特写具视觉张力与惊悚感"]',
    '[]',
    '幻灵时代互动科技',
    'pro'
);

INSERT OR IGNORE INTO commercial_tasks (
    id, title, category, brief_markdown, bounty_cents, required_level,
    deadline, status, version, created_at, demand_type, deliverable_specs_json,
    budget_mode, budget_min_cents, budget_max_cents, settlement_mode,
    milestone_specs_json, copyright_terms_json, acceptance_criteria_json,
    reference_media_json, client_name, level_tier
) VALUES (
    'task-seed-car-03',
    '高端智能新能源纯电 SUV 新车发布会先导 AI 动态分镜',
    'video',
    '【品牌需求】新势力新能源旗舰猎装纯电 SUV 全球上市先导视觉大片。\n\n【画面要素】\n1. 车身流光掠影：未来科技感贯穿式流光灯语、赛博都市霓虹反光与车体流线金属漆质感。\n2. 运镜要求：电影级一镜到底环绕运镜、高速疾驰动态模糊、风洞测试粒子流可视化。\n3. 交付形式：15秒与30秒两个规格，提供高码率 4K 横屏母带。',
    520000,
    'standard',
    '2026-12-10T12:00:00Z',
    'published',
    0,
    '2026-11-24T00:00:00Z',
    'short_video_flow',
    '{"format":"16:9","resolution":"3840x2160","duration_seconds":45,"count":2,"fps":60}',
    'fixed',
    520000,
    520000,
    'one_time',
    '[{"name":"终审一次性付讫","ratio":1.0,"description":"4K母带通过品牌方验收后一次性释放全款"}]',
    '{"scope":"all_media_commercial","attribution_required":false,"derivative_allowed":true}',
    '["车漆反光与环境折射符合真实物理规律","车体曲面模型比例精准无畸变变形","运动运镜丝滑无抖动掉帧"]',
    '[]',
    '极氪出行品牌数字营销部',
    'standard'
);

INSERT OR IGNORE INTO commercial_tasks (
    id, title, category, brief_markdown, bounty_cents, required_level,
    deadline, status, version, created_at, demand_type, deliverable_specs_json,
    budget_mode, budget_min_cents, budget_max_cents, settlement_mode,
    milestone_specs_json, copyright_terms_json, acceptance_criteria_json,
    reference_media_json, client_name, level_tier
) VALUES (
    'task-seed-wuxia-04',
    '《大唐夜行录》国风玄幻短剧角色概念与先导篇分镜制作',
    'video',
    '【题材方向】国风水墨玄幻、盛唐诡事与刺客谍影。\n\n【创作要点】\n1. 盛唐洛阳雨夜街景、红衣金刀夜行女刺客与玄甲不良人月下追击。\n2. 水墨烟气消散特写、飞檐走壁轻功动量还原。\n3. 官方提供完整剧本梗概与角色设定卡（LoRA参考图已备齐）。',
    400000,
    'standard',
    '2026-12-18T18:00:00Z',
    'published',
    0,
    '2026-11-24T00:00:00Z',
    'ai_drama',
    '{"format":"9:16","resolution":"1080x1920","duration_seconds":90,"count":1,"fps":25}',
    'fixed',
    400000,
    400000,
    'milestone',
    '[{"name":"角色卡与关键分镜确认","ratio":0.4,"description":"确认女刺客及不良人角色定妆与分镜景别"},{"name":"先导篇成片交付","ratio":0.6,"description":"完成全片渲染合成与特效字幕交付"}]',
    '{"scope":"drama_platform_exclusive","attribution_required":true,"derivative_allowed":true}',
    '["盛唐国风美学还原度高，服化道细节考究","夜行追逐打斗分镜张弛有度，动作连贯","提供带国风配乐的合成预览成片"]',
    '[]',
    '云帆短剧制作工厂',
    'standard'
);

INSERT OR IGNORE INTO commercial_tasks (
    id, title, category, brief_markdown, bounty_cents, required_level,
    deadline, status, version, created_at, demand_type, deliverable_specs_json,
    budget_mode, budget_min_cents, budget_max_cents, settlement_mode,
    milestone_specs_json, copyright_terms_json, acceptance_criteria_json,
    reference_media_json, client_name, level_tier
) VALUES (
    'task-seed-tea-05',
    '新中式国潮茶饮品牌 IP 联名视觉设计与动态电商 KV',
    'video',
    '【客户需求】知名新茶饮品牌冬季限定【桂花龙井白月光】上新视觉。\n\n【交付内容】\n1. 3D 黏土/微缩国风庭院主视觉 KV（横竖两版）。\n2. 15秒动态产品展示视频：茶汤倾泻微距、桂花飘落、奶盖绵密质感。\n3. 适合新人创作者，官方自带样片风格指引与材质提示词库。',
    180000,
    'standard',
    '2026-12-08T18:00:00Z',
    'published',
    0,
    '2026-11-24T00:00:00Z',
    'visual_content',
    '{"format":"3:4","resolution":"1440x1920","duration_seconds":15,"count":2,"fps":30}',
    'fixed',
    180000,
    180000,
    'one_time',
    '[{"name":"全额验收放款","ratio":1.0,"description":"电商物料终审过关后一次性结算"}]',
    '{"scope":"ecommerce_marketing","attribution_required":false,"derivative_allowed":true}',
    '["茶饮杯体透光与液体质感逼真诱人","桂花国风元素与品牌主色调契合","静态高清KV分辨率不低于4K"]',
    '[]',
    '茶颜悦夏品牌运营中心',
    'beginner'
);
