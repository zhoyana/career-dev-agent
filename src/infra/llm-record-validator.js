 // llm-record-validator.js 负责校验 LLM 返回的 JSON。
  // 它只负责“检查和整理”，不负责写入数据。

  function validateAndNormalizeLlmRecord(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("LLM output must be a JSON object");
    }

    const intent = normalizeIntent(raw.intent);
    const date = normalizeOptionalString(raw.date);
    const project = normalizeOptionalString(raw.project);
    const topic = normalizeOptionalString(raw.topic);
    const summary = normalizeRequiredString(raw.summary, "summary");
    const durationMinutes = normalizeDuration(raw.durationMinutes);
    const skills = normalizeStringArray(raw.skills, "skills");
    const bugs = normalizeBugArray(raw.bugs);

    if (intent === "learning" && !topic) {
      throw new Error("LLM learning output requires topic");
    }

    if (intent === "devlog" && !project) {
      throw new Error("LLM devlog output requires project");
    }

    return {
      intent,
      date,
      project,
      topic,
      summary,
      durationMinutes,
      skills,
      bugs,
    };
  }

  function normalizeIntent(value) {
    const normalized = String(value || "").trim().toLowerCase();

    if (normalized === "learning" || normalized === "learn" || normalized === "study") {
      return "learning";
    }

    if (normalized === "devlog" || normalized === "development" || normalized === "coding") {
      return "devlog";
    }

    throw new Error(`Invalid intent: ${value}`);
  }

  function normalizeRequiredString(value, fieldName) {
    const normalized = String(value || "").trim();

    if (!normalized) {
      throw new Error(`LLM output requires ${fieldName}`);
    }

    return normalized;
  }

  function normalizeOptionalString(value) {
    return String(value || "").trim();
  }

  function normalizeDuration(value) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      throw new Error("LLM output requires positive durationMinutes");
    }

    return numberValue;
  }

  function normalizeStringArray(value, fieldName) {
    if (!Array.isArray(value)) {
      throw new Error(`LLM output field ${fieldName} must be an array`);
    }

    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  function normalizeBugArray(value) {
    if (value === undefined || value === null) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw new Error("LLM output field bugs must be an array");
    }

    return value.map((bug) => {
      if (!bug || typeof bug !== "object" || Array.isArray(bug)) {
        throw new Error("Each bug must be an object");
      }

      return {
        title: String(bug.title || "").trim(),
        cause: String(bug.cause || "").trim(),
        solution: String(bug.solution || "").trim(),
      };
    });
  }

  module.exports = { validateAndNormalizeLlmRecord };

