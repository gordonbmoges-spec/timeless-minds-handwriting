# 跨时代思想档案馆

一个以手写为入口的历史人物互动 Web 应用。用户可以选择孔子、苏格拉底、达·芬奇、莎士比亚、荣格或爱因斯坦，在人物对应的时代场景中用鼠标、触屏或 Apple Pencil 写下问题。视觉模型识别字迹后，会按照服务器维护的人物思想边界生成一封短回信。

在线演示：[timeless-minds-teng.ivory-titan-4292.chatgpt.site](https://timeless-minds-teng.ivory-titan-4292.chatgpt.site)

在线演示默认不包含任何 API Key。未配置模型时会进入演示模式。`chatgpt.site` 在中国大陆网络环境下不能保证免 VPN 访问；需要面向国内用户时，应将本项目部署到国内可达的域名和托管服务。

## 产品能力

- 六位历史人物及六套独立场景、肖像和书写载体
- Canvas 鼠标、触控和 Apple Pencil 输入
- 合并采样点、压力平滑、手掌触控过滤和增量绘制
- 停笔自动提交、手动发送、橡皮和清空
- 视觉模型识别手写 PNG，并生成 40 至 80 字的人物回信
- 服务器端人物白名单和人物提示词，不接受客户端任意系统提示词
- 每个人物独立的本地历史记录与回复偏好
- PWA 主屏幕入口和人物直达路由
- 无 Key 演示模式

人物回复属于 AI 演绎，不代表真实历史人物发言，也不应视为心理、医疗、法律或投资建议。

## 本地运行

要求 Node.js 18 或更高版本，推荐 Node.js 22。

```sh
npm ci
npm run dev
```

打开终端显示的地址，默认是 `http://localhost:3107`。端口被占用时，服务器会自动尝试后续端口。

运行验证：

```sh
npm run check
npm test
npm run build
npm audit --audit-level=high
npm run security:secrets -- --history
```

## 配置视觉模型

不配置模型即可使用人物演示回复。接入真实识别时，复制环境文件：

```sh
cp .env.example .env
```

然后在 `.env` 中设置支持图片输入、兼容 Chat Completions 的模型服务：

```dotenv
AI_API_KEY=replace-with-your-key
AI_BASE_URL=https://your-provider.example/v1
AI_MODEL=your-vision-model
```

`.env` 已被 git 忽略。不要把真实 Key 写入 README、截图、Issue、日志或提交历史。

网页也支持访客提供自己的模型配置。整套配置只存在于当前页面的 JavaScript 内存中，API Key 通过 HTTPS 发送到同源后端。刷新或关闭页面会清除所有模型配置。

公开部署时，不建议直接暴露运营方自己的服务器 Key。若要这样做，必须额外增加登录鉴权、请求限流、供应商额度上限、监控和滥用处置。详细边界见 [SECURITY.md](SECURITY.md) 和 [PRIVACY.md](PRIVACY.md)。

## 项目结构

```text
public/                     浏览器应用、人物素材与 PWA 文件
public/modules/             路由、手写、回复和历史模块
lib/personas.js             服务器端人物注册表与提示词内核
server.js                   本地 Node.js 服务和 AI 代理
worker/                     Cloudflare Workers 兼容入口
test/                       Node.js 自动化测试
scripts/                    素材处理与密钥扫描工具
assets-source/              处理前的人物素材源文件
docs/                       产品设计和实施计划
```

## 安全设计

- 请求体上限为 8 MiB，只接受 PNG Data URL
- 只接受登记过的人物 ID
- 客户端回复偏好限制为 300 字，不能覆盖服务器人物规则
- 自定义模型地址必须使用 HTTPS，并拒绝常见本机和私网地址
- API Key、请求正文、手写图片和模型正文不会被应用主动写入日志
- 页面设置 CSP、防嵌套、MIME 嗅探防护、权限策略和引用来源策略
- GitHub Actions 会运行测试、构建、依赖审计、提交历史密钥扫描和 CodeQL
- Dependabot 每周检查 npm 与 GitHub Actions 更新

安全扫描用于降低误提交风险，不能替代密钥轮换、供应商侧额度限制和生产基础设施防护。

## 数据与素材

对话历史和人物回复偏好默认只保存在当前浏览器。启用 AI 后，手写裁剪图和必要上下文会发送到配置的模型服务商。项目本身不包含用户账号、云端历史数据库、广告或分析 SDK。

历史肖像来源、作者、处理方式和权利状态记录在 [人物素材来源](public/assets/personas/SOURCES.md)。代码使用 MIT License；字体、历史肖像和生成素材的许可边界见 [ASSETS-LICENSE.md](ASSETS-LICENSE.md)。

## 部署

`npm run build` 会生成 Cloudflare Workers 兼容的 `dist/`。也可以继续使用 `server.js` 部署到支持 Node.js 的平台。生产环境必须使用 HTTPS，并在启用运营方模型 Key 前完成鉴权、限流和隐私说明。

## 致谢

产品机制参考了 `MaximeRivest/riddle` 的手写交互思路，但人物系统、场景、前后端实现和素材处理均为本项目的独立实现。
