// read-day-cli.js 负责按日期读取记录。
//
// 用法示例：
//   node ./bin/career-dev-agent.js read --date 2026-04-23

const { listRecordsByDate } = require("../infra/store");
const { parseArgs, requireOption } = require("../infra/cli-utils");

async function runReadDayCommand(config) {
  const options = parseArgs(process.argv.slice(3));
  const date = requireOption(options, "date");
  const records = listRecordsByDate(config, date);

  console.log(JSON.stringify({
    date,
    count: records.length,
    records,
  }, null, 2));
}

module.exports = { runReadDayCommand };
