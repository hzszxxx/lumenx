#!/usr/bin/env python3
"""
Register the 7 expert cinematic AI skills into platform database as system skills.
"""
import hashlib
import json
import sqlite3
import sys
import uuid
from datetime import datetime, timezone

PRESET_SKILLS = [
    {
        "name": "zhang-dao-director",
        "version": "1.0.0",
        "title": "张导专属 · 电影级分镜导演",
        "category": "shot",
        "description": "基于35mm胶片逻辑、动量因果链与20种情绪肌肉系统，输出Runway/可灵/Sora/Wan直接可用的专业镜头提示词与四维配音说明。",
        "prompt_template": """你是一名资深AI电影导演（张导专属体系）。基于当前镜头草稿、角色资产与故事上下文，产出电影级视听提示词：
1. 摄影参数：35mm光学质感、景深、真实布光拓扑（伦勃朗/侧逆光/漫射冷光）；
2. 动量因果：起始发力->运动轨迹->减速碰撞反馈，禁止肢体抽搐；
3. 神态与呼吸：结合面部微表情与呼吸起伏；
4. 四维配音：若有对白，标明[场景/人物状态/发声方式/台词]。
输入内容：{{input}}""",
        "expected_tools": ["canvas.readProject", "canvas.updateNodePrompt"],
    },
    {
        "name": "character-assets",
        "version": "1.0.0",
        "title": "角色资产 · 定妆三视图设定",
        "category": "story",
        "description": "剧本到角色/场景/道具全模态资产卡，支持真人写实与3D动漫双分支，强制中灰无影棚三视图定妆范式与排脏排油负向词池。",
        "prompt_template": """作为角色资产设计专家，从剧本文本中提取核心角色外形锚点，输出符合出图标准的定妆设定卡：
1. 双分支选择：真人写实摄影（Fashion editorial）或 3D动漫（Cel-shaded 3D）；
2. 强制棚拍范式：中灰无影墙正面/侧面/背面三视图，散射光，面部微纹理无油腻高光；
3. 服化道与配饰：固定专属标志色与配饰特写描述；
4. 负向词集成：排油、排脏、去塑料感。
输入文本：{{input}}""",
        "expected_tools": ["canvas.readProject", "canvas.updateNodePrompt"],
    },
    {
        "name": "scene-designer",
        "version": "1.0.0",
        "title": "场景设计 · 6:3:1 视觉空间层次",
        "category": "shot",
        "description": "以6:3:1空间层次（主视觉60%/环境30%/细节10%）构建具有电影纵深与真实光影物理响应的场景画面与提示词。",
        "prompt_template": """根据场景需求，应用 6:3:1 视觉空间层次构建电影级环境描述：
1. 主视觉（Dominant 60%）：主体建筑/地貌核心，第一眼视觉落点；
2. 环境支撑（Supporting 30%）：中远景空间纵深、透视线条与大气散射；
3. 趣味点缀（Accent 10%）：前景遮挡、高光点缀、冷暖光斑微反差；
4. 光影基准：明确主光源与环境反光材质响应。
输入内容：{{input}}""",
        "expected_tools": ["canvas.readProject", "canvas.updateNodePrompt"],
    },
    {
        "name": "aesthetic-director",
        "version": "1.0.0",
        "title": "风格审美 · 视觉母版与防漂移",
        "category": "story",
        "description": "智能层风格信号沉淀加导演层视觉母版，锁定色调权属与布光物理响应，杜绝空洞词与跨镜头风格漂移。",
        "prompt_template": """作为审美风格导演，为项目或场景制定高辨识度视觉母版：
1. 艺术媒介：明确胶片、镜头、反差特性；
2. 色彩权属：限定2-3种统治色相及冷暖互补关系；
3. 动态光效：定义运动高光与阴影拖尾语法；
4. 漂移拦截：生成专属负向提示词池，禁止风格跨镜头漂移。
输入剧本或题材：{{input}}""",
        "expected_tools": ["canvas.readProject", "canvas.updateNodePrompt"],
    },
    {
        "name": "novel-script-pipeline",
        "version": "1.0.0",
        "title": "小说转剧本 · 影视工业流水线",
        "category": "story",
        "description": "网文小说智能多集大纲切分，自动拆解场次、镜头动作描述△与带情绪括号对白，强化完播率反转钩子。",
        "prompt_template": """将输入的小说/网文文本转换为影视短剧标准场次剧本：
1. 分集结构：规划开头钩子、30秒情绪节拍点与集尾悬念；
2. 场次排版：场景标题行 [场次 地点 时间 内/外]；
3. 具象动作：动作描述统一以 △ 开头，写可拍摄动量，去心理独白；
4. 对白情绪：角色名（情绪/发声方式）：台词内容。
小说文本：{{input}}""",
        "expected_tools": ["canvas.readProject"],
    },
    {
        "name": "storyboard-inspector",
        "version": "1.0.0",
        "title": "分镜纠察 · 7阶段镜头质检",
        "category": "shot",
        "description": "覆盖动作戏与对话戏拆解、视听语言调用、信息梯递进检查与跨镜头一致性连戏审计。",
        "prompt_template": """作为分镜纠察主管，全面诊断分镜脚本的镜头语言与技术规范：
1. 轴线审查：检查相邻镜头是否存在 180 度越轴；
2. 信息递进：检查是否存在死镜、信息重复或景别单调；
3. 节奏与完播率：动作戏检查动态线因果链，对话戏检查正反打与反应镜头比例；
4. 提示词可执行度：将所有形容词纠察替换为参数化视听指令。
待审分镜：{{input}}""",
        "expected_tools": ["canvas.readProject", "canvas.updateNodePrompt"],
    },
    {
        "name": "video-reviewer",
        "version": "1.0.0",
        "title": "成片审核 · 20+故障诊断与重试",
        "category": "review",
        "description": "技术层/匹配层/导演层三层深度质检，诊断人物漂移、穿帮与抽搐，输出最小代价保守重试方案。",
        "prompt_template": """对 AI 生成的视频片段进行三层专业评审并给出最小代价修复建议：
1. 技术层：肢体畸变、面部漂移、手部多指、抽搐；
2. 匹配层：首尾帧连戏、站位穿帮、动势衔接不畅；
3. 导演层：视听张力、运动速度与剪辑点；
4. 修复方案：输出对应的 Prompt 修正、Seed 建议或运动幅度调节参数。
生成视频信息与提示词：{{input}}""",
        "expected_tools": ["canvas.readProject", "canvas.createVideoNode"],
    },
]

