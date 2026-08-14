#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { updateMarkedMaps } = require("./mark-smm-text-map");
const { refreshWeeklyReviews } = require("./generate-weekly-review");
const { shouldRefreshOnIngest } = require("./configure-automation");

const SUBJECTS = ["民法", "刑法", "民诉", "刑诉", "行政法", "商经知", "理论法", "三国法"];
const CAUSES = ["大意", "知识点不会", "知识点会但是做题思路不对"];

function usage() {
  console.error("Usage: ingest-mistakes.js <review-vault-dir> <mistakes.json> [YYYY-MM-DD]");
  process.exit(2);
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function writeIfMissing(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, data);
}

function slug(value) {
  return String(value || "未命名")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function sourceImages(card) {
  return []
    .concat(card.source_images || [])
    .concat(card.original_images || [])
    .filter(Boolean);
}

function normalizeInput(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.mistakes)) return raw.mistakes;
  if (Array.isArray(raw.mistake_cards)) return raw.mistake_cards;
  throw new Error("Input must be an array, or an object with mistakes/mistake_cards.");
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function nextId(dateText, existingIds, index) {
  let n = index + 1;
  while (true) {
    const id = `M-${dateText.replace(/-/g, "")}-${String(n).padStart(3, "0")}`;
    if (!existingIds.has(id)) return id;
    n += 1;
  }
}

function bulletList(items) {
  const list = (items || []).filter(Boolean);
  return list.length ? list.map((item) => `- ${item}`).join("\n") : "- ";
}

function normalizeCause(value) {
  const cause = String(value || "").trim();
  if (cause === "1") return "知识点不会";
  if (cause === "2") return "知识点会但是做题思路不对";
  if (cause === "3") return "知识点会但是做题思路不对";
  if (cause === "大衣" || cause === "粗心") return "大意";
  if (CAUSES.includes(cause)) return cause;
  return "未确认";
}

