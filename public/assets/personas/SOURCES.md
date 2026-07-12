# 人物素材来源

## 孔子

### 肖像

- 文件：`confucius/portrait.webp`
- 原始文件：`assets-source/personas/confucius/portrait-source.jpg`
- 名称：`Confucius 1727.jpg`
- 描述：1727 年西安府石刻中的孔子形象，作者不详
- 来源：https://commons.wikimedia.org/wiki/File:Confucius_1727.jpg
- 原始记录：https://catalog.hathitrust.org/Record/001257696
- 权利状态：Public Domain；Wikimedia Commons 文件页标记为公有领域
- 处理：缩放并转换为 WebP；页面通过 CSS 统一为低饱和档案风

### 时代背景

- 文件：`confucius/background.webp`
- 原始文件：`assets-source/personas/confucius/background-source.png`
- 来源：项目开发阶段使用内置图像生成工具生成
- 用途：春秋时期鲁国学者书房的固定背景
- 处理：转换为 WebP；运行时不调用生图 API

### 竹简

- 文件：`confucius/paper.png`
- 原始文件：`assets-source/personas/confucius/paper-source.png`
- 来源：项目开发阶段使用内置图像生成工具生成并进行一次背景修正
- 用途：正交俯视的固定空白竹简书写载体
- 处理：对模型输出的白色背景执行色键 Alpha 后处理，缩放为 1000 × 1000 RGBA PNG
