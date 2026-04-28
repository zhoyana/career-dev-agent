// test-agent-runtime.js 负责做最小回归测试。
  // 它不是逐字校验模型输出，而是校验 Agent Runtime 的关键结构和工具选择行为。

  const assert = require("assert");
  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const { spawnSync } = require("child_process");

  function createTempStateDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "career-dev-agent-test-"));
  }

  function writeTestDataFile(filePath) {
    const data = {
      version: 1,
      records: [
        {
          id: "learning:2026-04-28:test",
          type: "learning",
          date: "2026-04-28",
          week: "2026-W18",
          createdAt: "2026-04-28T10:00:00.000Z",
          topic: "OpenAI Responses API 的 tool calling",
          summary: "理解了 tools schema、strict 模式和多轮 tool loop。",
          durationMinutes: 90,
          skills: ["tools schema", "strict mode", "multi-round tool loop"],
          source: "career-dev-agent",
        },
        {
          id: "learning:2026-04-23:test",
          type: "learning",
          date: "2026-04-23",
          week: "2026-W17",
          createdAt: "2026-04-23T07:23:38.817Z",
          topic: "AI Agent 工具调用",
          summary: "学习了如何用 CLI 命令作为 Agent 的工具边界，并把自然语言记录转成结构化 JSON。",
          durationMinutes: 90,
          skills: ["Agent", "CLI", "JSON schema"],
          source: "timeline-for-agent 项目源码",
        },
        {
          id: "devlog:2026-04-23:test",
          type: "devlog",
          date: "2026-04-23",
          week: "2026-W17",
          createdAt: "2026-04-23T14:17:14.598Z",
          project: "career-dev-agent",
          summary: "实现了最小规则版 Agent，学习了 Node.js CLI、JSON、filter 和map。",
          durationMinutes: 120,
          skills: ["Node.js", "CLI", "JSON", "filter", "map", "Agent"],
          bugs: [],
          tests: null,
          git: null,
        },
      ],
    };

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }

  function runAgentRuntime({ repoDir, prompt, env }) {
    const result = spawnSync(
      "node",
      ["./bin/career-dev-agent.js", "agent-runtime", "--stdin"],
      {
        cwd: repoDir,
        env,
        input: prompt,
        encoding: "utf8",
      }
    );

    let parsed = null;

    try {
      parsed = JSON.parse(result.stdout || "{}");
    } catch (error) {
      throw new Error(
        [
          "Agent runtime did not return valid JSON.",
          "STDOUT:",
          result.stdout || "",
          "STDERR:",
          result.stderr || "",
        ].join("\n")
      );
    }

    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      json: parsed,
    };
  }

  function assertCommonSuccessShape(result) {
    assert.equal(result.status, 0, "Process should exit with status 0");
    assert.equal(result.json.ok, true, "Response ok should be true");
    assert.equal(
      result.json.mode,
      "multi-step-tool-calling",
      "Mode should be multi-step-tool-calling"
    );
    assert.ok(Array.isArray(result.json.steps), "steps should be an array");
    assert.equal(
      typeof result.json.stepCount,
      "number",
      "stepCount should be a number"
    );
    assert.equal(
      typeof result.json.finalAnswer,
      "string",
      "finalAnswer should be a string"
    );
  }

  function testReadRecordsByDateScenario(repoDir, env) {
    const result = runAgentRuntime({
      repoDir,
      env,
      prompt: "帮我看看 2026-04-23 的记录",
    });

    assertCommonSuccessShape(result);
    assert.ok(result.json.stepCount >= 1, "Date lookup should use at least one tool");
    assert.equal(
      result.json.steps[0].toolName,
      "read_records_by_date",
      "Date lookup should first call read_records_by_date"
    );
  }

  function testSearchRecordsScenario(repoDir, env) {
    const result = runAgentRuntime({
      repoDir,
      env,
      prompt: "帮我搜索一下和 Node.js 相关的记录",
    });

    assertCommonSuccessShape(result);
    assert.ok(result.json.stepCount >= 1, "Keyword search should use at least one tool");
    assert.equal(
      result.json.steps[0].toolName,
      "search_records",
      "Keyword search should first call search_records"
    );
  }

  function testRecentLearningScenario(repoDir, env) {
    const result = runAgentRuntime({
      repoDir,
      env,
      prompt: "帮我找最近一条 learning 记录，并总结我最近在学什么",
    });

    assertCommonSuccessShape(result);
    assert.ok(
      result.json.stepCount >= 1,
      "Recent learning query should use at least one tool"
    );
    assert.equal(
      result.json.steps[0].toolName,
      "list_records_by_type",
      "Recent learning query should first call list_records_by_type"
    );

    // 这个场景的理想目标是逼出第二步，但考虑到模型/兼容服务波动，
    // 这里只要求第一步工具必须正确，不强制 stepCount === 2。
    assert.ok(
      result.json.finalAnswer.includes("learning")
        || result.json.finalAnswer.includes("学习")
        || result.json.finalAnswer.includes("OpenAI Responses API"),
      "Final answer should mention the recent learning context"
    );
  }

  function main() {
    const repoDir = path.resolve(__dirname, "..");

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY environment variable");
    }

    const stateDir = createTempStateDir();
    const dataFile = path.join(stateDir, "career-dev-agent-data.json");
    writeTestDataFile(dataFile);

    const env = {
      ...process.env,
      CAREER_DEV_AGENT_STATE_DIR: stateDir,
      CAREER_DEV_AGENT_DATA_FILE: dataFile,
    };

    console.log("[test-agent-runtime] using temp data file:", dataFile);

    testReadRecordsByDateScenario(repoDir, env);
    console.log("[test-agent-runtime] passed: read_records_by_date scenario");

    testSearchRecordsScenario(repoDir, env);
    console.log("[test-agent-runtime] passed: search_records scenario");

    testRecentLearningScenario(repoDir, env);
    console.log("[test-agent-runtime] passed: recent learning scenario");

    console.log("[test-agent-runtime] all tests passed");
  }

  main();