function splitListText(value) {
  return String(value || "")
    .split(/[\n,，、;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function explanationItems(card) {
  if (Array.isArray(card.explanation_items) && card.explanation_items.length) {
    return card.explanation_items.filter(Boolean);
  }
  const text = card.explanation_summary || card.explanation || "";
  return text ? [String(text)] : [];
}

function selectedExplanations(card) {
  if (Array.isArray(card.selected_explanations) && card.selected_explanations.length) {
    return card.selected_explanations.filter(Boolean);
  }
  const items = explanationItems(card);
  const indexes = typeof card.selected_explanation_indexes === "string"
    ? splitListText(card.selected_explanation_indexes)
    : (card.selected_explanation_indexes || []);
  if (!indexes.length) return items;
  return indexes
    .map((index) => items[Number(index) - 1])
    .filter(Boolean);
}

function allKnowledgePoints(card) {
  return Array.from(new Set([]
    .concat(card.surface_points || [])
    .concat(card.root_cause_points || [])
    .concat(card.confusable_points || [])
    .concat(card.knowledge_points || [])
    .filter(Boolean)));
}

function selectedKnowledgePoints(card) {
  if (typeof card.selected_knowledge_points === "string") {
    const points = splitListText(card.selected_knowledge_points);
    if (points.length) return points;
  }
  if (Array.isArray(card.selected_knowledge_points) && card.selected_knowledge_points.length) {
    return card.selected_knowledge_points.filter(Boolean);
  }
  const items = allKnowledgePoints(card);
  const indexes = card.selected_knowledge_point_indexes || [];
  const picked = indexes
    .map((index) => items[Number(index) - 1])
    .filter(Boolean);
  return picked.length ? picked : items;
}

function sortedUnique(items) {
  return Array.from(new Set((items || []).filter(Boolean))).sort();
}

function sameStringList(a, b) {
  const left = sortedUnique(a);
  const right = sortedUnique(b);
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function existingMistake(item, subject, dateText, mistakeIndex) {
  const points = selectedKnowledgePoints(item);
  return (mistakeIndex.mistakes || []).find((entry) => {
    return entry.date === (item.date || dateText)
      && entry.subject === subject
      && (entry.unit || "") === (item.unit || "")
      && sameStringList(entry.knowledge_points || [], points);
  });
}

function mistakeMarkdown(card) {
  const pickedExplanations = selectedExplanations(card);
  const pickedPoints = selectedKnowledgePoints(card);
  return [
    `# ${card.id} ${card.subject || "未知科目"}错题卡`,
    "",
    "## 基本信息",
    "",
    `- 科目：${card.subject || ""}`,
    `- 单元/专题：${card.unit || ""}`,
    `- 用户答案：${card.user_answer || ""}`,
    `- 正确答案：${card.correct_answer || ""}`,
    `- 主错因：${card.primary_cause || ""}`,
    `- 次错因：${(card.secondary_causes || []).join("、")}`,
    `- 置信度：${card.confidence || "low"}`,
    `- counted：${card.counted !== false}`,
    `- 七日复测：${card.retest_due || ""}`,
    "",
    "## 题干",
    "",
    card.stem || card.ocr_text || "",
    "",
    "## 选项",
    "",
    (card.options || []).map((option) => `- ${option}`).join("\n"),
    "",
    "## 原始素材",
    "",
    bulletList(card.raw_files || []),
    "",
    "## 解析摘要",
    "",
    card.explanation_summary || card.explanation || "",
    "",
    "## 选入错题知识页的解析",
    "",
    bulletList(pickedExplanations),
    "",
    "## 知识点",
    "",
    "### 用户确认写入的知识点",
    "",
    bulletList(pickedPoints),
    "",
    "## 证据",
    "",
    bulletList(card.evidence),
    "",
    "## 下一步",
    "",
    card.next_action || "",
    ""
  ].join("\n");
}

function copyRawMaterials(root, dateText, card) {
  const sources = sourceImages(card);
  if (!sources.length) return [];
  const rawDir = path.join(root, "01-daily", dateText, "1-原始错题素材");
  fs.mkdirSync(rawDir, { recursive: true });
  return sources
    .map((source, index) => {
      if (!fs.existsSync(source)) return "";
      const ext = path.extname(source);
      const base = path.basename(source, ext);
      const file = path.join(rawDir, `${card.id}-${String(index + 1).padStart(2, "0")}-${slug(base)}${ext}`);
      if (!fs.existsSync(file)) fs.copyFileSync(source, file);
      return path.relative(root, file);
    })
    .filter(Boolean);
}

function ensureSubjectPage(root, subject) {
  const file = path.join(root, "04-mistakes", "by-subject", subject, "错误知识点汇集.md");
  writeIfMissing(file, [
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
    ""
  ].join("\n"));
  return file;
}

function ensureSubjectMapScaffold(root, subject) {
  const subjectRoot = path.join(root, "03-maps", subject);
  for (const dir of ["00-source", "01-base", "02-marked"]) {
    fs.mkdirSync(path.join(subjectRoot, dir), { recursive: true });
  }
  writeIfMissing(path.join(subjectRoot, "README.md"), [
    `# ${subject}知识图谱`,
    "",
    "- `00-source/`：用户提供的原始 `.xmind` 文件。",
    "- `01-base/`：无错题颜色的基础图谱。",
    "- `02-marked/`：确认后生成的红/黄/绿标注图谱。",
    ""
  ].join("\n"));
}

function appendUnique(file, marker, lines) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const newLines = lines.filter((line) => line && !current.includes(line));
  if (!newLines.length) return;
  fs.appendFileSync(file, `\n${marker}\n${newLines.join("\n")}\n`);
}

function updateDailyReview(root, dateText, cards) {
  const dailyFile = path.join(root, "01-daily", dateText, `${dateText}.md`);
  writeIfMissing(dailyFile, `# ${dateText} 错题复盘\n\n## 今日错题\n\n| mistake_id | 科目 | 单元/专题 | 错因 | counted | 七日复测 |\n| --- | --- | --- | --- | --- | --- |\n`);
  const rows = cards.map((card) => `| ${card.id} | ${card.subject || ""} | ${card.unit || ""} | ${card.primary_cause || ""} | ${card.counted !== false} | ${card.retest_due || ""} |`);
  appendUnique(dailyFile, "## 自动导入错题", rows);
}

function updateSubjectPages(root, cards) {
  for (const card of cards) {
    const subject = card.subject || "未分类";
    ensureSubjectMapScaffold(root, subject);
    const file = ensureSubjectPage(root, subject);
    const points = selectedKnowledgePoints(card);
    const rows = points.map((point) => `| ${point} | 1 | ${card.id} | 待复盘 | ${card.date} | [[../../../03-maps/${subject}/]] |`);
    appendUnique(file, "## 自动汇集", rows);
    const explanations = selectedExplanations(card).map((item) => `- ${card.id}：${item}`);
    appendUnique(file, "## 用户选入解析", explanations);
  }
}

function updateCausePages(root, cards) {
  for (const card of cards) {
    const cause = normalizeCause(card.primary_cause);
    const file = path.join(root, "04-mistakes", "by-cause", cause, `${card.id}.md`);
    const explanations = selectedExplanations(card);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, [
      `# ${card.id} ${cause}`,
      "",
      `- 科目：${card.subject || ""}`,
      `- 单元/专题：${card.unit || ""}`,
      `- 错题卡：[[../../../${card.source_file.replace(/\.md$/, "")}]]`,
      "",
      "## 选入错题知识页的解析",
      "",
      bulletList(explanations),
      ""
    ].join("\n"));
  }
}

function causePercent(cards) {
  const counts = new Map();
  cards.forEach((card) => counts.set(card.primary_cause || "未分类", (counts.get(card.primary_cause || "未分类") || 0) + 1));
  return Array.from(counts.entries()).map(([cause, count]) => ({
    cause,
    count,
    percent: cards.length ? Math.round((count / cards.length) * 100) : 0
  }));
}

function reportMarkdown(dateText, cards) {
  const causeRows = causePercent(cards).map((item) => `| ${item.cause} | ${item.count} | ${item.percent}% |`).join("\n");
  const cardRows = cards.map((card) => `| ${card.id} | ${card.subject || ""} | ${(card.root_cause_points || [])[0] || (card.surface_points || [])[0] || ""} | ${card.primary_cause || ""} | ${card.next_action || ""} |`).join("\n");
  return [
    `# ${dateText} 错题导入报告`,
    "",
    "## 错因组成",
    "",
    "| 错因 | 数量 | 比例 |",
    "| --- | ---: | ---: |",
    causeRows,
    "",
    "## 错题卡片索引",
    "",
    "| mistake_id | 科目 | 关键知识点 | 主错因 | 下一步 |",
    "| --- | --- | --- | --- | --- |",
    cardRows,
    ""
  ].join("\n");
}

function main() {
  const root = process.argv[2];
  const inputFile = process.argv[3];
  const dateText = process.argv[4] || new Date().toISOString().slice(0, 10);
  if (!root || !inputFile) usage();

  const input = normalizeInput(readJson(inputFile));
  const indexFile = path.join(root, "00-index", "mistake-index.json");
  const retestFile = path.join(root, "00-index", "retest-queue.json");
  const mistakeIndex = readJson(indexFile, { schema: "wrong-question.mistake-index.v1", updated_at: dateText, mistakes: [] });
  const retestQueue = readJson(retestFile, { schema: "wrong-question.retest-queue.v1", updated_at: dateText, retests: [] });
  const existingIds = new Set((mistakeIndex.mistakes || []).map((item) => item.id));

  const cards = input.map((item, idx) => {
    const subject = SUBJECTS.includes(item.subject) ? item.subject : (item.subject || "未分类");
    const cause = normalizeCause(item.primary_cause);
    if (!item.user_confirmed || cause === "未确认") {
      throw new Error(`Mistake ${item.id || idx + 1} is not confirmed. Ask the user to choose explanations and one cause tag before ingesting.`);
    }
    const existing = item.id ? null : existingMistake(item, subject, dateText, mistakeIndex);
    const id = item.id || (existing && existing.id) || nextId(dateText, existingIds, idx);
    existingIds.add(id);
    return {
      ...item,
      id,
      date: item.date || dateText,
      subject,
      primary_cause: cause,
      counted: item.counted !== false,
      retest_due: item.retest_due || addDays(dateText, 7),
      retest_status: item.retest_status || "pending"
    };
  });

  for (const card of cards) {
    const cleanedDir = path.join(root, "01-daily", dateText, "2-整理好的错题");
    const cardFile = path.join(cleanedDir, `${card.id}-${slug(card.subject)}-${slug(card.unit || (card.surface_points || [])[0])}.md`);
    fs.mkdirSync(cleanedDir, { recursive: true });
    card.raw_files = Array.from(new Set([].concat(card.raw_files || []).concat(copyRawMaterials(root, dateText, card))));
    fs.writeFileSync(cardFile, mistakeMarkdown(card));
    card.source_file = path.relative(root, cardFile);

    if (!mistakeIndex.mistakes.some((item) => item.id === card.id)) {
      mistakeIndex.mistakes.push({
        id: card.id,
        date: card.date,
        subject: card.subject,
        unit: card.unit || "",
        knowledge_points: selectedKnowledgePoints(card),
        primary_cause: card.primary_cause,
        counted: card.counted,
        daily_reviewed: true,
        raw_files: card.raw_files,
        retest_due: card.retest_due,
        retest_status: card.retest_status,
        source_file: card.source_file
      });
    }

    if (!retestQueue.retests.some((item) => item.id === card.id)) {
      retestQueue.retests.push({
        id: card.id,
        date: card.date,
        subject: card.subject,
        knowledge_points: selectedKnowledgePoints(card),
        retest_due: card.retest_due,
        status: card.retest_status,
        source_file: card.source_file
      });
    }
  }

  mistakeIndex.updated_at = dateText;
  retestQueue.updated_at = dateText;
  writeJson(indexFile, mistakeIndex);
  writeJson(retestFile, retestQueue);
  updateDailyReview(root, dateText, cards);
  updateSubjectPages(root, cards);
  updateCausePages(root, cards);
  const markedGraphs = updateMarkedMaps(root, cards, dateText);
  const weeklyReviews = shouldRefreshOnIngest(root) ? refreshWeeklyReviews(root, dateText) : [];

  const reportFile = path.join(root, "01-daily", dateText, "2-整理好的错题", `${dateText}-错题导入报告.md`);
  fs.writeFileSync(reportFile, reportMarkdown(dateText, cards));
  console.log(JSON.stringify({ imported: cards.length, report: reportFile, marked_graphs: markedGraphs, weekly_reviews: weeklyReviews }, null, 2));
}

if (require.main === module) main();
