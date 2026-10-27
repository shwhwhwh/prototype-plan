# Prototype Plan

**让用 AI 构建的想法原型，被看见、被试用，并在清晰的归属和许可下共同完善。**

发起与维护：[Rui Li (@shwhwhwh)](https://github.com/shwhwhwh) · [原型展示与衍生树](https://heathcliffak.com/prototype-plan.html#lineage) · [个人主页](https://heathcliffak.com/)

## 默认权利政策

由 Rui Li 拥有相应权利的新原型、自行构建的衍生项目及新原创贡献，默认 **保留全部权利；个人学习、非商业试验及协作改进可免费进行，商业化须另行书面授权**。这不是无限制的开源许可。欢迎共同完善，贡献者保留署名和自己的版权；接受新贡献前，须取得 [PP-CLA-1.0](CONTRIBUTOR_AGREEMENT.md) 或另行约定的维护、发布和商业授权权限。

已有许可、第三方及其他作者的权利不被覆盖。仅提出想法，不意味着取得整个想法或独立实现的独占权。[完整政策](RIGHTS_POLICY.md) · [许可正文](LICENSE) · [商业授权说明](COMMERCIAL_LICENSE.md)。

## 当前官方版本与许可边界

| 原型 | 当前官方包 / 安装 | 新原创内容 | 历史授权 |
| --- | --- | --- | --- |
| [Research Nexus](https://github.com/shwhwhwh/research-nexus) | [v0.7.1 Windows 源码包](https://github.com/shwhwhwh/research-nexus/releases/tag/v0.7.1) · [安装指南](https://github.com/shwhwhwh/research-nexus/blob/main/INSTALL.md) | 保留权利，学习/非商业试验免费，商业化另授权 | 切换前 MIT 材料继续按 MIT，包括商业使用；旧 Releases 撤下公开入口 |
| [Branch Canvas](https://github.com/shwhwhwh/codex-branch-canvas) | [v0.1.1 Windows 插件包](https://github.com/shwhwhwh/codex-branch-canvas/releases/tag/v0.1.1) · [安装指南](https://github.com/shwhwhwh/codex-branch-canvas#readme) | 保留权利，学习/非商业试验免费，商业化另授权 | 旧 v0.1.0 保持原授权；旧 Releases 撤下公开入口 |

RN 的旧 MIT 权限不会因新政策被撤销或追溯收费；未改变的旧 MIT 材料仍可按 MIT 使用。新限制仅针对首次按新许可发布的原创内容。BC 的旧 ZIP、标签和校验值不被替换。[RN 许可沿革](https://github.com/shwhwhwh/research-nexus/blob/main/LICENSE_HISTORY.md) · [BC 许可沿革](https://github.com/shwhwhwh/codex-branch-canvas/blob/main/LICENSE_HISTORY.md)。

## 获取、参与和登记

每个项目有独立仓库、问题列表、发布与作者。总仓库通过子模块固定已登记的源码提交，不合并项目历史。

```bash
git clone --recurse-submodules https://github.com/shwhwhwh/prototype-plan.git
cd prototype-plan
```

已经克隆但子目录为空：`git submodule update --init --recursive`。安装方式和运行限制以项目自己的 README 为准。

- 分享新原型：[原型表单](https://github.com/shwhwhwh/prototype-plan/issues/new?template=prototype.yml)。
- 登记衍生项目：[衍生表单](https://github.com/shwhwhwh/prototype-plan/issues/new?template=derivative.yml)，记录父项目、实际来源提交和使用范围。
- 共同完善：到对应项目提 Issue / PR，阅读贡献条款并主动确认；发言本身不会转移版权。
- 商业化：[授权咨询](https://github.com/shwhwhwh/prototype-plan/issues/new?template=commercial-license.yml)。费用和范围另行书面约定，不自动索取所有应用的分成。

不要提交私密聊天、凭证、私人文献或未获授权的第三方材料。

## 自动检查与衍生树

只读 GitHub Actions 在 push、PR、手动运行和每日检查时复核来源、版权、完整许可、商业使用范围和新贡献确认。普通协作者合入 main 须通过检查并取得 CODEOWNERS 审核；所有者保留管理权限。

索引 schema 3 明确区分新许可与历史许可版本：新许可下非商业试验可以登记；新许可下商业使用需要审核过的作者授权；历史 MIT 来源仍可以按 MIT 商业使用。不会用“保留归属”冒充商业许可。未通过、未完成或过期的结果不会用于展示衍生节点。

网页读取对应通过提交的索引，以树形呈现项目并直接链接仓库。CI 不会自动写入 main 或其他人的仓库，也不能防止目录外复制或裁定侵权。[检查规则](rights/README.md)。

## 为后续自建项目使用统一模板

在全新空目录（可已有 .git）生成权利文件、贡献说明及只读检查：

```bash
node scripts/scaffold-owner-rights.mjs --target ../my-prototype --id my-prototype --repository https://github.com/shwhwhwh/my-prototype
```

增加 `--parent research-nexus` 或其他已登记的原型/衍生项目 ID 可记录全部祖先来源。不会覆盖已有项目；旧许可迁移须单独核对。生成后补充真正的原创代码、测试与说明，提交后再用真实 SHA 登记，不能把模板视为权属证明。

目录：`projects.json`（项目/父子/使用范围）、`rights/policy.json`（可信许可锚点与历史版本）、`rights/history/`（旧许可原文）、`templates/owner-rights/`（后续自建项目默认）。
