# MiniMax Image Generation API Reference (H3-Image & Image-01)

- **Source URL**: `https://api.minimaxi.chat/v1/image_generation` (Global: `https://api.minimax.io/v1/image_generation`)
- **Capture Date**: `2026-11-25`
- **Provider**: `minimax` (MiniMax / 海螺 AI)
- **Family**: `minimax`
- **Models**: `MiniMax-H3-Image`, `MiniMax-H3-Image-Highspeed`, `image-01`

## 1. Overview
MiniMax 官方开放平台提供的高性能文本到图像生成与多图参考图像编辑 API。
核心模型为 MiniMax H3-Image 旗舰版与高速版，基于 33.1B DiT 架构，原生支持 4K 高清、极速 10 秒级出图以及 1~16 张多参考图控制；同时支持高性价比轻量级 `image-01` 模型。

## 2. Authentication & Base Endpoints
- **Base URL (CN)**: `https://api.minimaxi.chat` (或 `https://api.minimax.chat`)
- **Base URL (Global)**: `https://api.minimax.io`
- **Auth Header**: `Authorization: Bearer <MINIMAX_API_KEY>`
- **Environment Variable**: `MINIMAX_API_KEY` (可配置 `MINIMAX_BASE_URL` 覆盖默认域名)

## 3. Endpoints
### POST `/v1/image_generation`
- **Content-Type**: `application/json`
- **Request Body Parameters**:
  - `model` (string, required): 模型名称，如 `MiniMax-H3-Image`, `MiniMax-H3-Image-Highspeed`, `image-01`
  - `prompt` (string, required): 提示词描述，最高支持 7,500 字符
  - `aspect_ratio` (string, optional): 宽高比，可选 `"16:9"`, `"9:16"`, `"1:1"`, `"4:3"`, `"3:4"`, `"21:9"` 等
  - `response_format` (string, optional): 默认为 `"url"`（返回 24 小时有效的图片下载链接）或 `"base64"`
  - `prompt_optimizer` (boolean, optional): 是否开启提示词语义增强，默认 `true`
  - `subject_reference` / `reference_images` (array, optional): 参考图像 URL 或 Base64 列表（最多支持 16 张）
  - `seed` (integer, optional): 随机种子，用于复现结果

## 4. Response Example
```json
{
  "data": {
    "image_urls": [
      "https://api.minimaxi.chat/files/retrieve/generated_image_xxx.png"
    ]
  },
  "base_resp": {
    "status_code": 0,
    "status_msg": "success"
  }
}
```

## 5. Common Status Codes
- `0`: 成功
- `1002`: 请求限流 (Rate Limit Exceeded)
- `1004`: API Key 错误或未授权
- `1008`: 账户余额不足
- `1026` / `2049`: 内容审核拦截
- `2013`: 参数非法
