# 实施计划：跨时代名人笔记 MVP

## 1. 概览

本计划把当前纯 HTML/CSS/Canvas/Node MVP 扩展为六位名人的“思想档案馆”。实施采用先基础、再孔子垂直切片、再逐人物扩展、最后实机验收的顺序。每个阶段都必须保持网站可运行，不能在六套素材和页面全部完成后才进行首次联调。

对应设计文档：`docs/superpowers/specs/2026-07-12-historical-persona-notebook-design.md`。

## 2. 已确认的架构决定

- 保留无构建步骤的浏览器原生 ES Modules 与轻量 Node 服务，不在第一版迁移框架。
- 首页使用人物档案墙；六位人物拥有独立场景模块，不做统一换皮页面。
- 六个场景共用手写输入、图片导出、AI 客户端、回复状态和 API 设置模块。
- 后端只接受白名单人物 ID；完整人物提示词不下发到浏览器。
- 背景与纸张均为预生成的本地素材，运行时不调用生图 API。
- 人物肖像来自可追溯的公共领域真实画像。
- Apple Pencil 优化在孔子切片阶段完成，后续场景直接复用。
- 第一版不加入跟随书写工具动画、多人圆桌、动态生图、长回答和 RAG。

## 3. 依赖关系

```text
源码基线与测试入口
    |
    +-- 服务器工厂与接口测试
    |       |
    |       +-- 人物白名单与提示词内核
    |               |
    |               +-- /api/reply 人物化
    |
    +-- 前端模块边界
            |
            +-- 人物档案墙与路由
            +-- 场景壳与素材清单
            +-- Apple Pencil 输入引擎
            +-- 单回复呈现引擎
                    |
                    +-- 孔子端到端切片
                            |
                            +-- 其余五位独立场景
                                    |
                                    +-- 响应式、性能、安全与实机验收
```

## 4. 任务列表

### 阶段一：建立可回归基础

## Task 1：建立当前 MVP 源码基线

**Description:** 清理不应进入版本控制的运行日志，确认当前未跟踪源码不含密钥，并把现有可运行 MVP 作为后续重构基线提交。此任务不改变用户可见行为。

**Acceptance criteria:**

- [ ] `.env`、日志、视觉伴随临时目录和生成缓存均被忽略。
- [ ] 仓库扫描未发现 API Key、Cookie、令牌或本机隐私数据。
- [ ] 当前网站和演示接口在基线提交后仍能运行。

**Verification:**

- [ ] `npm run check`
- [ ] `curl http://localhost:3107/` 返回 `200`
- [ ] 无 Key 的 `/api/reply` 返回 `mode: "demo"`
- [ ] `git status --short` 不显示日志或密钥文件

**Dependencies:** None

**Files likely touched:**

- `.gitignore`
- 当前未跟踪的 MVP 源码与静态资源

**Estimated scope:** Small

## Task 2：增加测试入口并拆出服务器工厂

**Description:** 将服务创建与监听解耦，使 Node 内置测试可以在随机端口启动服务；增加基础接口测试和前端语法检查脚本。

**Acceptance criteria:**

- [ ] 导入服务器模块不会自动占用端口。
- [ ] 命令行启动行为仍支持端口自动递增。
- [ ] 演示回复、静态文件、无效 JSON 和无效图片请求均有自动测试。

**Verification:**

- [ ] `npm test`
- [ ] `npm run check`
- [ ] `npm run dev` 后首页可访问

**Dependencies:** Task 1

**Files likely touched:**

- `package.json`
- `server.js`
- `test/server.test.js`

**Estimated scope:** Medium

## Task 3：定义人物注册表与后端提示词契约

**Description:** 建立前端公开人物元数据和后端私有人物内核。先完整实现六位人物的 ID、基础元数据、40 至 80 字限制、时代类比规则和禁止编造规则，暂不接场景页面。

**Acceptance criteria:**

- [ ] 六个稳定人物 ID 与公开元数据完整。
- [ ] 六份后端人物内核不能被静态文件路由访问。
- [ ] 未登记人物 ID 被拒绝，登记人物能返回对应内核。

**Verification:**

- [ ] `npm test -- --test-name-pattern="persona"`
- [ ] 静态访问后端提示词路径返回 `404`
- [ ] 单元测试覆盖六位人物和无效 ID

