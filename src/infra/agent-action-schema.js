// agent-action-schema.js 负责定义 Agent v2 的意图和动作常量。
  // 这样 prompt、validator 和 executor 可以共享同一套契约。

  const AGENT_INTENTS = {
    WRITE_LEARNING: "write_learning",
    WRITE_DEVLOG: "write_devlog",
    READ_DAY: "read_day",
    WEEKLY_REPORT: "weekly_report",
  };

  const AGENT_ACTIONS = {
    CREATE_LEARNING_RECORD: "create_learning_record",
    CREATE_DEVLOG_RECORD: "create_devlog_record",
    READ_RECORDS_BY_DATE: "read_records_by_date",
    GENERATE_WEEKLY_REPORT: "generate_weekly_report",
  };

  function getSupportedIntentList() {
    return Object.values(AGENT_INTENTS);
  }

  function getSupportedActionList() {
    return Object.values(AGENT_ACTIONS);
  }

  module.exports = {
    AGENT_INTENTS,
    AGENT_ACTIONS,
    getSupportedIntentList,
    getSupportedActionList,
  };
