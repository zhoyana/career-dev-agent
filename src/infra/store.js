// store.js 是“数据存储层”。
// 现在我们先用最简单的方案：把所有数据存在一个 JSON 文件里。
//
// 真实产品可能会用 SQLite、Postgres、向量数据库等。
// 但学习阶段先用 JSON 文件最好，因为你可以直接打开看数据长什么样。

const fs = require("fs");
const path = require("path");

function createEmptyData() {
  // 这是整个数据文件的默认结构。
  // records 是一个数组，每条学习记录或开发日志都会放进去。
  return {
    version: 1,
    records: [],
  };
}

function ensureParentDirectory(filePath) {
  // path.dirname('/a/b/c.json') 会得到 '/a/b'。
  // fs.mkdirSync(..., { recursive: true }) 会递归创建目录。
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readData(config) {
  ensureParentDirectory(config.dataFile);

  // 如果数据文件不存在，直接返回空数据。
  if (!fs.existsSync(config.dataFile)) {
    return createEmptyData();
  }

  // fs.readFileSync 是同步读取文件。
  // 第二个参数 'utf8' 表示按文本读取，而不是二进制 Buffer。
  const text = fs.readFileSync(config.dataFile, "utf8");

  // 空文件也当作没有数据处理。
  if (!text.trim()) {
    return createEmptyData();
  }

  // JSON.parse 把 JSON 字符串变成 JavaScript 对象。
  const parsed = JSON.parse(text);

  return normalizeData(parsed);
}

function writeData(config, data) {
  ensureParentDirectory(config.dataFile);

  // JSON.stringify 的第三个参数 2 表示缩进 2 个空格，方便人阅读。
  const text = JSON.stringify(normalizeData(data), null, 2);

  // 为了降低写文件写到一半失败导致数据损坏的风险：
  // 先写到 .tmp 文件，再 rename 成正式文件。
  const tmpFile = `${config.dataFile}.tmp`;
  fs.writeFileSync(tmpFile, `${text}\n`, "utf8");
  fs.renameSync(tmpFile, config.dataFile);
}

function normalizeData(raw) {
  // normalize 的作用：防御脏数据。
  // 即使 JSON 文件里缺字段，也把它整理成我们期望的结构。
  return {
    version: 1,
    records: Array.isArray(raw && raw.records) ? raw.records : [],
  };
}

function addRecord(config, record) {
  const data = readData(config);
  data.records.push(record);
  writeData(config, data);
  return record;
}

function listRecordsByDate(config, date) {
  const data = readData(config);
  const normalizedDate = String(date || "").trim();

  return data.records.filter((record) => {
    return record.date === normalizedDate;
  });
}

function listRecordsByWeek(config, week) {
  const data = readData(config);
  const normalizedWeek = String(week || "").trim();

  return data.records.filter((record) => {
    return record.week === normalizedWeek;
  });
}

module.exports = {
  addRecord,
  listRecordsByDate,
  listRecordsByWeek,
  readData,
  writeData,
};