**Dependencies:** Task 2

**Files likely touched:**

- `public/data/personas.js`
- `lib/personas.js`
- `test/personas.test.js`

**Estimated scope:** Medium

## Task 4：人物化 `/api/reply` 接口

**Description:** 请求加入 `personaId`；后端验证白名单后组装人物内核、时代类比和最近上下文。响应增加识别状态，识别不清时返回可恢复结果而不是编造问题。

**Acceptance criteria:**

- [ ] 客户端无法上传或覆盖系统提示词。
- [ ] 有效人物请求包含对应人物的推理与口吻约束。
- [ ] 无效人物、识别不清和上游错误返回稳定错误码与中文消息。

**Verification:**

- [ ] `npm test -- --test-name-pattern="reply"`
- [ ] 使用本地 mock 上游验证六种人物提示词均被选中
- [ ] 错误响应和日志不包含 API Key

**Dependencies:** Task 3

**Files likely touched:**

- `server.js`
- `lib/personas.js`
- `test/reply.test.js`

**Estimated scope:** Medium

### Checkpoint A：接口基础

- [ ] 全部 Node 测试通过。
- [ ] 无 Key 演示模式仍可用。
- [ ] 人物白名单不能从浏览器篡改。
- [ ] 评审六份人物内核的首轮文本测试结果后再进入 UI。

### 阶段二：孔子垂直切片

## Task 5：建立素材清单与生产处理规则

**Description:** 定义背景、纸张和肖像的文件命名、尺寸、焦点区域、可写区域和许可字段。处理已确认的孔子背景与竹简样图，保留原始图并生成项目生产版本。

**Acceptance criteria:**

- [ ] 素材清单能描述背景裁切焦点和纸张可写矩形。
- [ ] 孔子背景为压缩 WebP，竹简为带有效透明边缘的 PNG。
- [ ] 孔子公共领域肖像包含来源、作者、年代和许可记录。

**Verification:**

- [ ] 图片尺寸、格式和文件大小检查通过。
- [ ] 透明通道和可写区域由脚本或像素检查验证。
- [ ] 断网时三项素材仍从本地加载。

**Dependencies:** Task 1

**Files likely touched:**

- `public/assets/personas/manifest.js`
- `public/assets/personas/confucius/background.webp`
- `public/assets/personas/confucius/paper.png`
- `public/assets/personas/confucius/portrait.webp`
- `public/assets/personas/SOURCES.md`

**Estimated scope:** Medium

## Task 6：实现人物档案墙与场景路由

**Description:** 将当前单页入口改为人物档案墙，使用公开元数据生成六个档案条目。实现无框架的 History API 路由或等价稳定路由，先只让孔子进入可用场景，其余人物明确显示“档案整理中”。

**Acceptance criteria:**

- [ ] 首页展示六位人物、年代、领域与载体。
- [ ] 孔子条目进入独立 URL，刷新后仍保持当前人物。
- [ ] 键盘和触屏均可选择人物，返回操作可靠。

**Verification:**

- [ ] Playwright 检查档案墙和孔子路由。
- [ ] 1440px、1024px、768px、390px 截图无重叠或溢出。
- [ ] 直接访问人物 URL 不返回 `404`。

**Dependencies:** Task 3, Task 5

**Files likely touched:**

- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `public/modules/router.js`

**Estimated scope:** Medium

## Task 7：实现可复用场景壳与孔子独立场景

**Description:** 建立桌面三栏、iPad 折叠栏和移动单栏的场景壳。孔子场景使用真实背景与竹简素材，Canvas 按素材清单精确覆盖可写区域。

**Acceptance criteria:**

- [ ] 孔子页面呈现左档案、中竹简、右关键词结构。
- [ ] 背景只裁切不拉伸，竹简保持比例。
- [ ] Canvas 在所有目标视口与竹简可写区对齐。

**Verification:**

- [ ] Playwright 截图和 Canvas 边界数值检查通过。
- [ ] 禁用纸张图片时基础竹简替代面仍可写。
- [ ] 页面旋转和 ResizeObserver 不清除已有笔迹。

**Dependencies:** Task 5, Task 6

**Files likely touched:**

- `public/modules/scene-shell.js`
- `public/scenes/confucius.js`
- `public/styles/scenes.css`
- `public/app.js`

