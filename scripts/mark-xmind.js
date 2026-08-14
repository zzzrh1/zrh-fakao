#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * 修改 xmind 文件，给指定的知识点节点标红/标黄
 *
 * 用法：
 * node mark-xmind.js <xmind文件路径> <标注JSON文件路径> [输出XMind路径]
 *
 * 标注JSON格式：
 * {
 *   "marks": [
 *     {"text": "参与主体：纠纷双方当事人 + 仲裁委员会", "state": "red"},
 *     {"text": "人民调解委员会", "state": "yellow"}
 *   ]
 * }
 */

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function compact(text) {
  return String(text || "")
    .replace(/[，。、""''：:；;（）()【】\[\]《》<>！!？?,.、\s]/g, "")
    .replace(/[的之]/g, "")
    .trim();
}

function matchNode(nodeTitle, searchText) {
  const nodeCompact = compact(nodeTitle);
  const searchCompact = compact(searchText);

  if (!nodeCompact || !searchCompact || searchCompact.length < 4) return false;

  // 完全包含
  if (nodeCompact.includes(searchCompact)) return true;
  if (searchCompact.includes(nodeCompact) && nodeCompact.length >= 6) return true;

  return false;
}

function markNodes(node, marks) {
  let changed = false;

  // 检查当前节点是否匹配任何标注
  for (const mark of marks) {
    if (matchNode(node.title, mark.text)) {
      // 添加或修改style
      if (!node.style) {
        node.style = {
          id: `style-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          properties: {}
        };
      }
      if (!node.style.properties) {
        node.style.properties = {};
      }

      // 设置颜色
      if (mark.state === "red") {
        node.style.properties["svg:fill"] = "#FFE5D9"; // 浅红背景
        node.style.properties["fo:color"] = "#D32F2F"; // 深红文字
        node.style.properties["border-line-color"] = "#D32F2F"; // 红边框
      } else if (mark.state === "yellow") {
        node.style.properties["svg:fill"] = "#FFF9E6"; // 浅黄背景
        node.style.properties["fo:color"] = "#F57C00"; // 橙色文字
        node.style.properties["border-line-color"] = "#F57C00"; // 橙色边框
      }

      changed = true;
      console.log(`✓ 标记节点 [${mark.state}]: ${node.title.substring(0, 40)}`);
    }
  }

  // 递归处理子节点
  const children = node.children?.attached || [];
  for (const child of children) {
    if (markNodes(child, marks)) {
      changed = true;
    }
  }

  return changed;
}

function main() {
  const xmindFile = process.argv[2];
  const marksFile = process.argv[3];
  const outputFileArgument = process.argv[4];

  if (!xmindFile || !marksFile) {
    console.error("用法: mark-xmind.js <xmind文件> <标注JSON> [输出XMind路径]");
    process.exit(1);
  }

  if (!fs.existsSync(xmindFile)) {
    console.error(`错误: xmind文件不存在: ${xmindFile}`);
    process.exit(1);
  }

  if (path.extname(xmindFile).toLowerCase() !== ".xmind") {
    console.error("错误: 思维导图输入必须是 .xmind 格式");
    process.exit(1);
  }

  const marks = readJson(marksFile).marks || [];
  if (!marks.length) {
    console.error("错误: 标注JSON中没有marks数组");
    process.exit(1);
  }

  console.log(`读取xmind: ${xmindFile}`);
  console.log(`标注数量: ${marks.length}`);

  // 创建临时目录
  const tmpDir = `/tmp/xmind-${Date.now()}`;
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // 解压xmind（实际是zip）
    console.log("\n解压xmind文件...");
    execSync(`unzip -q "${xmindFile}" -d "${tmpDir}"`);

    // 读取content.json
    const contentFile = path.join(tmpDir, "content.json");
    const content = readJson(contentFile);

    // 标记节点
    console.log("\n开始标记节点...");
    let totalChanged = 0;
    for (const sheet of content) {
      if (markNodes(sheet.rootTopic, marks)) {
        totalChanged++;
      }
    }

    if (totalChanged === 0) {
      console.log("\n⚠️  警告: 没有找到匹配的节点");
    } else {
      console.log(`\n✓ 共标记了节点`);
    }

    // 写回content.json
    fs.writeFileSync(contentFile, JSON.stringify(content));

    // 生成输出文件名
    const dir = path.dirname(xmindFile);
    const basename = path.basename(xmindFile, ".xmind");
    const outputFile = outputFileArgument
      ? path.resolve(outputFileArgument)
      : path.join(dir, `${basename}-标注版.xmind`);
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);

    // 重新打包（按xmind要求的顺序和格式）
    console.log("\n重新打包xmind...");

    // xmind要求：不压缩(store模式)，metadata.json在最前
    const cwd = { cwd: tmpDir };
    execSync(`zip -X -0 "${outputFile}" metadata.json`, cwd);
    execSync(`zip -X -0 "${outputFile}" content.xml`, cwd);
    execSync(`zip -X -0 "${outputFile}" resources/`, cwd);
    execSync(`zip -rX -0 "${outputFile}" resources/`, cwd);
    execSync(`zip -X -0 "${outputFile}" content.json`, cwd);
    execSync(`zip -X -0 "${outputFile}" manifest.json`, cwd);

    console.log(`\n✓ 完成！输出文件: ${outputFile}`);

    // 清理临时文件
    execSync(`rm -rf "${tmpDir}"`);

  } catch (error) {
    console.error("\n错误:", error.message);
    execSync(`rm -rf "${tmpDir}"`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { markNodes, matchNode };
