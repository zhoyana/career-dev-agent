// openai-client.js 负责和 OpenAI API 通信。
  // 其他业务文件不要直接写 API 调用，统一从这里调用。

  const OpenAI = require("openai");

  function createOpenAIClient() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY environment variable");
    }

    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async function extractCareerRecordWithLLM(text) {
    const client = createOpenAIClient();

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            "你是一个求职学习与开发日志抽取器。",
            "你的任务是把用户自然语言转成严格 JSON。",
            "只能输出 JSON，不要输出 Markdown。",
            "intent 只能是 learning 或 devlog。",
            "如果是学习、课程、论文、概念理解，intent=learning。",
            "如果是写代码、修 bug、实现功能、Git、测试，intent=devlog。",
            "durationMinutes 必须是数字。如果没说时长，默认 30。",
            "skills 必须是字符串数组。",
          ].join("\n"),
        },
        {
          role: "user",
          content: buildExtractionPrompt(text),
        },
      ],
    });

    const outputText = response.output_text;
    return JSON.parse(outputText);
  }

  function buildExtractionPrompt(text) {
    return [
      "请从下面文本中抽取一条记录，返回 JSON：",
      "",
      text,
      "",
      "JSON 格式必须是：",
      "{",
      "  \"intent\": \"learning 或 devlog\",",
      "  \"date\": \"YYYY-MM-DD 或空字符串\",",
      "  \"project\": \"项目名，learning 可为空\",",
      "  \"topic\": \"学习主题，devlog 可为空\",",
      "  \"summary\": \"一句话总结\",",
      "  \"durationMinutes\": 30,",
      "  \"skills\": [\"技能1\"],",
      "  \"bugs\": []",
      "}",
    ].join("\n");
  }

  module.exports = { extractCareerRecordWithLLM };