**Estimated scope:** Medium

## Task 8：重构 Apple Pencil 输入引擎

**Description:** 从 `app.js` 提取独立输入引擎，加入合并事件采样、输入队列、曲线与压力平滑、增量墨迹层、手掌过滤和正确的指针捕获。

**Acceptance criteria:**

- [ ] 合并事件中的所有有效点进入最终笔迹。
- [ ] 快速书写不因 `pointerleave` 提前结束。
- [ ] 触摸、鼠标和手写笔均能正常工作；手写笔活动时忽略手掌触控。

**Verification:**

- [ ] `npm test -- --test-name-pattern="ink"`
- [ ] 合成高频输入测试验证点数、平滑和压力范围。
- [ ] 浏览器 Canvas 像素测试验证快速折线连续。
- [ ] Chrome Performance 记录中书写帧无持续长任务。

**Dependencies:** Task 7

**Files likely touched:**

- `public/modules/ink-engine.js`
- `public/modules/ink-renderer.js`
- `public/app.js`
- `test/ink-engine.test.js`

**Estimated scope:** Medium

## Task 9：提取单回复呈现引擎

**Description:** 将回复显现、单回复约束、重新落笔淡出和 10 秒自动淡出从 `app.js` 提取成可测试模块，并与场景的书写方向和墨色参数连接。

**Acceptance criteria:**

- [ ] 状态中最多存在一个可见回复。
- [ ] 新落笔触发 1.8 秒线性淡出。
- [ ] 无新输入时，10 秒后自动淡出；计时器在切换人物时被清理。

**Verification:**

- [ ] `npm test -- --test-name-pattern="reply presenter"`
- [ ] 浏览器像素检查验证淡出前后墨迹存在与清空。
- [ ] 快速手动发送不会产生两条重叠回复。

**Dependencies:** Task 7

**Files likely touched:**

- `public/modules/reply-presenter.js`
- `public/app.js`
- `public/styles/scenes.css`
- `test/reply-presenter.test.js`

**Estimated scope:** Medium

## Task 10：完成孔子端到端链路

**Description:** 连接孔子场景、优化后的输入引擎、人物化 API 和单回复呈现。处理慢请求、识别不清、失败重试和切换人物时的状态清理。

**Acceptance criteria:**

- [ ] 从档案墙进入孔子、书写、提交、识别、回复和淡出全部可用。
- [ ] 请求失败时用户笔迹保留并可重试。
- [ ] 演示模式与真实 API 模式都能完成流程。

**Verification:**

- [ ] Playwright 完整流程测试通过。
- [ ] 本地 mock 模型覆盖成功、慢响应、识别不清和上游失败。
- [ ] iPad 视口横竖屏截图与交互检查通过。

**Dependencies:** Task 4, Task 8, Task 9

**Files likely touched:**

- `public/app.js`
- `public/modules/ai-client.js`
- `public/scenes/confucius.js`
- `test/e2e/confucius.spec.js`

**Estimated scope:** Medium

### Checkpoint B：孔子切片

- [ ] 孔子场景完成真实素材、手写、AI 和回复闭环。
- [ ] 自动测试全部通过。
- [ ] 用户在实际 iPad 上完成一次 Apple Pencil 体验确认。
- [ ] 未通过该检查时，不批量生成和接入其余五位素材。

### 阶段三：逐人物扩展

以下每项都遵循同一完成定义：确认生图提示词、生成背景与纸张、获取公共领域肖像、记录来源、实现独立场景、接入人物内核，并完成同题对比测试。

## Task 11：苏格拉底独立场景

**Acceptance criteria:**

- [ ] 雅典石廊背景、蜡板纸张和真实肖像全部本地化。
- [ ] 刻写视觉与连续追问式短回复明显区别于孔子。
- [ ] 现代问题能使用古希腊概念进行时代类比。

**Verification:**

- [ ] 场景视觉、路由和 API 自动测试通过。
- [ ] 使用三组固定问题与孔子输出做差异检查。

**Dependencies:** Checkpoint B

**Files likely touched:**

- `public/scenes/socrates.js`
- `public/assets/personas/socrates/*`
- `public/assets/personas/SOURCES.md`
- `lib/personas.js`

**Estimated scope:** Medium

## Task 12：达·芬奇独立场景

