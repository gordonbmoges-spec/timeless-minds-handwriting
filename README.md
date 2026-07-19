# 会回应的藏书阁

一个以手写为入口的魔法书架式互动 Web 应用。九本内置藏书连接六位思想者与三个故事物件；用户也能装订自己的书，写下人物身份、性格、口吻与第一句话。视觉模型识别鼠标、触屏或 Apple Pencil 笔迹后，会按照每本书独立的人物边界生成短回信。

在线演示：[timeless-minds-teng.ymfreemantiffany8or1.chatgpt.site](https://timeless-minds-teng.ymfreemantiffany8or1.chatgpt.site)

在线演示默认不包含任何 API Key。未配置模型时会进入演示模式。`chatgpt.site` 在中国大陆网络环境下不能保证免 VPN 访问；需要面向国内用户时，应将本项目部署到国内可达的域名和托管服务。

## 产品能力

- 木质书架、九本书脊朝向读者的内置藏书，以及抽书、翻页、合书回架动画
- 所有书籍统一进入全屏羊皮纸书写面；右侧书脊显示当前书名，左缘可拉出人物、当前页、历史与记忆
- iPad 双指向内收拢可合上当前书籍并返回书架；左边缘右拉可展开当前书籍内容
- 六位历史人物，以及魔镜、汤姆日记和人皮纸三个非官方故事化入口
- 自定义添加书籍：书名、人物身份、性格、回答口吻、第一句话、封面颜色与徽记
- Canvas 鼠标、触控和 Apple Pencil 输入
- 合并采样点、压力平滑、手掌触控过滤和增量绘制
- 停笔自动提交、手动发送、橡皮和清空
- 视觉模型识别手写 PNG，并生成 40 至 80 字的人物回信
- 回信跟随用户提问语言，并参考人物作品在该语言中的原作或通行翻译传统
- 孔子中文回复可半文半白；外国人物中文回复采用成熟译本语感，不统一套用文言文
- 跨语言由界面作为透明翻译层，人物不假称掌握时代之外的语言，也不照搬特定现代译者
- 内置人物由服务器白名单维护；自定义人物只接受限长结构化资料，不接受客户端任意系统提示词
- 每本书独立的本地历史记录、回复偏好和可编辑长期记忆
- 英文使用 IM FELL English / Uncial Antiqua，中文使用 ZCOOL XiaoWei 与楷体回退
- PWA 主屏幕入口和人物直达路由
- 无 Key 演示模式

人物回复属于 AI 演绎，不代表真实历史人物发言，也不应视为心理、医疗、法律或投资建议。故事人物入口属于非官方致敬，不隶属于、不代表相关作者、出版社、影视公司或权利人；不包含原作全文、影视素材或官方人物图像。

## 语言与译介参考

人物提示词不仅标注抽象风格，还列出主要参考作品。生成时优先吸收原文、公共领域译本和目标语言中已经形成的通行术语与译介语感；不在运行时抓取网页，也不保存整部作品。对于仍受版权保护的现代译本，只参考高层语体特征，不复现长段文字或近似模仿某一位译者。

- 孔子：以《论语》原文、注疏和可靠全译本为谱系；中文可半文半白，其他语言采用当地《论语》译介形成的简练节奏
- 苏格拉底：以柏拉图对话录的问答结构及目标语言哲学译语为谱系
- 达·芬奇：以笔记和手稿选集的观察式短记为谱系
- 莎士比亚：英文参考戏剧与十四行诗原作，其他语言参考成熟戏剧翻译传统
- 荣格：以分析心理学原著、公共领域旧译和目标语言的通行心理学术语为谱系
- 爱因斯坦：以科普著作、公开演讲和书信的清楚论述为谱系

可核查的开放在线入口包括 [Chinese Text Project 的《论语》](https://ctext.org/analects)、[Project Gutenberg 的柏拉图《理想国》](https://www.gutenberg.org/ebooks/1497)、[列奥纳多笔记](https://www.gutenberg.org/ebooks/5000)、[莎士比亚全集](https://www.gutenberg.org/ebooks/100)、[荣格作品目录](https://www.gutenberg.org/ebooks/author/44679)和[爱因斯坦作品目录](https://www.gutenberg.org/ebooks/author/1630)。这些链接用于研究和核查，不表示所有地区的版权状态完全相同；使用者仍应按所在地法律确认。

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
- 内置入口只接受服务器登记的人物 ID；自定义书籍使用受限 ID 和经过长度约束的结构化人物资料
- 客户端回复偏好限制为 300 字，不能覆盖服务器人物规则
- 长期记忆限制为 600 字，作为不受信任的上下文而非系统指令处理
- 自定义模型地址必须使用 HTTPS，并拒绝常见本机和私网地址
- API Key、请求正文、手写图片和模型正文不会被应用主动写入日志
- 页面设置 CSP、防嵌套、MIME 嗅探防护、权限策略和引用来源策略
- GitHub Actions 会运行测试、构建、依赖审计、提交历史密钥扫描和 CodeQL
- Dependabot 每周检查 npm 与 GitHub Actions 更新

安全扫描用于降低误提交风险，不能替代密钥轮换、供应商侧额度限制和生产基础设施防护。

## 数据与素材

对话历史、自定义书籍、人物回复偏好和长期记忆默认只保存在当前浏览器。启用 AI 后，手写裁剪图、人物资料、近期对话和必要记忆会发送到配置的模型服务商。项目本身不包含用户账号、云端历史数据库、广告或分析 SDK。

历史肖像来源、作者、处理方式和权利状态记录在 [人物素材来源](public/assets/personas/SOURCES.md)。代码使用 MIT License；字体、历史肖像和生成素材的许可边界见 [ASSETS-LICENSE.md](ASSETS-LICENSE.md)。

## 部署

`npm run build` 会生成 Cloudflare Workers 兼容的 `dist/`。也可以继续使用 `server.js` 部署到支持 Node.js 的平台。生产环境必须使用 HTTPS，并在启用运营方模型 Key 前完成鉴权、限流和隐私说明。

## 致谢

产品机制参考了 `MaximeRivest/riddle` 与 `Trentct/Riddle-iPad` 的手写交互思路，并参考用户提供的抖音演示视频对“停笔吸墨、逐笔回信、全屏纸面”的节奏做了重新设计；书脊书架、双指合书、人物系统、前后端实现和素材处理均为本项目的独立实现。
