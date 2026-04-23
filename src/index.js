// index.js 是命令分发中心。
// 用户输入不同 command，这里决定调用哪个功能模块。

const { readConfig } = require("./infra/config");
const { runInspectGitCommand } = require("./app/inspect-git-cli");
const { runReadDayCommand } = require("./app/read-day-cli");
const { runWeeklyReportCommand } = require("./app/weekly-report-cli");
const { runWriteDevlogCommand } = require("./app/write-devlog-cli");
const { runWriteLearningCommand } = require("./app/write-learning-cli");
const { runDeleteRecordCommand } = require("./app/delete-record-cli");
const { runListRecordsCommand } = require("./app/list-records-cli");


const { runStatsCommand } = require("./app/stats-cli");
function printHelp() {
  console.log(`
Usage: career-dev-agent <command>

Commands:
  inspect-git     检查一个 Git 仓库，输出结构化 JSON
  write-learning  写入一条学习记录
  write-devlog    写入一条代码开发日志
  read            按日期读取记录
  weekly-report   生成一份周报 Markdown
  help            显示帮助信息
  delete          按 id 删除一条记录
  list            列出全部记录，可用 --type 过滤


  

Examples:
  node ./bin/career-dev-agent.js help
  node ./bin/career-dev-agent.js inspect-git --repo /path/to/repo
  node ./bin/career-dev-agent.js write-learning --stdin
  node ./bin/career-dev-agent.js read --date 2026-04-23
  node ./bin/career-dev-agent.js list --type devlog

`);
}

async function main() {
  // readConfig 负责读取配置，例如数据文件存在哪里。
  const config = readConfig();

  // process.argv 是 Node.js 提供的命令行参数数组。
  // 例如执行：
  //   node ./bin/career-dev-agent.js read --date 2026-04-23
  // 那么：
  //   process.argv[0] 是 node
  //   process.argv[1] 是 ./bin/career-dev-agent.js
  //   process.argv[2] 是 read
  const command = process.argv[2] || "help";

  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  // 下面几个命令下一步再实现。
  // 先把结构搭起来，让你看懂 CLI 是怎么分发的。
  if (command === "inspect-git") {
    await runInspectGitCommand(config);
    return;
  }

  if (command === "write-learning") {
    await runWriteLearningCommand(config);
    return;
  }

  if (command === "write-devlog") {
    await runWriteDevlogCommand(config);
    return;
  }

  if (command === "read") {
    await runReadDayCommand(config);
    return;
  }

  if (command === "list") {
    await runListRecordsCommand(config);
    return;
  }


  if (command === "stats") {
    await runStatsCommand(config);
    return;
  }

  if (command === "weekly-report") {
    await runWeeklyReportCommand(config);
    return;
  }

  if (command === "delete") {
    await runDeleteRecordCommand(config);
    return;
  }




  throw new Error(`Unknown command: ${command}`);
}

// module.exports 是 CommonJS 的导出语法。
// 其他文件可以通过 require("../src/index") 拿到 main。
module.exports = { main };
