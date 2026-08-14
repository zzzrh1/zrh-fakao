---
name: wrong-question-review-system
description: Portable law-exam wrong-question review system with structured diagnosis, user-confirmed knowledge mapping, user-supplied XMind mind-map marking, daily and weekly review, seven-day retesting, and learning-document generation. The bundled mind-map example currently covers 民诉; more subjects will be added later.
metadata:
  author: AI法师张诚
  portability: user-configured paths
  path_config: references/path-configuration.md
  version: 3.1
---

# 法考错题复盘系统

这是一个可移植的法考错题复盘 skill，不绑定某个用户、桌面目录、Obsidian vault、题库或科目图谱。

## 核心闭环

```text
错题输入 → 结构化识别 → 错因诊断 → 用户确认 → 持久化 → 图谱标注 → 七日复测
```

## 功能

- **错题诊断**：识别题干、选项、答案、解析、表层知识点、根因和易混点。
- **确认门**：写入前只确认知识点和一个错因标签，避免把推断直接当成用户事实。
- **复盘索引**：按日期、科目、单元和错因组织错题，`mistake-index.json` 是统计真源。
- **图谱标注**：支持用户上传自己的思维导图，但思维导图输入必须是 `.xmind` 格式；提供 XMind 标注脚本，红色表示直接薄弱点，黄色表示易混点。
- **科目覆盖**：当前仓库只内置民诉示例，其他法考科目将在后续版本持续更新；用户也可以先上传对应科目的 `.xmind` 图谱。
- **七日复测**：记录 `passed`、`failed`、`skipped`，形成恢复闭环。
- **学习文档**：围绕薄弱点生成前置知识、主体讲解、易混点、思考题和反馈区。

## 输入

支持上传图片、粘贴 OCR/题目文本，或直接提供结构化 JSON。没有可信题库时，不声称题目精确匹配；没有足够证据时，标记低置信度或 `manual_required`。

## 路径规则

- 所有用户路径在运行时确定，禁止写死主目录、桌面、应用容器、Obsidian vault 或备份位置。
- 使用 `REVIEW_VAULT` 保存持久化复盘文件。
- 使用 `TECHNICAL_WORKSPACE` 保存临时转换、图谱报告和调试产物。
- 使用 `SOURCE_MATERIALS` 表示用户提供的错题图片、OCR、PDF 或题库文件；思维导图输入单独使用 `SOURCE_XMIND`，且必须是 `.xmind` 格式。
- 使用 `SOURCE_XMIND` 指定用户上传的 XMind 思维导图；不把 OPML、PDF 或图片当作本功能的思维导图输入。
- 使用 `GRAPH_FILE` 指定当前科目的图谱；内置图谱只作为相关科目的 fallback。
- 使用 `TARGET_VAULT` 和 `BACKUP_DIR` 处理用户明确选择的 Obsidian 写入和备份。
- 路径解析和脚本示例见 `references/path-configuration.md`。

## 运行规则

1. 先识别题目并生成结构化错题卡。
2. 展示解析和候选知识点，但不要求用户重复选择解析。
3. 等待用户确认写入知识点，并选择 `1 知识点不会` 或 `2 知识点会但是做题思路不对`。
4. 确认后写入复盘库，生成稳定 `mistake_id` 和七日复测日期。
5. 用户要求图谱标注时，先确认输入文件是 `.xmind`，展示红/黄方案并等待确认，再执行写入。
6. 基础图谱不预先染色；标注输出与源图谱分离。
7. 所有推荐知识点都必须能追溯到题目、解析、用户标签或图谱关系。

## 脚本

- `scripts/init-review-vault.js`：初始化复盘库目录。
- `scripts/prepare-confirmation.js`：生成入库确认单。
- `scripts/ingest-mistakes.js`：写入错题卡、索引、复测队列和科目视图。
- `scripts/metrics-dashboard.js`：生成指标面板。
- `scripts/generate-learning-doc.js`：生成学习文档骨架。
- `scripts/update-retest.js`：记录七日复测结果。
- `scripts/mark-xmind.js`：在用户确认后复制并标注 XMind。
- `scripts/mark-graph.js`：标记 JSON 知识图谱。
- `scripts/mark-smm-text-map.js`：标记 `.smm.md` 文本图谱。
- `scripts/render-graph-view.js`：生成浏览器图谱报告。

## 复盘库结构

```text
00-index/                         # 统计真源和复测队列
01-daily/YYYY-MM-DD/              # 每日原始材料与已确认错题
02-weekly/                        # 周复盘
03-maps/<科目>/                    # 基础图谱
04-mistakes/by-subject/<科目>/     # 科目薄弱点
04-mistakes/by-cause/<错因>/       # 错因视图
05-learning-docs/                 # 学习文档
```

## 质量边界

- 保留题干、选项和解析原文，不擅自改写用户材料。
- 不在没有可信题库时伪造精确题目来源。
- 不把低置信度法律解释当成确定事实。
- 用户没有选择持久化位置时，保持预览模式。
- `大衣` 作为历史输入兼容词时归一化为 `大意`。
