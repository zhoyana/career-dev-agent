// agent-action-executor.js 负责把结构化 action 真正执行成业务结果。
  // 它复用现有 CLI 对应的构造函数和 store 能力，避免重复实现一套逻辑。

  const { buildLearningRecord } = require("./write-learning-cli");
  const { buildDevlogRecord } = require("./write-devlog-cli");
  const { buildWeeklyReport } = require("./weekly-report-cli");
  const { addRecord, listRecordsByDate, listRecordsByWeek } = require("../infra/store")
  const { AGENT_INTENTS } = require("../infra/agent-action-schema");

  function executeAgentAction(config, action, options = {}) {
    if (action.intent === AGENT_INTENTS.WRITE_LEARNING) {
      return executeWriteLearning(config, action.payload, options);
    }

    if (action.intent === AGENT_INTENTS.WRITE_DEVLOG) {
      return executeWriteDevlog(config, action.payload, options);
    }

    if (action.intent === AGENT_INTENTS.READ_DAY) {
      return executeReadDay(config, action.payload);
    }

    if (action.intent === AGENT_INTENTS.WEEKLY_REPORT) {
      return executeWeeklyReport(config, action.payload);
    }

    throw new Error(`Unsupported agent intent: ${action.intent}`);
  }

  function executeWriteLearning(config, payload, options) {
    const record = buildLearningRecord(payload, options);
    addRecord(config, record);

    return {
      ok: true,
      intent: AGENT_INTENTS.WRITE_LEARNING,
      result: {
        id: record.id,
        type: record.type,
        date: record.date,
      },
    };
  }

  function executeWriteDevlog(config, payload, options) {
    const record = buildDevlogRecord(payload, options);
    addRecord(config, record);

    return {
      ok: true,
      intent: AGENT_INTENTS.WRITE_DEVLOG,
      result: {
        id: record.id,
        type: record.type,
        date: record.date,
        gitAttached: Boolean(record.git),
      },
    };
  }

  function executeReadDay(config, payload) {
    const records = listRecordsByDate(config, payload.date);

    return {
      ok: true,
      intent: AGENT_INTENTS.READ_DAY,
      result: {
        date: payload.date,
        count: records.length,
        records,
      },
    };
  }

  function executeWeeklyReport(config, payload) {


    const records = listRecordsByWeek(config, payload.week);

    return {
      ok: true,
      intent: AGENT_INTENTS.WEEKLY_REPORT,
      result: {
        week: payload.week,
        count: records.length,
        markdown: buildWeeklyReport(payload.week, records),
      },
    };
  }

  module.exports = { executeAgentAction };
