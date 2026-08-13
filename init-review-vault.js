#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2];
const today = process.argv[3] || new Date().toISOString().slice(0, 10);

if (!root) {
  console.error("Usage: node init-review-vault.js <review-vault-dir>");
  process.exit(2);
}

const dirs = [
  "00-index",
  "01-daily",
  `01-daily/${today}`,
  `01-daily/${today}/1-原始错题素材`,
  `01-daily/${today}/2-整理好的错题`,
  "02-weekly",
  "03-maps/民法",
  "03-maps/刑法",
  "03-maps/民诉",
  "03-maps/刑诉",
  "03-maps/行政法",
  "03-maps/商经知",
  "03-maps/理论法",
  "03-maps/三国法",
  "04-mistakes/by-subject/民法",
  "04-mistakes/by-subject/刑法",
  "04-mistakes/by-subject/民诉",
  "04-mistakes/by-subject/刑诉",
  "04-mistakes/by-subject/行政法",
  "04-mistakes/by-subject/商经知",
  "04-mistakes/by-subject/理论法",
  "04-mistakes/by-subject/三国法",
  "04-mistakes/by-cause/大意",
  "04-mistakes/by-cause/知识点不会",
  "04-mistakes/by-cause/知识点会但是做题思路不对",
  "05-learning-docs",
  "06-assets"
];

for (const dir of dirs) {
  fs.mkdirSync(path.join(root, dir), { recursive: true });
}

function writeIfMissing(file, data) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, data);
  }
}

writeIfMissing(
  path.join(root, "00-index", "mistake-index.json"),
  JSON.stringify({ mistakes: [] }, null, 2)
);

writeIfMissing(
  path.join(root, "00-index", "retest-queue.json"),
  JSON.stringify({ retests: [] }, null, 2)
);

writeIfMissing(
  path.join(root, "README.md"),
  [
    "# 错题复盘系统",
    "",
    "- `00-index`: counted/uncounted source of truth.",
    "- `01-daily`: daily review notes.",
    "- `02-weekly`: weekly trend review.",
    "- `03-maps`: per-subject and per-unit visual maps.",
    "- `04-mistakes`: subject and cause views; do not count from folders.",
    "- `05-learning-docs`: AI learning documents and feedback areas.",
    ""
  ].join("\n")
);

writeIfMissing(
  path.join(root, "01-daily", "README.md"),
  [
    "# Daily 复盘",
    "",
    "每天新增一个 `YYYY-MM-DD/` 文件夹。",
    "",
    "```text",
    "YYYY-MM-DD/",
    "  YYYY-MM-DD.md",
    "  1-原始错题素材/",
    "  2-整理好的错题/",
    "```",
    "",
    "- `1-原始错题素材/`：截图、OCR、原题文本、未清洗材料。",
    "- `2-整理好的错题/`：结构化错题卡、AI 讲解、确认后的知识点。",
    "- 当天复盘文件记录错因、未计入项、七日复测、关联科目汇总页。",
    ""
  ].join("\n")
);

writeIfMissing(
  path.join(root, "01-daily", today, "README.md"),
  [
    `# ${today}`,
    "",
    "- `1-原始错题素材/`：今天的原始截图、OCR、题干、解析。",
    "- `2-整理好的错题/`：今天确认后的错题卡与学习文档。",
    `- \`${today}.md\`：今天的复盘总表。`,
    ""
  ].join("\n")
);

writeIfMissing(
  path.join(root, "01-daily", today, "1-原始错题素材", "README.md"),
  [
    "# 1 原始错题素材",
    "",
    "放今天未处理或未完全确认的原始材料：截图、OCR、题库复制文本、手写备注。",
    "",
    "- 文件命名建议：`科目-来源-序号.md` 或 `科目-来源-序号.png`。",
    "- 不在这里做最终统计；确认后再进入 `2-整理好的错题/` 和 `00-index/mistake-index.json`。",
    ""
  ].join("\n")
);

writeIfMissing(
  path.join(root, "01-daily", today, "2-整理好的错题", "README.md"),
  [
    "# 2 整理好的错题",
    "",
    "放今天已经整理成结构化错题卡的内容。",
    "",
    "- 每道题保留稳定 `mistake_id`。",
    "- 同步更新 `00-index/mistake-index.json`。",
    "- 同步写入对应科目的 `04-mistakes/by-subject/<科目>/错误知识点汇集.md`。",
    ""
  ].join("\n")
);

writeIfMissing(
  path.join(root, "01-daily", today, `${today}.md`),
  [
    `# ${today} 错题复盘`,
    "",
    "## 今日入口",
    "",
    "- 原始错题素材：[[1-原始错题素材/README]]",
    "- 整理好的错题：[[2-整理好的错题/README]]",
    "",
    "## 今日错题",
    "",
    "| mistake_id | 科目 | 单元/专题 | 错因 | counted | 七日复测 |",
    "| --- | --- | --- | --- | --- | --- |",
    "",
    "## 错因小结",
    "",
    "- 主错因：",
    "- 次错因：",
    "- 未纳入统计的题：",
    "",
    "## 科目错误知识点",
    "",
    "- 民法：[[../../04-mistakes/by-subject/民法/错误知识点汇集]]",
    "- 刑法：[[../../04-mistakes/by-subject/刑法/错误知识点汇集]]",
    "- 民诉：[[../../04-mistakes/by-subject/民诉/错误知识点汇集]]",
    "- 刑诉：[[../../04-mistakes/by-subject/刑诉/错误知识点汇集]]",
    "- 行政法：[[../../04-mistakes/by-subject/行政法/错误知识点汇集]]",
    "- 商经知：[[../../04-mistakes/by-subject/商经知/错误知识点汇集]]",
    "- 理论法：[[../../04-mistakes/by-subject/理论法/错误知识点汇集]]",
    "- 三国法：[[../../04-mistakes/by-subject/三国法/错误知识点汇集]]",
    "",
    "## 七天后复测",
    "",
    "| mistake_id | 知识点 | retest_due | 状态 |",
    "| --- | --- | --- | --- |",
    ""
  ].join("\n")
);

const subjects = ["民法", "刑法", "民诉", "刑诉", "行政法", "商经知", "理论法", "三国法"];
for (const subject of subjects) {
  writeIfMissing(
    path.join(root, "04-mistakes", "by-subject", subject, "错误知识点汇集.md"),
    [
      `# ${subject}错误知识点汇集`,
      "",
      "## 高频错误知识点",
      "",
      "| 知识点 | 错题次数 | mistake_ids | 当前状态 | 最近出错 | 关联地图 |",
      "| --- | ---: | --- | --- | --- | --- |",
      "",
      "## 待复盘",
      "",
      "- ",
      "",
      "## 七日复测中",
      "",
      "- ",
      "",
      "## 已恢复",
      "",
      "- ",
      "",
      "## 记录规则",
      "",
      "- 这里只做知识点汇集和链接，不从本页计数。",
      "- 统计口径以 `../../../00-index/mistake-index.json` 为准。",
      "- 每个知识点必须能追溯到至少一个 `mistake_id` 或每日文件夹。",
      ""
    ].join("\n")
  );
}

console.log(path.resolve(root));
