-- 024_structured_commercial_demands.sql
-- 扩展商业任务(commercial_tasks)以支持VJshi/光厂式结构化需求卡片

ALTER TABLE commercial_tasks ADD COLUMN demand_type TEXT DEFAULT 'ai_drama';
-- 结构化规格: 交付物类型、分辨率/比例(9:16/16:9)、时长(秒)、条数、帧率等
ALTER TABLE commercial_tasks ADD COLUMN deliverable_specs_json TEXT DEFAULT '{}';
-- 预算模式: fixed(固定一口价), range(区间预算), per_unit(单价如按秒/按条)
ALTER TABLE commercial_tasks ADD COLUMN budget_mode TEXT DEFAULT 'fixed';
ALTER TABLE commercial_tasks ADD COLUMN budget_min_cents INTEGER DEFAULT 0;
ALTER TABLE commercial_tasks ADD COLUMN budget_max_cents INTEGER DEFAULT 0;
-- 结算模式: milestone(分阶段40%/60%), one_time(成片验收一次性)
ALTER TABLE commercial_tasks ADD COLUMN settlement_mode TEXT DEFAULT 'one_time';
ALTER TABLE commercial_tasks ADD COLUMN milestone_specs_json TEXT DEFAULT '[]';
-- 版权与商用范围约定(全网信息流/电商品牌/可二次修改/需标注AI等)
ALTER TABLE commercial_tasks ADD COLUMN copyright_terms_json TEXT DEFAULT '{}';
-- 结构化验收标准列表(如角色一致性、无画质撕裂、音画对位偏差<=0.2s等)
ALTER TABLE commercial_tasks ADD COLUMN acceptance_criteria_json TEXT DEFAULT '[]';
-- 参考样片与风格指引(参考样片URL列表、风格建议、反向禁止风格等)
ALTER TABLE commercial_tasks ADD COLUMN reference_media_json TEXT DEFAULT '[]';
-- 需求方企业或品牌名称展示快照
ALTER TABLE commercial_tasks ADD COLUMN client_name TEXT DEFAULT '';
-- 允许接单创作者等级门槛: beginner(新手区/带教单), standard(成长区/认证创作者), pro(优选区/高级工作室)
ALTER TABLE commercial_tasks ADD COLUMN level_tier TEXT DEFAULT 'standard';
