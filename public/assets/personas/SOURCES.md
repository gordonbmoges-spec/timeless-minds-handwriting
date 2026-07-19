# 人物素材来源

## 魔镜

- 文件：`magic-mirror/background.webp`
- 来源：2026-07-19 使用项目书架中的魔镜实景作为视觉参考，通过内置图像生成工具生成
- 用途：魔镜书写与居中回复场景；画面不包含人物、可读文字、标志或现有作品商标
- 处理：转换为 WebP；运行时不调用生图 API

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

## 苏格拉底

### 肖像

- 文件：`socrates/portrait.webp`
- 原始文件：`assets-source/personas/socrates/portrait-source.jpg`
- 名称：`Bust of Socrates.JPG`
- 描述：被认为源自留西波斯原作的罗马复制胸像
- 来源：https://commons.wikimedia.org/wiki/File:Bust_of_Socrates.JPG
- 作者/上传者：Luciusmichael
- 权利状态：Public Domain；作者在 Wikimedia Commons 文件页声明将作品释放至公有领域
- 处理：裁切为竖版档案肖像并转换为 WebP

### 雅典石廊背景

- 文件：`socrates/background.webp`
- 原始文件：`assets-source/personas/socrates/background-source.png`
- 来源：项目开发阶段使用内置图像生成工具生成的固定精修素材
- 用途：古典雅典石廊氛围背景
- 处理：保留生成源图，压缩为 WebP；运行时不调用生图 API

### 蜡板

- 文件：`socrates/paper.png`
- 原始文件：`assets-source/personas/socrates/paper-source.png`
- 来源：项目开发阶段使用内置图像生成工具生成的固定精修素材
- 用途：正交俯视的蜡板书写载体
- 处理：从绿幕源图裁切，执行 Alpha 扣像、去绿溢色与尺寸规范化，输出 RGBA PNG

## 达·芬奇

### 肖像

- 文件：`da-vinci/portrait.webp`
- 原始文件：`assets-source/personas/da-vinci/portrait-source.jpg`
- 名称：`Leonardo self.jpg`
- 描述：通常称为列奥纳多·达·芬奇自画像的红粉笔头像
- 来源：https://commons.wikimedia.org/wiki/File:Leonardo_self.jpg
- 作者：Leonardo da Vinci
- 权利状态：Public Domain；Wikimedia Commons 文件页标记为二维公有领域作品的忠实复制
- 处理：裁切为竖版档案肖像并转换为 WebP

### 文艺复兴工作室背景

- 文件：`da-vinci/background.webp`
- 原始文件：`assets-source/personas/da-vinci/background-source.png`
- 来源：项目开发阶段使用内置图像生成工具生成的固定精修素材
- 用途：文艺复兴工作室氛围背景
- 处理：保留生成源图，压缩为 WebP；运行时不调用生图 API

### 手稿纸

- 文件：`da-vinci/paper.png`
- 原始文件：`assets-source/personas/da-vinci/paper-source.png`
- 来源：项目开发阶段使用内置图像生成工具生成的固定精修素材
- 用途：棉麻手稿纸书写载体
- 处理：从绿幕源图裁切，执行 Alpha 扣像、去绿溢色与尺寸规范化，输出 RGBA PNG

## 莎士比亚

### 肖像

- 文件：`shakespeare/portrait.webp`
- 原始文件：`assets-source/personas/shakespeare/portrait-source.jpg`
- 名称：`William Shakespeare Chandos Portrait.jpg`
- 描述：钱多斯肖像，通常被认为是威廉·莎士比亚画像
- 来源：https://commons.wikimedia.org/wiki/File:William_Shakespeare_Chandos_Portrait.jpg
- 作者：Unknown
- 权利状态：Public Domain；Wikimedia Commons 文件页标记为二维公有领域作品的忠实复制
- 处理：裁切为竖版档案肖像并转换为 WebP

### 烛光剧作书桌背景

- 文件：`shakespeare/background.webp`
- 原始文件：`assets-source/personas/shakespeare/background-source.png`
- 来源：项目开发阶段使用内置图像生成工具生成的固定精修素材
- 用途：伊丽莎白时代剧作书桌氛围背景
- 处理：保留生成源图，压缩为 WebP；运行时不调用生图 API

### 布纹纸

- 文件：`shakespeare/paper.png`
- 原始文件：`assets-source/personas/shakespeare/paper-source.png`
- 来源：项目开发阶段使用内置图像生成工具生成的固定精修素材
- 用途：布纹纸书写载体
- 处理：从绿幕源图裁切，执行 Alpha 扣像、去绿溢色与尺寸规范化，输出 RGBA PNG

## 荣格

### 肖像

- 文件：`jung/portrait.webp`
- 原始文件：`assets-source/personas/jung/portrait-source.jpg`
- 名称：`CGJung.jpg`
- 描述：卡尔·古斯塔夫·荣格肖像
- 来源：https://commons.wikimedia.org/wiki/File:CGJung.jpg
- 来源机构：Ortsmuseum Zollikon
- 作者：Unknown，上传者 Adrian Michael
- 权利状态：Public Domain；Wikimedia Commons 文件页标记为作者逝世 70 年规则下的公有领域并带 Public Domain Mark
- 处理：裁切为竖版档案肖像并转换为 WebP

### 瑞士分析室背景

- 文件：`jung/background.webp`
- 原始文件：`assets-source/personas/jung/background-source.png`
- 来源：项目开发阶段使用内置图像生成工具生成的固定精修素材
- 用途：瑞士分析室氛围背景
- 处理：保留生成源图，压缩为 WebP；运行时不调用生图 API

### 私人笔记纸

- 文件：`jung/paper.png`
- 原始文件：`assets-source/personas/jung/paper-source.png`
- 来源：项目开发阶段使用内置图像生成工具生成的固定精修素材
- 用途：私人笔记纸书写载体
- 处理：从绿幕源图裁切，执行 Alpha 扣像、去绿溢色与尺寸规范化，输出 RGBA PNG

## 爱因斯坦

### 肖像

- 文件：`einstein/portrait.webp`
- 原始文件：`assets-source/personas/einstein/portrait-source.jpg`
- 名称：`Einstein 1921 by F Schmutzer.jpg`
- 描述：1921 年维也纳演讲中的阿尔伯特·爱因斯坦
- 来源：https://commons.wikimedia.org/wiki/File:Einstein_1921_by_F_Schmutzer.jpg
- 作者：Ferdinand Schmutzer
- 权利状态：Public Domain；Wikimedia Commons 文件页记录 Schmutzer 于 1928 年去世并标注 Public Domain
- 处理：裁切为竖版档案肖像并转换为 WebP

### 普林斯顿书桌背景

- 文件：`einstein/background.webp`
- 原始文件：`assets-source/personas/einstein/background-source.png`
- 来源：项目开发阶段使用内置图像生成工具生成的固定精修素材
- 用途：普林斯顿书桌与黑板氛围背景
- 处理：保留生成源图，压缩为 WebP；运行时不调用生图 API

### 方格草稿纸

- 文件：`einstein/paper.png`
- 原始文件：`assets-source/personas/einstein/paper-source.png`
- 来源：项目开发阶段使用内置图像生成工具生成的固定精修素材
- 用途：方格草稿纸书写载体
- 处理：从绿幕源图裁切，执行 Alpha 扣像、去绿溢色与尺寸规范化，输出 RGBA PNG
