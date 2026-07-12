# 墨影笔记 Web MVP

一个参考 `MaximeRivest/riddle` 交互思路的网页版 MVP：用户在纸面上用鼠标、触控板或手写笔写字，停笔后墨迹淡出，后端读取手写 PNG，AI 生成短回复，前端用手写字体和采样到的笔画粗细、倾斜、节奏做回信动画。

这不是 reMarkable 设备应用，也不依赖电子墨水屏。第一版重点验证网页产品体验。

## 运行

```sh
npm run dev
```

打开 `http://localhost:3107`。

如果 `3107` 已经被别的本地项目占用，服务会自动尝试 `3108`、`3109` 等后续端口，终端会打印实际 URL。

未配置 API Key 时会进入演示模式，完整展示交互，但不识别真实手写内容。

## iPad 本地 Demo APP

1. 让 iPad 和这台 Mac 连接同一个 Wi-Fi。
2. 在 iPad Safari 打开 Mac 的局域网地址，例如 `http://192.168.1.61:3107`。
3. 点击 Safari 分享按钮，选择“添加到主屏幕”。
4. 回到 iPad 主屏幕后，点击“墨影笔记”图标即可像本地 APP 一样进入演示。

本地 IP 的 HTTP 页面可以作为主屏幕 APP 打开，但浏览器不会把它当作 HTTPS 安全源。需要离线缓存或正式安装体验时，应改用 HTTPS 域名或本机可信证书。

## 接入真实 AI

```sh
cp .env.example .env
```

推荐国内先用阿里云百炼 / 通义千问视觉模型：

```sh
AI_API_KEY=你的阿里云百炼 API Key
AI_BASE_URL=https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
AI_MODEL=qwen3-vl-plus
```

其中 `{WorkspaceId}` 是百炼控制台里的业务空间 ID。也可以换成任何兼容 `/chat/completions` 且支持图片输入的服务。

这个 MVP 需要的是“图片输入、文本输出”的多模态大模型 API，不是生图 API。前端会把你手写的纸面裁剪成 PNG，后端把这张 PNG 发给模型，让模型返回：

- `transcript`：识别出来的手写内容
- `reply`：要写回纸面的话

当前回信的手写动画是在浏览器 Canvas 里渲染出来的，不需要 AI 生图。

## 当前能力

- Canvas 纸面书写
- 鼠标、触控板、触屏、手写笔输入
- 笔 / 橡皮 / 立即发送 / 清空
- 停笔自动提交
- 手写内容裁剪为 PNG 发给后端
- 无 Key 演示模式
- OpenAI 兼容视觉模型接口
- 采样用户笔迹粗细、倾斜、字形大小、书写节奏
- 用本地 `Dancing Script` 字体生成手写回复动画
- 最近回信列表

## 后续版本建议

- 用户字迹训练页：采集字母、数字、常用中文偏旁和短句。
- 真正的个人字迹生成：把采样笔迹转成矢量字库、LoRA 或图像生成风格条件。
- 登录和云端历史：保存每个用户的笔迹档案和日记历史。
- 分享页面：生成一张可分享的回信纸面截图。

## 许可说明

本项目参考了 `MaximeRivest/riddle` 的产品机制，但实现为独立网页版。仓库中的 `DancingScript.ttf` 来自原项目使用的 Dancing Script 字体，许可证见 `public/assets/fonts/OFL-DancingScript.txt`。
