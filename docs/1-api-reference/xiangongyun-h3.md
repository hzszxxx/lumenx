# 仙宫云 H3 (MiniMax H3 Self-Hosted) API Reference

- **Source URL**: `https://api.xiangongyun.com/open`
- **Capture Date**: `2026-11-24`
- **Provider**: `xiangongyun` (仙宫云)
- **Family**: `xiangongyun`
- **Model**: `h3-video` / `xiangongyun-h3-i2v` / `xiangongyun-h3-r2v`

## 1. Overview
仙宫云是按小时租赁的私有 GPU 算力云平台（提供 RTX 4090 / 4090D 等算力节点）。
MiniMax H3 自部署量化版（`minimax_h3_selfhost`）部署于仙宫云 GPU 实例上，作为 LumenX 算力分层中的草稿层与对白音画一体试产工具。

## 2. Supported Capabilities
- **I2V (Image-to-Video)**: 首帧驱动视频生成，支持原生音画对白生成。
- **R2V (Reference-to-Video)**: 支持 1~9 张角色/场景多参考图驱动视频生成。
- **Resolutions**: 768p (默认原生分辨率), 1080p
- **Durations**: 3 ~ 15 秒（默认 5 秒）
- **Audio**: 原生立体声及对白口型同步

## 3. OpenAPI Authentication & Instance Management
- **Base URL**: `https://api.xiangongyun.com`
- **Auth**: `Authorization: Bearer <XIANGONGYUN_ACCESS_TOKEN>`
- **Endpoints**:
  - `GET /open/whoami`: 查询账户昵称、手机号及 UUID
  - `GET /open/balance`: 查询账户余额
  - `GET /open/instances`: 查询 GPU 实例池状态（`name`, `gpu_model`, `status: running/stopped`, `price_per_hour`）
