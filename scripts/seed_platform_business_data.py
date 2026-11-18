#!/usr/bin/env python3
"""
Seed realistic, high quality platform business operations data:
- Competitions (赛事活动)
- Certification Exams (创作者认证考试)
- Commercial Tasks (商业任务广场)
- Academy Courses & Templates (培训学院课程与工程模板)
"""
import json
import sqlite3
import sys
import uuid
from datetime import datetime, timezone, timedelta

def seed_platform_data(db_path: str):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat()
    d7_iso = (now_dt + timedelta(days=7)).isoformat()
    d14_iso = (now_dt + timedelta(days=14)).isoformat()
    d30_iso = (now_dt + timedelta(days=30)).isoformat()

    # 1. Competitions
    competitions = [
        (
            str(uuid.uuid4()),
            "2026 首届全球 AI 影视创作短片大赛",
            "global-ai-film-2026",
            "面向全球 AIGC 影视导演、编剧与短片创作者，设立 100,000 算力奖池与签约合作机会。赛道包含科幻叙事、悬疑反转与东方奇幻。",
            """### 赛制要求
1. **作品时长**：2~5 分钟完整微短片，需具备清晰人物弧光与动量因果链；
2. **工具链**：推荐使用 影伴 画布与 Studio，结合张导电影级分镜 Skill；
3. **交付规格**：1080P/4K H.264 MP4，包含完整画外音或对白音频；
4. **奖项设置**：
   - 最佳导演奖：50,000 算力 + ¥20,000 创作基金
   - 最佳视觉母版奖：25,000 算力
   - 工业级流水线效率奖：15,000 算力""",
            0, # whitelist_required: False
            50000,
            "ongoing",
            d14_iso,
            d30_iso,
            now_iso,
        ),
        (
            str(uuid.uuid4()),
            "48小时「张导分镜流」工业化创作极限挑战赛",
            "zhang-dao-48h-sprint",
            "限时 48 小时极速创作！使用张导专属电影级分镜导演 Skill，完成 30 秒高张力电影镜头序列编排，评审导师实时在线打分。",
            """### 赛程说明
- 统一开题时间发布指定情绪命题；
- 必须应用张导专属 Skill 动量因果链与 6:3:1 视觉空间层次规范；
- 优秀作品直接入选官方创作者展映单元。""",
            0,
            20000,
            "enrolling",
            d7_iso,
            d14_iso,
            now_iso,
        ),
        (
            str(uuid.uuid4()),
            "品牌商业短片征集令 · 赛博国潮主题",
            "cyber-chinese-commercial",
            "知名新消费品牌联合发起，征集具有强烈视听冲击力的 15 秒 3D 动漫/写实跨媒介概念宣传片，入选者直接直通商业接单库。",
            """### 参赛权益
- 优胜者直接签约官方商业任务认证创作者；
- 商业客户独家品牌授权素材库。""",
            1, # whitelist_required: True
            30000,
            "judging",
            now_iso,
            d7_iso,
            now_iso,
        ),
    ]

    for comp in competitions:
        exists = cur.execute("SELECT id FROM competitions WHERE slug=?", (comp[2],)).fetchone()
        if not exists:
            cur.execute(
                "INSERT INTO competitions VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                comp
            )
            print(f"Created competition: {comp[1]}")

    # 2. Certification Exams
    exam_id = str(uuid.uuid4())
    exam_prompt = """【影伴 官方认证创作者 · 综合实操考题（第一期）】
考核目标：验证创作者使用影视工业化管线的全流程实战能力。
考核题目：根据以下微短剧剧本片段，在画布中完成 3 组电影级分镜设计并生成对应动效视频：
「雨夜霓虹小巷深处，黑衣刀客缓步前行，侧逆冷光割裂水雾，水洼中倒映出追兵的身影。刀客驻足，右手拇指顶开刀谭，刀刃微鸣。」
考评维度：
1. 空间与光影（30%）：符合 6:3:1 视觉层次与真实光影物理响应；
2. 镜头动量（40%）：起步发力、运动轨迹与减速对位自然，无肢体漂移；
3. 配音与声效（30%）：合理分配对白及环境背景音轨。"""

    existing_exam = cur.execute("SELECT id FROM certification_exams WHERE version='1.0'").fetchone()
    if not existing_exam:
        cur.execute(
            "INSERT INTO certification_exams VALUES (?,?,?,?,?)",
            (exam_id, exam_prompt, "1.0", 1, now_iso)
        )
        print("Created certification exam v1.0")

    # 3. Commercial Tasks (覆盖三大业务板块: 新媒体可视化 / 信息流短视频运营 / AI短剧创作; 包含新手带教单与标准商业单)
    tasks = [
        # --- 业务板块 1: AI 短剧创作 ---
        (
            str(uuid.uuid4()),
            "玄幻修仙爆款短剧 · 前三集高燃分镜编排与出片",
            "短剧分镜",
            """### 需求说明
- **剧本背景**：头部小说 IP 改编短剧《万界归宗》前三集开篇；
- **交付内容**：每集 15~20 个分镜镜头，需保持核心角色定妆一致性；
- **风格要求**：东方修仙玄幻写实，光影具备宏大纵深感；
- **结算节点**：分镜确认后结算 40%，成片导出并交付后结算 60%。""",
            350000, # ¥3,500
            "standard",
            None,
            None,
            d7_iso,
            "published",
            0,
            now_iso,
            "ai_drama",
            json.dumps({"format": "9:16", "resolution": "1080P", "duration_seconds": 180, "deliverable_count": 3, "fps": 30, "assets_included": ["连续分镜流", "角色定妆卡", "成片MP4"]}, ensure_ascii=False),
            "fixed",
            350000,
            350000,
            "milestone",
            json.dumps([{"stage": "分镜脚本与资产锁定", "percentage": 40, "description": "完成前三集分镜草图与关键角色定妆卡"}, {"stage": "成片终审交付", "percentage": 60, "description": "交付无水印成片及工程包"}], ensure_ascii=False),
            json.dumps({"scope": "短剧全平台发行与商业播放", "allow_derivative": True, "require_ai_label": True}, ensure_ascii=False),
            json.dumps(["角色定妆跨镜头面部一致性", "遵守 180 度轴线，无镜头穿帮", "情绪括号对白音画对位偏差≤0.15s"], ensure_ascii=False),
            json.dumps([{"title": "万界归宗样片参考", "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"}], ensure_ascii=False),
            "聚星互娱短剧影业",
            "standard",
        ),
        (
            str(uuid.uuid4()),
            "现代悬疑微短剧 · 密室反转高光片段分镜制作",
            "影视分镜",
            """### 需求说明
- **剧本节拍**：2 分钟密闭空间对话与情绪因果链反转；
- **技术规范**：严格遵守轴线规范，避免 180 度越轴；
- **音频要求**：对白带情绪括号，需合成双声道环境雨声。""",
            240000, # ¥2,400
            "standard",
            None,
            None,
            d7_iso,
            "published",
            0,
            now_iso,
            "ai_drama",
            json.dumps({"format": "16:9", "resolution": "4K", "duration_seconds": 120, "deliverable_count": 1, "fps": 25, "assets_included": ["分镜工程", "分轨音频", "成片MP4"]}, ensure_ascii=False),
            "fixed",
            240000,
            240000,
            "milestone",
            json.dumps([{"stage": "分镜与机位轴线确认", "percentage": 50, "description": "密室平面站位与机位轴线图"}, {"stage": "成片交付", "percentage": 50, "description": "4K 渲染成片与双声道混音"}], ensure_ascii=False),
            json.dumps({"scope": "院线网络短片与影节参展", "allow_derivative": false, "require_ai_label": True}, ensure_ascii=False),
            json.dumps(["严格执行密室空间轴线", "情绪递进符合剪辑节奏律动", "暗部细节噪点克制"], ensure_ascii=False),
            json.dumps([{"title": "密室光影氛围参考", "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"}], ensure_ascii=False),
            "黑石映画工作室",
            "standard",
        ),
        # --- 业务板块 2: 信息流短视频与账号运营内容 ---
        (
            str(uuid.uuid4()),
            "高端新能源汽车 30 秒未来科技概念片",
            "商业广告",
            """### 需求说明
- **品牌调性**：极简、未来主义、硬朗工业美学；
- **关键镜头**：车身流线侧逆光、智能光幕交互特写、高速弯道动态运镜；
- **交付格式**：4K 60fps 电影比例画幅。""",
            680000, # ¥6,800
            "pro",
            None,
            None,
            d14_iso,
            "published",
            0,
            now_iso,
            "short_video_flow",
            json.dumps({"format": "16:9", "resolution": "4K", "duration_seconds": 30, "deliverable_count": 1, "fps": 60, "assets_included": ["4K 60fps 成片", "分层渲染序列", "音效工程"]}, ensure_ascii=False),
            "fixed",
            680000,
            680000,
            "milestone",
            json.dumps([{"stage": "视觉母版与运镜动态样片", "percentage": 40, "description": "车辆漆面光影反差与侧逆光母版"}, {"stage": "高清母带交付", "percentage": 60, "description": "4K 60fps ProRes 终版"}], ensure_ascii=False),
            json.dumps({"scope": "全球数字媒体与车展大屏投放", "allow_derivative": True, "require_ai_label": false}, ensure_ascii=False),
            json.dumps(["车身光影流线严丝合缝无畸变", "60fps 高帧率运镜流畅无丢帧卡顿", "工业科技感音效与转场节拍精准合轴"], ensure_ascii=False),
            json.dumps([{"title": "车身流线参考样片", "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"}], ensure_ascii=False),
            "极光新能源汽车科技",
            "pro",
        ),
        (
            str(uuid.uuid4()),
            "美妆爆款口播切片 · 5条日更投放短视频（新手带教单）",
            "短视频运营",
            """### 需求说明
- **交付内容**：5 条 15 秒垂直类美妆短视频，包含痛点切入、质地微距展示、效果前后对比与转化 Hook；
- **适合对象**：新手与兼职创作者，内含标准分镜脚本模板与配音干音，依模板直接合成出片即可！""",
            80000, # ¥800
            "beginner",
            None,
            None,
            d7_iso,
            "published",
            0,
            now_iso,
            "short_video_flow",
            json.dumps({"format": "9:16", "resolution": "1080P", "duration_seconds": 15, "deliverable_count": 5, "fps": 30, "assets_included": ["5条短视频MP4", "带货口播字幕包"]}, ensure_ascii=False),
            "fixed",
            80000,
            80000,
            "one_time",
            json.dumps([{"stage": "5条成品验收", "percentage": 100, "description": "一次性验收发放"}], ensure_ascii=False),
            json.dumps({"scope": "抖音/快手平台信息流信息广告", "allow_derivative": false, "require_ai_label": True}, ensure_ascii=False),
            json.dumps(["前3秒 Hook 黄金吸睛完播率设计", "字幕排版清晰符合信息流规范", "人声音量均衡无破音"], ensure_ascii=False),
            json.dumps([{"title": "美妆口播切片标准模板", "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"}], ensure_ascii=False),
            "梵花美妆 MCN 矩阵",
            "beginner",
        ),
        # --- 业务板块 3: 新媒体可视化内容 ---
        (
            str(uuid.uuid4()),
            "国风古韵美妆护肤品宣传片分镜与角色定妆",
            "品牌宣传",
            """### 需求说明
- **画面风格**：宋代理学克制美学、淡雅水墨与现代微距质感融合；
- **交付产物**：定妆三视图设定卡 1 套 + 15 秒动态分镜序列。""",
            180000, # ¥1,800
            "standard",
            None,
            None,
            d14_iso,
            "published",
            0,
            now_iso,
            "visual_content",
            json.dumps({"format": "16:9", "resolution": "4K", "duration_seconds": 15, "deliverable_count": 1, "fps": 30, "assets_included": ["三视图卡片", "15s动态分镜", "超清主KV图"]}, ensure_ascii=False),
            "fixed",
            180000,
            180000,
            "one_time",
            json.dumps([{"stage": "终审交付", "percentage": 100, "description": "三视图与15秒动态分镜"}], ensure_ascii=False),
            json.dumps({"scope": "天猫旗舰店首页与小红书官方图文", "allow_derivative": True, "require_ai_label": True}, ensure_ascii=False),
            json.dumps(["符合宋代水墨意境质感", "皮肤材质自然透亮不油腻", "三视图比例严密统一"], ensure_ascii=False),
            json.dumps([{"title": "宋韵克制美学画风参考", "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"}], ensure_ascii=False),
            "青黛东方草本护肤",
            "standard",
        ),
        (
            str(uuid.uuid4()),
            "国潮茶饮新品发布 · 4套电商主图与小红书KV海报（新手带教单）",
            "电商视觉",
            """### 需求说明
- **需求概述**：某新茶饮品牌夏日新品，需制作 4 套高颜值电商主图与详情页海报；
- **新手福利**：提供产品真实白底 3D 模型与背景色卡，根据带教提示词库出图交付，适合刚入门的新手创作者快速积累案例！""",
            50000, # ¥500
            "beginner",
            None,
            None,
            d7_iso,
            "published",
            0,
            now_iso,
            "visual_content",
            json.dumps({"format": "3:4", "resolution": "2K", "duration_seconds": 0, "deliverable_count": 4, "fps": 0, "assets_included": ["4张高分辨率电商主图PNG", "分层PSD工程"]}, ensure_ascii=False),
            "fixed",
            50000,
            50000,
            "one_time",
            json.dumps([{"stage": "4套主图交付", "percentage": 100, "description": "海报成稿交付一次性放款"}], ensure_ascii=False),
            json.dumps({"scope": "电商店铺与社交媒体推广", "allow_derivative": false, "require_ai_label": false}, ensure_ascii=False),
            json.dumps(["杯体杯身折射质感晶莹剔透", "果肉与水珠细节自然丰富", "文字排版呼吸感良好"], ensure_ascii=False),
            json.dumps([{"title": "茶饮海报质感参考", "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"}], ensure_ascii=False),
            "山野茶语品牌部",
            "beginner",
        ),
    ]

    for t in tasks:
        exists = cur.execute("SELECT id FROM commercial_tasks WHERE title=?", (t[1],)).fetchone()
        if not exists:
            cur.execute(
                "INSERT INTO commercial_tasks (id,title,category,brief_markdown,bounty_cents,required_level,claimed_by,claim_time,deadline,status,version,created_at,demand_type,deliverable_specs_json,budget_mode,budget_min_cents,budget_max_cents,settlement_mode,milestone_specs_json,copyright_terms_json,acceptance_criteria_json,reference_media_json,client_name,level_tier) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                t
            )
            print(f"Created commercial task: {t[1]}")

    # 4. Academy Courses & Templates
    courses = [
        (
            str(uuid.uuid4()),
            "电影级 AIGC 导演实战营 · 张导专属分镜流核心方法论",
            "系统拆解 35mm 胶片光学逻辑、镜头动量因果链与情绪肌肉系统，教你从小白进阶影视工业化导演。",
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            "published",
        ),
        (
            str(uuid.uuid4()),
            "网文小说快速拆解多集短剧全流程工业流水线",
            "从大纲切分、场次提取、动作△指令化到情绪括号对白生成，全面提效短剧编剧与前期分镜。",
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
            "published",
        ),
        (
            str(uuid.uuid4()),
            "6:3:1 视觉空间层次与光影母版防漂移秘籍",
            "深度解析主体 60% / 环境 30% / 细节 10% 黄金构图法，锁定布光物理响应，彻底解决跨镜头风格跳脱痛点。",
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            "published",
        ),
        (
            str(uuid.uuid4()),
            "CosyVoice 与 Qwen3 声音复刻与四维角色配音实操",
            "通过声音样本快速复刻专属角色音色，结合自然语言指令与情绪控制，实现专业录音棚级对白合成。",
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
            "published",
        ),
    ]

    for c in courses:
        exists = cur.execute("SELECT id FROM courses WHERE title=?", (c[1],)).fetchone()
        if not exists:
            cur.execute("INSERT INTO courses VALUES (?,?,?,?,?)", c)
            print(f"Created course: {c[1]}")

    templates = [
        (
            str(uuid.uuid4()),
            "【工业模板】赛博朋克科幻追逐戏 · 动态故事板标准工程",
            "template-cyber-chase-01",
            "1.0.0",
            json.dumps({"shots": 8, "style": "赛博朋克", "ratio": "16:9", "duration": "45s"}, ensure_ascii=False),
            "published",
        ),
        (
            str(uuid.uuid4()),
            "【工业模板】古风武侠竹林决战 · 张导 35mm 运镜规范工程",
            "template-wuxia-bamboo-02",
            "1.0.0",
            json.dumps({"shots": 12, "style": "新武侠写实", "ratio": "2.35:1", "duration": "60s"}, ensure_ascii=False),
            "published",
        ),
        (
            str(uuid.uuid4()),
            "【工业模板】现代都市都市悬疑 · 密室反转对话流工程",
            "template-suspense-room-03",
            "1.0.0",
            json.dumps({"shots": 10, "style": "冷色调胶片", "ratio": "16:9", "duration": "50s"}, ensure_ascii=False),
            "published",
        ),
    ]

    for tmpl in templates:
        exists = cur.execute("SELECT id FROM templates WHERE title=?", (tmpl[1],)).fetchone()
        if not exists:
            cur.execute("INSERT INTO templates VALUES (?,?,?,?,?,?)", tmpl)
            print(f"Created template: {tmpl[1]}")

    conn.commit()
    conn.close()
    print("Platform business data successfully seeded!")

if __name__ == "__main__":
    db = sys.argv[1] if len(sys.argv) > 1 else "output/platform.db"
    seed_platform_data(db)
