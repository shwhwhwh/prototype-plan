# Prototype Plan

**让一个用 AI 构建的想法原型，被看见、被试用，再成长为更成熟的项目。**

Share ideas made tangible with AI. Explore working prototypes, then help promising ideas grow through better design, engineering and maintenance.

Prototype Plan 是原型的总入口与协作索引。每个原型拥有自己的专属仓库、作者、问题列表、版本发布和许可证；本仓库用 Git 子模块将它们组织在一起，不复制或合并项目历史。

发起与维护：**[Rui Li (@shwhwhwh)](https://github.com/shwhwhwh)** · [原型展示页](https://heathcliffak.com/prototype-plan.html) · [个人主页](https://heathcliffak.com/)

## 首批原型

| 原型 | 想法与当前能力 | 独立仓库 / 下载 | 授权 |
| --- | --- | --- | --- |
| **Research Nexus · RN** | 把 alphaXiv、Zotero、OpenResearch 等研究工具放进一个本地研究工作区；系统模板可直接使用，DIY 设计器仍处于 Beta | [专属仓库](https://github.com/shwhwhwh/research-nexus) · [发行版](https://github.com/shwhwhwh/research-nexus/releases) · [子模块](prototypes/research-nexus) | MIT，须保留版权及许可声明 |
| **Branch Canvas · BC** | 用对话树组织 Codex 问答；同一回答建立不同分支，连续追问复用 thread，导航回原生聊天 | [专属仓库](https://github.com/shwhwhwh/codex-branch-canvas) · [v0.1.0 下载](https://github.com/shwhwhwh/codex-branch-canvas/releases/tag/v0.1.0) · [子模块](prototypes/branch-canvas) | 保留全部权利；扩展、复制或再分发前须获得作者许可 |

两者目前都是可运行的原型，不等同于已经完成生产环境工程验收的产品。具体安装与边界以各自 README 为准。

## 这里希望发生什么

1. **分享想法**：说明想解决的问题、面向谁，以及为什么值得尝试。
2. **做出原型**：用 AI 辅助构建一个可以运行或演示的结果，记录仍不可靠的部分。
3. **获得反馈**：其他人尝试后提出改进、补充场景，或分享自己的变体。
4. **继续工程化**：在项目许可允许或取得作者授权后，完善测试、安装、架构、安全与维护方式。

分享原型不自动授予他人代码使用许可，也不转移原作者的权利。

## 获取总仓库与两个项目

```bash
git clone --recurse-submodules https://github.com/shwhwhwh/prototype-plan.git
cd prototype-plan
```

已经克隆但项目目录为空：

```bash
git submodule update --init --recursive
```

只想安装一个原型，可以直接进入它的独立仓库或下载发行包，无需克隆整个总仓库。
两个子模块固定到经过登记的提交，以便复现；更新各自专属仓库不会悄悄改变此处固定版本。
维护者确认更新后，在总仓库提交新的子模块指针及 `projects.json` 即可。

## 分享你的原型

- 尚处于想法阶段：到 [Discussions](https://github.com/shwhwhwh/prototype-plan/discussions) 分享问题与设想。
- 已有可展示原型：使用 [原型提交表单](https://github.com/shwhwhwh/prototype-plan/issues/new?template=prototype.yml)，提供专属仓库、演示、安装方法、已知限制和授权方式。
- 希望改进 RN / BC：到对应项目提交 Issue / PR；先遵守各自许可证，BC 的授权限制保持不变。

项目提交者保留自己的归属与署名。请只提交你有权公开的代码、数据、图片和演示，避免上传私密聊天与凭证。
更详细的收录流程见 [CONTRIBUTING.md](CONTRIBUTING.md)；项目介绍模板见 [templates/PROTOTYPE.md](templates/PROTOTYPE.md)。

## 目录

```text
prototypes/
  research-nexus/    # Git 子模块，独立仓库
  branch-canvas/     # Git 子模块，独立仓库
projects.json       # 项目简介、固定提交与授权信息
templates/          # 原型介绍模板
```

## 版权与项目许可

本索引由 Rui Li 发起维护，原有项目版权声明保持不变。总仓库不向子项目添加统一开源许可，也不代替项目作者授予授权。
RN 保持 MIT；BC 保持 All rights reserved。后续原型的授权由其作者在专属仓库明确声明。
请参阅 [NOTICE](NOTICE)。
