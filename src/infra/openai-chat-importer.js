// openai-chat-importer.js 负责把一整段聊天记录抽取成多条结构化记录。

  const { createOpenAIClient } = require("./openai-client");

  async function extractRecordsFromChatWithLLM(text) {
    const client = createOpenAIClient();

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            "你是一个求职学习与开发日志抽取器。",
            "你的任务是把一段聊天记录拆成多条结构化 JSON 记录。",
            "只能输出 JSON 数组，不要输出 Markdown。",
            "每一条记录的 intent 只能是 learning 或 devlog。",
            "如果是学习、课程、论文、理解概念，intent=learning。",
            "如果是写代码、修 bug、实现功能、Git、测试，intent=devlog。",
            "durationMinutes 必须是数字；如果文本没有明确提到，默认 30。",
            "skills 必须是字符串数组。",
            "bugs 必须是数组，没有就返回空数组。",
          ].join("\n"),
        },
        {
          role: "user",
          content: buildImportPrompt(text),
        },
      ],
    });

    const outputText = response.output_text;

    try {
      const parsed = JSON.parse(outputText);

      if (!Array.isArray(parsed)) {
        throw new Error("LLM output must be a JSON array");
      }

      return parsed;
    } catch (error) {
      throw new Error(
        [
          "LLM did not return valid JSON array.",
          "Raw output:",
          outputText,
        ].join("\n")
      );
    }
  }

  function buildImportPrompt(text) {
    return [
      "请从下面这段聊天记录中抽取多条记录，返回 JSON 数组：",
      "",
      text,
      "",
      "每个数组元素必须使用以下格式：",
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

  module.exports = { extractRecordsFromChatWithLLM };

