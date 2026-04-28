// chat-cli.js 提供一个最小可用的交互式聊天入口。
  // 当前版本支持 session memory 和结构化长期记忆。

  const readline = require("readline");
  const { parseArgs } = require("../infra/cli-utils");
  const { createTools } = require("../agent/tools");
  const { createToolRegistry } = require("../agent/tool-registry");
  const { runMultiStepAgent } = require("../agent/runtime");
  const {
    appendTurn,
    buildSessionContextText,
    createChatSession,
    getChatMemoryFile,
  } = require("../infra/chat-memory-store");
  const {
    appendStructuredMemory,
    buildStructuredMemoryContextText,
    compressStructuredMemories,
    getStructuredMemoryFile,
  } = require("../infra/structured-memory-store");

  function printWelcome(sessionId, chatMemoryFile, structuredMemoryFile) {
    console.log("Career Dev Agent Chat");
    console.log("输入你的问题后回车即可。");
    console.log("输入 exit 或 quit 退出。");
    console.log("输入 /help 查看帮助。");
    console.log(`当前 session: ${sessionId}`);
    console.log(`会话记忆文件: ${chatMemoryFile}`);
    console.log(`结构化长期记忆文件: ${structuredMemoryFile}`);
    console.log("");
  }

  function printHelp() {
    console.log("可用命令：");
    console.log("  /help         显示帮助");
    console.log("  /tools        查看当前可用工具");
    console.log("  /memory       查看当前拼接上下文");
    console.log("  /session      查看当前 session id");
    console.log("  exit|quit     退出聊天");
    console.log("");
    console.log("示例问题：");
    console.log("  帮我看看 2026-04-23 的记录");
    console.log("  帮我搜索一下和 Node.js 相关的记录");
    console.log("  帮我找最近一条 learning 记录，并总结我最近在学什么");
    console.log("  再总结一下重点");
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

  function buildChatContext(config, sessionId) {
    const structuredMemoryContext = buildStructuredMemoryContextText(config, {
      maxMemories: 5,
      maxChars: 1200,
    });

    const sessionContext = buildSessionContextText(config, sessionId, {
      maxTurns: 6,
    });

    return [structuredMemoryContext, sessionContext].filter(Boolean).join("\n\n");
  }

  function printMemoryPreview(config, sessionId) {
    const contextText = buildChatContext(config, sessionId);

    console.log("");
    console.log(contextText || "(empty)");
    console.log("");
  }

  function printAgentResult(result, verbose, contextText) {
    console.log("");
    console.log(result.finalAnswer || "没有生成最终回答。");

    if (verbose) {
      console.log("");
      console.log("[debug]");
      console.log(`stepCount: ${result.stepCount}`);
      console.log(
        `tools: ${result.steps.map((step) => step.toolName).join(" -> ") || "(none)"}`
      );
      console.log(`contextUsed: ${Boolean(contextText)}`);
    }

    console.log("");
  }

  async function runChatCommand(config) {
    const options = parseArgs(process.argv.slice(3));
    const verbose = Boolean(options.verbose);
    const tools = createTools(config);
    const registry = createToolRegistry(tools);
    const session = createChatSession(config);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "> ",
    });

    printWelcome(
      session.id,
      getChatMemoryFile(config),
      getStructuredMemoryFile(config)
    );
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

      if (userInput === "/memory") {
        printMemoryPreview(config, session.id);
        rl.prompt();
        continue;
      }

      if (userInput === "/session") {
        console.log("");
        console.log(session.id);
        console.log("");
        rl.prompt();
        continue;
      }

      try {
        const contextText = buildChatContext(config, session.id);

        appendTurn(config, session.id, "user", userInput);

        const result = await runMultiStepAgent({
          userInput,
          registry,
          verbose,
          contextText,
        });

        appendTurn(config, session.id, "assistant", result.finalAnswer || "");

        appendStructuredMemory(config, {
          sessionId: session.id,
          userInput,
          result,
        });

        compressStructuredMemories(config);

        printAgentResult(result, verbose, contextText);
      } catch (error) {
        console.log("");
        console.log(`错误: ${error.message}`);
        console.log("");
      }

      rl.prompt();
    }
  }

  module.exports = { runChatCommand };
