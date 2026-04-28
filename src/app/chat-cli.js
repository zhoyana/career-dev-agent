// chat-cli.js 提供一个最小可用的交互式聊天入口。
  // 当前版本每一轮都会调用现有的 multi-step agent runtime，先不做会话级上下文记忆。

  const readline = require("readline");
  const { parseArgs } = require("../infra/cli-utils");
  const { createTools } = require("../agent/tools");
  const { createToolRegistry } = require("../agent/tool-registry");
  const { runMultiStepAgent } = require("../agent/runtime");

  function printWelcome() {
    console.log("Career Dev Agent Chat");
    console.log("输入你的问题后回车即可。");
    console.log("输入 exit 或 quit 退出。");
    console.log("输入 /help 查看帮助。");
    console.log("");
  }

  function printHelp() {
    console.log("可用命令：");
    console.log("  /help        显示帮助");
    console.log("  /tools       查看当前可用工具");
    console.log("  exit|quit    退出聊天");
    console.log("");
    console.log("示例问题：");
    console.log("  帮我看看 2026-04-23 的记录");
    console.log("  帮我搜索一下和 Node.js 相关的记录");
    console.log("  帮我找最近一条 learning 记录，并总结我最近在学什么");
    console.log("");
  }

  function printToolList(registry) {
    const tools = registry.listToolDefinitions();

    console.log("当前工具：");
    for (const tool of tools) {
      console.log(`- ${tool.name}: ${tool.description}`);
    }
    console.log("");
  }

  function printAgentResult(result, verbose) {
    console.log("");
    console.log(result.finalAnswer || "没有生成最终回答。");

    if (verbose) {
      console.log("");
      console.log("[debug]");
      console.log(`stepCount: ${result.stepCount}`);
      console.log(
        `tools: ${result.steps.map((step) => step.toolName).join(" -> ") || "(none)"}`
      );
    }

    console.log("");
  }

  async function runChatCommand(config) {
    const options = parseArgs(process.argv.slice(3));
    const verbose = Boolean(options.verbose);
    const tools = createTools(config);
    const registry = createToolRegistry(tools);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "> ",
    });

    printWelcome();
    rl.prompt();

    for await (const line of rl) {
      const userInput = String(line || "").trim();

      if (!userInput) {
        rl.prompt();
        continue;
      }

      if (userInput === "exit" || userInput === "quit") {
        rl.close();
        break;
      }

      if (userInput === "/help") {
        printHelp();
        rl.prompt();
        continue;
      }

      if (userInput === "/tools") {
        printToolList(registry);
        rl.prompt();
        continue;
      }

      try {
        const result = await runMultiStepAgent({
          userInput,
          registry,
          verbose,
        });

        printAgentResult(result, verbose);
      } catch (error) {
        console.log("");
        console.log(`错误: ${error.message}`);
        console.log("");
      }

      rl.prompt();
    }
  }

  module.exports = { runChatCommand };
