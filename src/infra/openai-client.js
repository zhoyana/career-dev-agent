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

  async function extractAgentActionWithLLM(text) {
    const client = createOpenAIClient();

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
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
        {
          role: "user",
          content: buildAgentActionPrompt(text),
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

  function buildAgentActionPrompt(text) {
    return [
      "请根据下面用户输入，返回一个 Agent Action JSON：",
      "",
      text,
      "",
      "返回格式必须是：",
      "{",
      "  \"intent\": \"write_learning | write_devlog | read_day | weekly_report\",",
      "  \"action\": \"create_learning_record | create_devlog_record | read_records_by_date |generate_weekly_report\",",
      "  \"payload\": {}",
      "}",
      "",
      "不同 intent 的 payload 要求：",
      "1. write_learning:",
      "{",
      "  \"date\": \"YYYY-MM-DD 或空字符串\",",
      "  \"topic\": \"学习主题\",",
      "  \"summary\": \"一句话总结\",",
      "  \"durationMinutes\": 30,",
      "  \"skills\": [\"技能1\"],",
      "  \"source\": \"来源，可为空\"",
      "}",
      "",
      "2. write_devlog:",
      "{",
      "  \"date\": \"YYYY-MM-DD 或空字符串\",",
      "  \"project\": \"项目名\",",
      "  \"summary\": \"一句话总结\",",
      "  \"durationMinutes\": 30,",
      "  \"skills\": [\"技能1\"],",
      "  \"bugs\": [],",
      "  \"tests\": null",
      "}",
      "",
      "3. read_day:",
      "{",
      "  \"date\": \"YYYY-MM-DD\"",
      "}",
      "",
      "4. weekly_report:",
      "{",
      "  \"week\": \"YYYY-Www\"",
      "}",
    ].join("\n");
  }

  module.exports = { extractAgentActionWithLLM, createOpenAIClient };