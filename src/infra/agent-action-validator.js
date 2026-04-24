// agent-action-validator.js 负责校验 Agent v2 的结构化动作。
  // 它只负责检查和归一化，不负责真正执行动作。

  const { AGENT_INTENTS, AGENT_ACTIONS } = require("./agent-action-schema");

  function validateAndNormalizeAgentAction(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("Agent output must be a JSON object");
    }

    const intent = normalizeIntent(raw.intent);
    const action = normalizeAction(raw.action);
    const payload = normalizePayload(raw.payload);

    validateIntentActionPair(intent, action);

    return {
      intent,
      action,
      payload: normalizePayloadByIntent(intent, payload),
    };
  }

  function normalizeIntent(value) {
    const normalized = String(value || "").trim();

    if (Object.values(AGENT_INTENTS).includes(normalized)) {
      return normalized;
    }

    throw new Error(`Invalid agent intent: ${value}`);
  }

  function normalizeAction(value) {
    const normalized = String(value || "").trim();

    if (Object.values(AGENT_ACTIONS).includes(normalized)) {
      return normalized;
    }

    throw new Error(`Invalid agent action: ${value}`);
  }

  function normalizePayload(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Agent output payload must be an object");
    }

    return value;
  }

  function validateIntentActionPair(intent, action) {
    const expectedActionByIntent = {
      [AGENT_INTENTS.WRITE_LEARNING]: AGENT_ACTIONS.CREATE_LEARNING_RECORD,
      [AGENT_INTENTS.WRITE_DEVLOG]: AGENT_ACTIONS.CREATE_DEVLOG_RECORD,
      [AGENT_INTENTS.READ_DAY]: AGENT_ACTIONS.READ_RECORDS_BY_DATE,
      [AGENT_INTENTS.WEEKLY_REPORT]: AGENT_ACTIONS.GENERATE_WEEKLY_REPORT,
    };

    const expectedAction = expectedActionByIntent[intent];

    if (action !== expectedAction) {
      throw new Error(`Intent ${intent} does not match action ${action}`);
    }
  }

  function normalizePayloadByIntent(intent, payload) {
    if (intent === AGENT_INTENTS.WRITE_LEARNING) {
      return {
        date: normalizeOptionalString(payload.date),
        topic: normalizeRequiredString(payload.topic, "payload.topic"),
        summary: normalizeRequiredString(payload.summary, "payload.summary"),
        durationMinutes: normalizeDuration(payload.durationMinutes),
        skills: normalizeStringArray(payload.skills, "payload.skills"),
        source: normalizeOptionalString(payload.source),
      };
    }

    if (intent === AGENT_INTENTS.WRITE_DEVLOG) {
      return {
        date: normalizeOptionalString(payload.date),
        project: normalizeRequiredString(payload.project, "payload.project"),
        summary: normalizeRequiredString(payload.summary, "payload.summary"),
        durationMinutes: normalizeDuration(payload.durationMinutes),
        skills: normalizeStringArray(payload.skills, "payload.skills"),
        bugs: normalizeBugArray(payload.bugs),
        tests: normalizeTestsObject(payload.tests),
      };
    }

    if (intent === AGENT_INTENTS.READ_DAY) {
      return {
        date: normalizeRequiredString(payload.date, "payload.date"),
      };
    }

    if (intent === AGENT_INTENTS.WEEKLY_REPORT) {
      return {
        week: normalizeRequiredString(payload.week, "payload.week"),
      };
    }

    throw new Error(`Unsupported intent: ${intent}`);
  }

  function normalizeRequiredString(value, fieldName) {
    const normalized = String(value || "").trim();

    if (!normalized) {
      throw new Error(`Agent output requires ${fieldName}`);
    }

    return normalized;
  }

  function normalizeOptionalString(value) {
    return String(value || "").trim();
  }

  function normalizeDuration(value) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      throw new Error("Agent output requires positive payload.durationMinutes");
    }

    return numberValue;
  }

  function normalizeStringArray(value, fieldName) {
    if (!Array.isArray(value)) {
      throw new Error(`Agent output field ${fieldName} must be an array`);
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
      throw new Error("Agent output field payload.bugs must be an array");
    }

    return value.map((bug) => {
      if (!bug || typeof bug !== "object" || Array.isArray(bug)) {
        throw new Error("Each bug in payload.bugs must be an object");
      }

      return {
        title: normalizeOptionalString(bug.title),
        cause: normalizeOptionalString(bug.cause),
        solution: normalizeOptionalString(bug.solution),
      };
    });
  }

  function normalizeTestsObject(value) {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Agent output field payload.tests must be an object or null");
    }

    return {
      command: normalizeOptionalString(value.command),
      result: normalizeOptionalString(value.result),
    };
  }

  module.exports = { validateAndNormalizeAgentAction };
