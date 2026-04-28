// agent-runtime-cli.js 负责承接新的 Agent Runtime 入口。
  // 当前版本使用 OpenAI tool calling 做多步工具调用。

  const { parseArgs, readStdinText } = require("../infra/cli-utils");
  const { createTools } = require("../agent/tools");
  const { createToolRegistry } = require("../agent/tool-registry");
  const { runMultiStepAgent } = require("../agent/runtime");

  function printAgentRuntimeError(error) {
    console.log(JSON.stringify({
      ok: false,
      error: {
        message: error.message,
        name: error.name || "Error",
      },
    }, null, 2));
  }

  async function runAgentRuntimeCommand(config) {
    try {
      const options = parseArgs(process.argv.slice(3));
      const tools = createTools(config);
      const registry = createToolRegistry(tools);

      if (!options.stdin) {
        console.log(JSON.stringify({
          ok: true,
          toolCount: tools.length,
          tools: registry.listToolDefinitions(),
        }, null, 2));
        return;
      }

      const userInput = await readStdinText();
      const result = await runMultiStepAgent({
        userInput,
        registry,
        verbose: Boolean(options.verbose),
      });

      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      printAgentRuntimeError(error);
      process.exitCode = 1;
    }
  }

  module.exports = { runAgentRuntimeCommand };
