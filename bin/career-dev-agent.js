#!/usr/bin/env node

// 这是整个 CLI 的入口文件。
// 当你执行：
//   node ./bin/career-dev-agent.js help
// Node.js 就会从这个文件开始运行。

// require 是 CommonJS 的导入语法。
// 这里从 ../src/index.js 里导入 main 函数。
const { main } = require("../src/index");

// 调用 main() 启动程序。
// main 是 async 函数，所以它返回 Promise。
// 如果运行过程中报错，catch 会捕获错误并打印。
main().catch((error) => {
  console.error(error && error.message ? error.message : String(error));
  process.exitCode = 1;
});
