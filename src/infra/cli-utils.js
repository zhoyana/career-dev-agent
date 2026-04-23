// cli-utils.js 放一些 CLI 会共用的小函数。
// 这些函数不涉及业务，只解决“怎么读命令行参数”“怎么读 stdin”这类问题。

function parseArgs(args) {
  // args 是一个数组，例如：
  //   ["--date", "2026-04-23", "--stdin"]
  //
  // 我们把它解析成对象：
  //   { date: "2026-04-23", stdin: true }
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--stdin") {
      options.stdin = true;
      continue;
    }

    if (token.startsWith("--")) {
      const key = token.slice(2);
      const value = args[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for argument: ${token}`);
      }

      options[key] = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return options;
}

async function readStdinText() {
  // process.stdin 是 Node.js 的标准输入流。
  // 用户执行 echo '{"a":1}' | node xxx.js 时，内容就从这里进来。
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function readStdinJson() {
  const text = await readStdinText();

  if (!text.trim()) {
    throw new Error("Expected JSON from stdin, but stdin is empty");
  }

  return JSON.parse(text);
}

function requireOption(options, name) {
  const value = String(options[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required option: --${name}`);
  }
  return value;
}

function todayDateString() {
  // new Date().toISOString() 类似：
  //   2026-04-23T04:00:00.000Z
  // slice(0, 10) 取前 10 位，得到：
  //   2026-04-23
  return new Date().toISOString().slice(0, 10);
}

function getIsoWeek(dateString) {
  // 输入 2026-04-23，输出类似 2026-W17。
  // 这里用的是 ISO week：周一是一周第一天。
  const date = new Date(`${dateString}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);

  const yearStart = new Date(`${date.getUTCFullYear()}-01-01T00:00:00.000Z`);
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  const paddedWeek = String(weekNo).padStart(2, "0");

  return `${date.getUTCFullYear()}-W${paddedWeek}`;
}

module.exports = {
  getIsoWeek,
  parseArgs,
  readStdinJson,
  requireOption,
  readStdinText,
  todayDateString,
};
