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
        records: records.slice(0, 5).map((record)=>{
          return {
            id:record.id,
            type:record.type,
            date:record.date,
            week:record.week,
            topic:record.topic,
            project:record.project,
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
      "如果用户的问题需要查看本地记录或仓库状态，优先调用工具，不要直接猜测。",
      "工具选择策略如下：",
      "1. 如果用户提供了明确日期 YYYY-MM-DD，并想知道那天做了什么、有什么记录，优先使用 read_records_by_date。",
      "2. 如果用户想按主题、技能、项目或关键词查找记录，优先使用 search_records。",
      "3. 如果用户想看最近几条 learning 或 devlog 记录，优先使用list_records_by_type。",
      "4. 如果用户要求最近一条、某一条详情、单条记录总结、最近在学什么、最近主要做了什么，而候选列表本身不含完整内容，必须先用 list_records_by_type 拿到候选 id，再用get_record_by_id 获取单条详情。",
      "5.不要仅根据候选列表的简要字段直接编造单条记录的详细总结；需要详情时必须调用get_record_by_id。",
      "6. 如果用户要求某一周的周报或整周总结，优先使用 generate_weekly_report，周格式是 YYYY-Www。",
      "7. 如果用户问的是 git 仓库状态、分支、diff、最近提交，优先使用 inspect_git。",
      "8. 如果任务需要先列候选、再查看单条详情，请按多步方式调用工具，不要试图一步猜出完整内容。",
      "9. 如果已经通过工具拿到足够信息，就不要继续调用工具，直接给出简洁、基于事实的最终回答。",
      "10. 不要虚构不存在的记录、仓库状态或工具结果。",
    ].join("\n");
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

  async function runMultiStepAgent({ userInput, registry, verbose = false }) {
    const normalizedInput = String(userInput || "").trim();

    if (!normalizedInput) {
      throw new Error("Agent runtime requires non-empty input");
    }

    const log = createVerboseLogger(verbose);
    const toolDefinitions = registry.listToolDefinitions();
    const executedSteps = [];
    const maxSteps = 8;

    const conversationInput = [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: buildRuntimeSystemPrompt(),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: normalizedInput,
          },
        ],
      },
    ];

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