**Acceptance criteria:**

- [ ] 工作室背景、棉麻手稿纸和真实肖像全部本地化。
- [ ] 页面包含克制的观察草图语义，但不遮挡书写区。
- [ ] 回复以观察、结构和实验为核心，不伪造手稿内容。

**Verification:**

- [ ] 场景视觉、路由和 API 自动测试通过。
- [ ] 三组固定问题的人物差异检查通过。

**Dependencies:** Checkpoint B

**Files likely touched:**

- `public/scenes/davinci.js`
- `public/assets/personas/davinci/*`
- `public/assets/personas/SOURCES.md`
- `lib/personas.js`

**Estimated scope:** Medium

## Task 13：莎士比亚独立场景

**Acceptance criteria:**

- [ ] 烛光书桌、布纹纸和真实肖像全部本地化。
- [ ] 羽毛笔语义仅作为静态环境元素，不实现跟随动画。
- [ ] 回复保持诗性和戏剧隐喻，同时不编造真实台词。

**Verification:**

- [ ] 场景视觉、路由和 API 自动测试通过。
- [ ] 三组固定问题的人物差异检查通过。

**Dependencies:** Checkpoint B

**Files likely touched:**

- `public/scenes/shakespeare.js`
- `public/assets/personas/shakespeare/*`
- `public/assets/personas/SOURCES.md`
- `lib/personas.js`

**Estimated scope:** Medium

## Task 14：荣格独立场景

**Acceptance criteria:**

- [ ] 瑞士分析室、私人笔记纸和真实肖像全部本地化。
- [ ] 象征图形为原创通用元素，不复制特定受保护作品。
- [ ] 回复围绕原型、阴影和个体化，不提供诊断或治疗结论。

**Verification:**

- [ ] 场景视觉、路由和 API 自动测试通过。
- [ ] 三组固定问题的人物差异与非诊疗检查通过。

**Dependencies:** Checkpoint B

**Files likely touched:**

- `public/scenes/jung.js`
- `public/assets/personas/jung/*`
- `public/assets/personas/SOURCES.md`
- `lib/personas.js`

**Estimated scope:** Medium

## Task 15：爱因斯坦独立场景

**Acceptance criteria:**

- [ ] 普林斯顿书桌、方格草稿纸和真实肖像全部本地化。
- [ ] 公式只作为通用环境符号，不伪造特定手稿。
- [ ] 回复突出思想实验、假设拆解和简化推理。

**Verification:**

- [ ] 场景视觉、路由和 API 自动测试通过。
- [ ] 三组固定问题的人物差异检查通过。

**Dependencies:** Checkpoint B

**Files likely touched:**

- `public/scenes/einstein.js`
- `public/assets/personas/einstein/*`
- `public/assets/personas/SOURCES.md`
- `lib/personas.js`

**Estimated scope:** Medium

### Checkpoint C：六位人物完整

- [ ] 六个场景都使用真实生产素材，不存在占位图。
- [ ] 六个路由的书写、接口、回复和淡出流程一致可用。
- [ ] 同题测试显示六位人物的语言与推理有明显差异。
- [ ] 素材来源与许可记录完整。

### 阶段四：质量与交付

## Task 16：响应式、无障碍与素材降级

**Description:** 系统检查所有场景在桌面、iPad 横竖屏和手机上的布局；补齐键盘焦点、动态状态朗读、减少动画模式和素材失败回退。

**Acceptance criteria:**

- [ ] 目标视口无文字重叠、横向溢出和 Canvas 错位。
- [ ] 键盘可完成选人、返回、发送、清空和 API 设置。
- [ ] 背景或纸张失败时仍有可写的代码备用面。

**Verification:**

- [ ] Playwright 多视口截图测试通过。
- [ ] `prefers-reduced-motion` 测试通过。
- [ ] 人工键盘流程和屏幕阅读动态状态检查通过。

**Dependencies:** Checkpoint C

**Files likely touched:**

- `public/styles.css`
- `public/styles/scenes.css`
- `public/app.js`
- `test/e2e/responsive.spec.js`

**Estimated scope:** Medium

## Task 17：安全、性能与长时间书写检查

**Description:** 收紧 API 输入、历史长度、请求体和日志；检查图片体积、首屏加载、Canvas 内存和连续书写性能。