def register_preset_skills(db_path: str):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    for item in PRESET_SKILLS:
        raw_manifest = {
            "name": item["name"],
            "version": item["version"],
            "title": item["title"],
            "description": item["description"],
            "category": item["category"],
            "prompt_template": item["prompt_template"],
            "expected_tools": item["expected_tools"],
        }
        canonical = json.dumps(raw_manifest, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        content_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        
        # Check if version exists
        existing = cur.execute(
            "SELECT id FROM platform_skill_versions WHERE name=? AND version=? AND scope='system'",
            (item["name"], item["version"]),
        ).fetchone()

        if existing:
            skill_id = existing[0]
            cur.execute(
                "UPDATE platform_skill_versions SET manifest_json=?, content_hash=?, status='active' WHERE id=?",
                (canonical, content_hash, skill_id),
            )
            print(f"Updated skill: {item['name']} ({skill_id})")
        else:
            skill_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO platform_skill_versions VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (skill_id, item["name"], item["version"], "system", None, None, None, canonical, content_hash, "active", now_iso),
            )
            print(f"Created skill: {item['name']} ({skill_id})")

        # Check binding
        binding = cur.execute(
            "SELECT id FROM platform_skill_bindings WHERE name=? AND scope='system'",
            (item["name"],),
        ).fetchone()

        if binding:
            cur.execute(
                "UPDATE platform_skill_bindings SET skill_version_id=?, active=1, updated_at=? WHERE id=?",
                (skill_id, now_iso, binding[0]),
            )
        else:
            cur.execute(
                "INSERT INTO platform_skill_bindings VALUES (?,?,?,?,?,?,?,?,?)",
                (str(uuid.uuid4()), item["name"], "system", None, None, skill_id, 1, now_iso, now_iso),
            )

    conn.commit()
    conn.close()
    print("All 7 preset skills successfully registered and bound as active system skills!")

if __name__ == "__main__":
    db = sys.argv[1] if len(sys.argv) > 1 else "output/platform.db"
    register_preset_skills(db)
