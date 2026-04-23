// list-records-cli.js 负责列出记录。
  // 可以列出全部，也可以用 --type learning/devlog 过滤。

  const { parseArgs } = require("../infra/cli-utils");
  const { readData } = require("../infra/store");

  async function runListRecordsCommand(config) {
    const options = parseArgs(process.argv.slice(3));
    const data = readData(config);

    let records = data.records;

    if (options.type) {
      records = records.filter((record) => {
        return record.type === options.type;
      });
    }

    const simplifiedRecords = records.map((record) => {
      return {
        id: record.id,
        type: record.type,
        date: record.date,
        week: record.week,
        title: record.topic || record.project || "",
        summary: record.summary || "",
        durationMinutes: record.durationMinutes || 0,
      };
    });

    console.log(JSON.stringify({
      count: simplifiedRecords.length,
      records: simplifiedRecords,
    }, null, 2));
  }

  module.exports = { runListRecordsCommand };