**Acceptance criteria:**

- [ ] 任意人物 ID、恶意 URL 和超大历史输入均被拒绝或裁剪。
- [ ] 日志不包含密钥、完整图片数据或私人日记正文。
- [ ] 连续书写五分钟后内存和帧耗时不持续恶化。

**Verification:**

- [ ] 安全接口测试通过。
- [ ] 素材总量和单图大小满足预算。
- [ ] Chrome Performance 与 Canvas 像素检查通过。

**Dependencies:** Task 16

**Files likely touched:**

- `server.js`
- `lib/personas.js`
- `public/modules/ink-engine.js`
- `test/security.test.js`

**Estimated scope:** Medium

## Task 18：真实 iPad 验收与使用文档

**Description:** 在真实 iPad Safari 与主屏幕模式完成 Apple Pencil 验收，记录设备、系统、浏览器、问题和结果；更新运行、API 配置、素材来源及已知限制文档。

**Acceptance criteria:**

- [ ] 快速横线、圆圈、折线和连续中文无明显断线。
- [ ] 压感、掌托过滤、横竖屏旋转和五分钟连续书写通过。
- [ ] README 能让新环境启动、配置 API 并理解 AI 演绎边界。

**Verification:**

- [ ] `npm test`
- [ ] `npm run check`
- [ ] 六人物 Playwright 流程通过。
- [ ] iPad 实机验收记录由用户确认。

**Dependencies:** Task 17

**Files likely touched:**

- `README.md`
- `docs/qa/ipad-pencil-acceptance.md`
- `public/manifest.webmanifest`
- `public/sw.js`

**Estimated scope:** Medium

### Checkpoint D：MVP 完成

- [ ] 设计文档全部验收标准有对应证据。
- [ ] 自动测试、桌面与移动截图、接口安全测试通过。
- [ ] iPad Apple Pencil 实机验证完成；若缺少实机操作，状态必须标为 `partial`，不能称为完全通过。
- [ ] 没有密钥、临时素材、日志或视觉伴随文件进入发布包。

## 5. 并行机会

在 Checkpoint B 通过后，Task 11 至 Task 15 的素材生成与人物内核初稿可以并行，但必须遵守：

- 先锁定素材清单和场景模块接口。
- 每位人物使用独立目录，避免修改同一场景文件。
- `lib/personas.js` 的合并由单一负责人顺序完成。
- 每组 AI 素材都需人工确认后再进入生产目录。

Task 16 至 Task 18 必须在六个场景合并后顺序执行。

## 6. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| AI 素材氛围好但可写区域不稳定 | 高 | 背景与纸张分开生成；纸张使用正交视角和显式可写矩形 |
| 六套独立页面导致代码重复 | 高 | 场景模块只拥有布局和素材参数，输入/API/回复引擎共用 |
| Apple Pencil 在模拟测试正常、实机仍断续 | 高 | 孔子切片后立即做实机检查，未通过不扩展五位场景 |
| 人物回复像通用 AI | 高 | 固定问题差异测试；每位人物配置推理路径而非只改语气 |
| 公共领域肖像许可不清 | 中 | 只使用权属明确的博物馆、图书馆或 Wikimedia 来源并记录证据 |
| 图片总量拖慢 iPad 首屏 | 中 | WebP、响应式尺寸、按人物延迟加载和明确素材预算 |
| 角色扮演制造伪名言 | 高 | 提示词禁止引号式伪引用；自动与人工事实检查 |
| 当前源码尚未提交 | 高 | Task 1 先建立无密钥基线，后续每个检查点独立提交 |

## 7. 计划完成条件

- [ ] 每项任务都有可测试的验收条件和验证命令。
- [ ] 高风险的 Apple Pencil 与孔子端到端链路在批量扩展前完成。
- [ ] 任一任务预计触及超过五个逻辑文件时继续拆分。
- [ ] 用户确认本计划后才开始 Task 1。

## 8. 人工配合点

实施过程只需要两次明确人工配合：

1. Checkpoint B：用户在 iPad 上体验孔子场景的 Apple Pencil 跟手度。
2. Checkpoint D：用户完成六人物最终 iPad 实机验收。

除此之外，素材生成、来源整理、代码、自动测试和桌面/移动截图由实现过程自行完成。
