// runtime.js 负责承接最小版本的 Agent Runtime。
  // 当前版本保留规则路由，同时新增基于 OpenAI tool calling 的单步运行模式和多步运行模式。

  const {
    planSingleToolCallWithLLM,
    createAgentResponse,
    getFunctionCallsFromResponse,
    getFinalMessageText,
  } = require("../infra/openai-client");

  function decideToolFromText(text) {
    const normalizedText = String(text || "").trim();

    if (!normalizedText) {
      throw new Error("Agent runtime requires non-empty input");
    }

    const lowerText = normalizedText.toLowerCase();

    if (lowerText.includes("weekly") || normalizedText.includes("周报")) {
      const weekMatch = normalizedText.match(/\d{4}-W\d{2}/);

      return {
        toolName: "generate_weekly_report",
        toolInput: {
          week: weekMatch ? weekMatch[0] : "",
        },
      };
    }

    if (lowerText.includes("git") || normalizedText.includes("仓库")) {
      const repoMatch = normalizedText.match(/\/[^\s]+/);

      return {
        toolName: "inspect_git",
        toolInput: {
          repo: repoMatch ? repoMatch[0] : process.cwd(),
        },
      };
    }

    if (normalizedText.includes("搜索") || lowerText.startsWith("search ")) {
      const query = normalizedText
        .replace(/^search\s+/i, "")
        .replace(/^搜索\s*/, "")
        .trim();

      return {
        toolName: "search_records",
        toolInput: {
          query,
        },
      };
    }

    const dateMatch = normalizedText.match(/\d{4}-\d{2}-\d{2}/);

    if (dateMatch) {
      return {
        toolName: "read_records_by_date",
        toolInput: {
          date: dateMatch[0],
        },
      };
    }

    return {
      toolName: "search_records",
      toolInput: {
        query: normalizedText,
      },
    };
  }

  function createVerboseLogger(verbose) {
    return function log(...args) {
      if (!verbose) {
        return;
      }

      console.error("[agent-runtime]", ...args);
    };
  }

  function truncateText(text, maxLength = 1000) {
    const normalizedText = String(text || "");

    if (normalizedText.length <= maxLength) {
      return normalizedText;
    }

    return `${normalizedText.slice(0, maxLength)}...(truncated)`;
  }

  function summarizeRecord(record) {
    if (!record || typeof record !== "object") {
      return record;
    }

    return {
      id: record.id,
      type: record.type,
      date: record.date,
      week: record.week,
      topic: record.topic,
      project: record.project,
      summary: truncateText(record.summary || "", 200),
      durationMinutes: record.durationMinutes,
      skills: Array.isArray(record.skills) ? record.skills.slice(0, 8) : [],
    };
  }

  function summarizeMemory(memory) {
    if (!memory || typeof memory !== "object") {
      return memory;
    }

    return {
      id: memory.id,
      memoryType: memory.memoryType,
      title: memory.title,
      summary: truncateText(memory.summary || "", 220),
      tags: Array.isArray(memory.tags) ? memory.tags.slice(0, 8) : [],
      relatedRecordIds: Array.isArray(memory.relatedRecordIds)
        ? memory.relatedRecordIds.slice(0, 5)
        : [],
      createdAt: memory.createdAt,
    };
  }

  function serializeToolResultForModel(toolName, toolResult) {
    if (toolName === "read_records_by_date") {
      const records = Array.isArray(toolResult.records) ? toolResult.records : [];

      return {
        date: toolResult.date,
        count: toolResult.count,
        records: records.slice(0, 5).map(summarizeRecord),
      };
    }

    if (toolName === "search_records") {
      const records = Array.isArray(toolResult.records) ? toolResult.records : [];

      return {
        query: toolResult.query,
        count: toolResult.count,
        records: records.slice(0, 5).map(summarizeRecord),
      };
    }

    if (toolName === "list_records_by_type") {
      const records = Array.isArray(toolResult.records) ? toolResult.records : [];

      return {
        type: toolResult.type,
        count: toolResult.count,
        records: records.slice(0, 5).map((record) => {
          return {
            id: record.id,
            type: record.type,
            date: record.date,
            week: record.week,
            topic: record.topic,
            project: record.project,
          };
        }),
      };
    }

    if (toolName === "get_record_by_id") {
      return {
        id: toolResult.id,
        found: toolResult.found,
        record: toolResult.record ? summarizeRecord(toolResult.record) : null,
      };
    }

    if (toolName === "list_recent_memories" || toolName === "search_memories") {
      const memories = Array.isArray(toolResult.memories) ? toolResult.memories : [];

      return {
        count: toolResult.count,
        memories: memories.slice(0, 5).map(summarizeMemory),
      };
    }

    if (toolName === "get_memory_by_id") {
      return {
        id: toolResult.id,
        found: toolResult.found,
        memory: toolResult.memory ? summarizeMemory(toolResult.memory) : null,
      };
    }

    if (toolName === "generate_weekly_report") {
      return {
        week: toolResult.week,
        count: toolResult.count,
        markdown: truncateText(toolResult.markdown || "", 1200),
      };
    }

    if (toolName === "inspect_git") {
      return JSON.parse(JSON.stringify(toolResult || {}));
    }

    return JSON.parse(JSON.stringify(toolResult || {}));
  }

  function buildRuntimeSystemPrompt() {
    return [
      "你是一个本地 Career Dev Agent。",
      "你的职责是优先通过本地工具获取事实，再基于事实回答用户问题。",
      "如果用户的问题需要查看本地记录、长期记忆或仓库状态，优先调用工具，不要直接猜测。",
      "结构化长期记忆可以作为长期线索，但如果问题依赖具体事实，仍然优先调用 records 工具核实。",
      "工具选择策略如下：",
      "1. 明确日期 YYYY-MM-DD 的记录查询，优先 read_records_by_date。",
      "2. 关键词、技能、项目检索，优先 search_records。",
      "3. 最近几条 learning 或 devlog，优先 list_records_by_type。",
      "4. 已知 record id 后查详情，使用 get_record_by_id。",
      "5. 用户问最近学了什么、长期关注什么、最近的项目重点是什么时，可优先查memories。",
      "6. 最近长期记忆列表用 list_recent_memories，按关键词查长期记忆用search_memories，已知 memory id 查详情用 get_memory_by_id。",
      "7. 周报 YYYY-Www 用 generate_weekly_report。",
      "8. git 仓库状态问题用 inspect_git。",
      "9. 如果任务需要先列候选、再查详情，请按多步方式调用工具。",
      "10. 信息足够后直接给最终回答，不要编造事实。",
    ].join("\n");
  }

  function buildConversationInput({ userInput, contextText }) {
    const input = [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: buildRuntimeSystemPrompt(),
          },
        ],
      },
    ];

    if (String(contextText || "").trim()) {
      input.push({
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "下面是你可以参考的历史上下文。",
              "这些内容来自当前会话和结构化长期记忆，只能作为辅助线索。",
              "如果要回答当前问题，优先使用工具核实事实。",
              "",
              String(contextText || "").trim(),
            ].join("\n"),
          },
        ],
      });
    }

    input.push({
      role: "user",
      content: [
        {
          type: "input_text",
          text: userInput,
        },
      ],
    });

    return input;
  }

  async function runRuleBasedAgent({ userInput, registry }) {
    const decision = decideToolFromText(userInput);
    const result = await registry.executeToolCall(
      decision.toolName,
      decision.toolInput
    );

    return {
      ok: true,
      mode: "rule-based",
      userInput,
      toolCall: decision,
      result,
    };
  }

  async function runSingleStepAgent({ userInput, registry }) {
    const normalizedInput = String(userInput || "").trim();

    if (!normalizedInput) {
      throw new Error("Agent runtime requires non-empty input");
    }

    const toolDefinitions = registry.listToolDefinitions();

    const plan = await planSingleToolCallWithLLM({
      userInput: normalizedInput,
      toolDefinitions,
    });

    const result = await registry.executeToolCall(
      plan.toolCall.name,
      plan.toolCall.arguments
    );

    return {
      ok: true,
      mode: "single-step-tool-calling",
      userInput: normalizedInput,
      responseId: plan.responseId,
      model: plan.model,
      attemptCount: plan.attemptCount,
      toolCall: {
        toolName: plan.toolCall.name,
        toolInput: plan.toolCall.arguments,
        callId: plan.toolCall.callId,
      },
      result,
    };
  }

  async function runMultiStepAgent({
    userInput,
    registry,
    verbose = false,
    contextText = "",
  }) {
    const normalizedInput = String(userInput || "").trim();

    if (!normalizedInput) {
      throw new Error("Agent runtime requires non-empty input");
    }

    const log = createVerboseLogger(verbose);
    const toolDefinitions = registry.listToolDefinitions();
    const executedSteps = [];
    const maxSteps = 8;

    const conversationInput = buildConversationInput({
      userInput: normalizedInput,
      contextText,
    });

    for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
      log(`step ${stepIndex + 1}: requesting model response`);

      const response = await createAgentResponse({
        input: conversationInput,
        toolDefinitions,
      });

      const functionCalls = getFunctionCallsFromResponse(response);
      log(`step ${stepIndex + 1}: response id = ${response.id}`);
      log(`step ${stepIndex + 1}: function call count = ${functionCalls.length}`);

      if (functionCalls.length === 0) {
        const finalText = getFinalMessageText(response);
        log(`step ${stepIndex + 1}: final answer generated`);

        return {
          ok: true,
          mode: "multi-step-tool-calling",
          userInput: normalizedInput,
          responseId: response.id,
          model: response.model,
          contextUsed: Boolean(String(contextText || "").trim()),
          stepCount: executedSteps.length,
          steps: executedSteps,
          finalAnswer: finalText,
        };
      }

      for (const functionCall of functionCalls) {
        const toolInput = JSON.parse(functionCall.arguments || "{}");
        log(`executing tool: ${functionCall.name}`);
        log(`tool input: ${JSON.stringify(toolInput)}`);

        const toolResult = await registry.executeToolCall(
          functionCall.name,
          toolInput
        );

        const toolResultForModel = serializeToolResultForModel(
          functionCall.name,
          toolResult
        );

        log(`tool output summary: ${JSON.stringify(toolResultForModel)}`);

        executedSteps.push({
          toolName: functionCall.name,
          toolInput,
          toolResult,
          toolResultForModel,
          callId: functionCall.call_id,
        });

        conversationInput.push({
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: `我调用了工具 ${functionCall.name}，参数是${functionCall.arguments}。`,
            },
          ],
        });

        conversationInput.push({
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `工具 ${functionCall.name} 返回结果如下：`,
                JSON.stringify(toolResultForModel, null, 2),
                "",
                "请基于这些结果继续回答原始问题。",
              ].join("\n"),
            },
          ],
        });
      }
    }

    throw new Error(`Agent runtime exceeded max tool steps (${maxSteps})`);
  }

  module.exports = {
    decideToolFromText,
    runRuleBasedAgent,
    runSingleStepAgent,
    runMultiStepAgent,
  };
