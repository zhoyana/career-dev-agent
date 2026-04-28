// openai-client.js 负责和 OpenAI API 通信。
  // 其他业务文件不要直接写 API 调用，统一从这里调用。

  const OpenAI = require("openai");
  const { getSupportedIntentList, getSupportedActionList } = require("./agent-action-schema");

  function createOpenAIClient() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY environment variable");
    }

    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
  }

  function getAgentRuntimeModel() {
    return process.env.OPENAI_AGENT_MODEL || "gpt-4.1-mini";
  }

  function buildAgentRuntimeSystemPrompt(repairHint = "") {
    const lines = [
      "你是一个本地 Career Dev Agent 的工具规划器。",
      "你的任务是根据用户输入，选择最合适的一个工具。",
      "本阶段只允许单步调用：最多调用一个函数。",
      "如果能通过工具完成任务，就优先返回 function call。",
      "不要虚构工具名。",
      "不要补充 schema 之外的字段。",
      "参数必须严格符合 tool schema。",
      "如果用户表达不完整，也要尽量根据工具 schema 补出最合理的参数。",
    ];

    if (repairHint) {
      lines.push("");
      lines.push("上一次调用失败原因：");
      lines.push(repairHint);
      lines.push("请修正后重新选择并输出唯一的 function call。");
    }

    return lines.join("\n");
  }

  async function extractAgentActionWithLLM(text) {
    const client = createOpenAIClient();

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "你是一个本地 AI Career Agent 的动作规划器。",
                "你的任务是把用户自然语言请求转成严格 JSON 动作。",
                "只能输出 JSON，不要输出 Markdown，不要输出解释。",
                `intent 只能是: ${getSupportedIntentList().join(", ")}`,
                `action 只能是: ${getSupportedActionList().join(", ")}`,
                "如果用户想记录学习内容，intent=write_learning，action=create_learning_record。",
                "如果用户想记录开发日志，intent=write_devlog，action=create_devlog_record。",
                "如果用户想查看某一天的记录，intent=read_day，action=read_records_by_date。",
                "如果用户想生成周报，intent=weekly_report，action=generate_weekly_report。",
                "payload 必须是对象。",
                "如果是 write_learning，payload 必须包含 topic、summary、durationMinutes、skills。",
                "如果是 write_devlog，payload 必须包含 project、summary、durationMinutes、skills。",
                "如果是 read_day，payload 必须包含 date。",
                "如果是 weekly_report，payload 必须包含 week。",
                "durationMinutes 必须是数字；如果用户没说，默认 30。",
                "skills 必须是字符串数组；如果用户没说，可以根据上下文提炼 1 到 3 个技能。",
                "date 使用 YYYY-MM-DD；week 使用 YYYY-Www。",
              ].join("\n"),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildAgentActionPrompt(text),
            },
          ],
        },
      ],
    });

    const outputText = response.output_text;

    try {
      return JSON.parse(outputText);
    } catch (error) {
      throw new Error(
        [
          "LLM did not return valid agent action JSON.",
          "Raw output:",
          outputText,
        ].join("\n")
      );
    }
  }

  function extractFirstFunctionCall(response) {
    const outputItems = Array.isArray(response.output) ? response.output : [];
    return outputItems.find((item) => item.type === "function_call") || null;
  }

  function parseFunctionCallArguments(rawArguments) {
    try {
      return JSON.parse(rawArguments || "{}");
    } catch (error) {
      throw new Error(
        [
          "LLM returned invalid function_call arguments JSON.",
          "Raw arguments:",
          String(rawArguments || ""),
        ].join("\n")
      );
    }
  }

  async function requestSingleToolCallPlan({
    client,
    model,
    userInput,
    toolDefinitions,
    repairHint,
  }) {
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: buildAgentRuntimeSystemPrompt(repairHint),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: userInput,
            },
          ],
        },
      ],
      tools: toolDefinitions,
      tool_choice: "auto",
    });

    const functionCall = extractFirstFunctionCall(response);

    if (!functionCall) {
      throw new Error(
        [
          "LLM did not return a function_call.",
          "Response output:",
          JSON.stringify(response.output, null, 2),
        ].join("\n")
      );
    }

    return {
      responseId: response.id,
      model: response.model,
      toolCall: {
        id: functionCall.id,
        callId: functionCall.call_id,
        name: functionCall.name,
        arguments: parseFunctionCallArguments(functionCall.arguments),
        rawArguments: functionCall.arguments,
      },
    };
  }

  async function planSingleToolCallWithLLM({ userInput, toolDefinitions }) {
    const normalizedInput = String(userInput || "").trim();

    if (!normalizedInput) {
      throw new Error("Agent runtime requires non-empty input");
    }

    const client = createOpenAIClient();
    const model = getAgentRuntimeModel();
    const attemptErrors = [];
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const repairHint = attemptErrors.length > 0
          ? attemptErrors[attemptErrors.length - 1]
          : "";

        const plan = await requestSingleToolCallPlan({
          client,
          model,
          userInput: normalizedInput,
          toolDefinitions,
          repairHint,
        });

        return {
          ...plan,
          attemptCount: attempt,
        };
      } catch (error) {
        attemptErrors.push(error.message);

        if (attempt === maxAttempts) {
          throw new Error(
            [
              `LLM tool planning failed after ${maxAttempts} attempts.`,
              ...attemptErrors.map((message, index) => {
                return `Attempt ${index + 1}: ${message}`;
              }),
            ].join("\n\n")
          );
        }
      }
    }

    throw new Error("Unreachable tool planning state");
  }

  async function createAgentResponse({
    input,
    toolDefinitions,
  }) {
    const client = createOpenAIClient();

    return client.responses.create({
      model: getAgentRuntimeModel(),
      input,
      tools: toolDefinitions,
      tool_choice: "auto",
    });
  }


  function getFunctionCallsFromResponse(response) {
    const outputItems = Array.isArray(response.output) ? response.output : [];

    return outputItems.filter((item) => item.type === "function_call");
  }

  function getFinalMessageText(response) {
    const outputItems = Array.isArray(response.output) ? response.output : [];
    const messageItem = outputItems.find((item) => item.type === "message");

    if (!messageItem || !Array.isArray(messageItem.content)) {
      return "";
    }

    return messageItem.content
      .filter((part) => part.type === "output_text")
      .map((part) => part.text || "")
      .join("");
  }



  function buildAgentActionPrompt(text) {
    return [
      "请根据下面用户输入，返回一个 Agent Action JSON：",
      "",
      text,
      "",
      "返回格式必须是：",
      "{",
      '  "intent": "write_learning | write_devlog | read_day | weekly_report",',
      '  "action": "create_learning_record | create_devlog_record |read_records_by_date | generate_weekly_report",',
      '  "payload": {}',
      "}",
      "",
      "不同 intent 的 payload 要求：",
      "1. write_learning:",
      "{",
      '  "date": "YYYY-MM-DD 或空字符串",',
      '  "topic": "学习主题",',
      '  "summary": "一句话总结",',
      '  "durationMinutes": 30,',
      '  "skills": ["技能1"],',
      '  "source": "来源，可为空"',
      "}",
      "",
      "2. write_devlog:",
      "{",
      '  "date": "YYYY-MM-DD 或空字符串",',
      '  "project": "项目名",',
      '  "summary": "一句话总结",',
      '  "durationMinutes": 30,',
      '  "skills": ["技能1"],',
      '  "bugs": [],',
      '  "tests": null',
      "}",
      "",
      "3. read_day:",
      "{",
      '  "date": "YYYY-MM-DD"',
      "}",
      "",
      "4. weekly_report:",
      "{",
      '  "week": "YYYY-Www"',
      "}",
    ].join("\n");
  }

  module.exports = {
    extractAgentActionWithLLM,
    createOpenAIClient,
    planSingleToolCallWithLLM,
    createAgentResponse,
    getFunctionCallsFromResponse,
    getFinalMessageText,
  };

