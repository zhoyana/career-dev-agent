// tools.js 负责定义 Agent 可用的工具。
  // 每个工具都包含：name、description、inputSchema、execute。
  // 后续 LLM 会基于这些定义来决定调用哪个工具。

  const { readData, listRecordsByDate } = require("../infra/store");
  const { inspectGitRepo } = require("../infra/git-inspector");
  const { buildWeeklyReport } = require("../app/weekly-report-cli");
  const {
    listRecentStructuredMemories,
    searchStructuredMemories,
    getStructuredMemoryById,
  } = require("../infra/structured-memory-store");

  function sortRecordsByCreatedAtDesc(records) {
    return [...records].sort((left, right) => {
      const leftTime = String(left.createdAt || "");
      const rightTime = String(right.createdAt || "");
      return rightTime.localeCompare(leftTime);
    });
  }

  function summarizeRecord(record) {
    return {
      id: record.id,
      type: record.type,
      date: record.date,
      week: record.week,
      topic: record.topic,
      project: record.project,
      summary: record.summary,
      durationMinutes: record.durationMinutes,
      skills: Array.isArray(record.skills) ? record.skills : [],
    };
  }

  function summarizeRecordCandidate(record) {
    if (!record || typeof record !== "object") {
      return null;
    }

    return {
      id: record.id,
      type: record.type,
      date: record.date,
      week: record.week,
      topic: record.topic,
      project: record.project,
    };
  }

  function createTools(config) {
    return [
      {
        name: "read_records_by_date",
        description: [
          "Use this tool when the user wants records for one specific calendar date.",
          "Input must include date in YYYY-MM-DD format.",
        ].join(" "),
        inputSchema: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description: "Date in YYYY-MM-DD format",
            },
          },
          required: ["date"],
          additionalProperties: false,
        },
        execute: async (input) => {
          const records = listRecordsByDate(config, input.date);

          return {
            date: input.date,
            count: records.length,
            records,
          };
        },
      },
      {
        name: "search_records",
        description: [
          "Use this tool when the user wants to search local records by keyword, topic, project, summary, or skill.",
          "Input must include a query string.",
        ].join(" "),
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Keyword to search in local records",
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
        execute: async (input) => {
          const data = readData(config);
          const query = String(input.query || "").trim().toLowerCase();

          const records = data.records.filter((record) => {
            const text = [
              record.topic || "",
              record.project || "",
              record.summary || "",
              ...(Array.isArray(record.skills) ? record.skills : []),
            ]
              .join(" ")
              .toLowerCase();

            return text.includes(query);
          });

          return {
            query: input.query,
            count: records.length,
            records: records.slice(0, 20),
          };
        },
      },
      {
        name: "list_records_by_type",
        description: [
          "Use this tool when the user wants recent records of one type, such as recent learning records or recent devlog records.",
          "Input type must be learning or devlog.",
        ].join(" "),
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["learning", "devlog"],
              description: "Record type, must be learning or devlog",
            },
          },
          required: ["type"],
          additionalProperties: false,
        },
        execute: async (input) => {
          const data = readData(config);
          const type = String(input.type || "").trim();

          const records = sortRecordsByCreatedAtDesc(
            data.records.filter((record) => record.type === type)
          );

          return {
            type,
            count: records.length,
            records: records
              .slice(0, 10)
              .map(summarizeRecordCandidate)
              .filter(Boolean),
          };
        },
      },
      {
        name: "get_record_by_id",
        description: [
          "Use this tool when you already know a specific record id and need the full detail of that one record.",
        ].join(" "),
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Exact record id",
            },
          },
          required: ["id"],
          additionalProperties: false,
        },
        execute: async (input) => {
          const data = readData(config);
          const id = String(input.id || "").trim();
          const record = data.records.find((item) => item.id === id) || null;

          return {
            id,
            found: Boolean(record),
            record,
          };
        },
      },
      {
        name: "list_recent_memories",
        description: [
          "Use this tool when the user asks what has been learned or discussed recently across sessions.",
          "This tool returns recent structured long-term memories rather than raw records.",
          "Always provide limit as a string number such as 5.",
        ].join(" "),
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "string",
              description: "Optional result limit as a string number, for example 5",
            },
          },
          required: ["limit"],
          additionalProperties: false,
        },
        execute: async (input) => {
          const limit = Number(String(input.limit || "").trim() || "5");

          return listRecentStructuredMemories(config, { limit });
        },
      },
      {
        name: "search_memories",
        description: [
          "Use this tool when the user asks about long-term themes, recent learning focus, recent project focus, or previously summarized conclusions.",
          "Use this before raw record search when the question is about persistent memory rather than one exact record.",
          "Always provide limit as a string number such as 5.",
        ].join(" "),
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Keyword query for structured long-term memories",
            },
            limit: {
              type: "string",
              description: "Optional result limit as a string number, for example 5",
            },
          },
          required: ["query","limit"],
          additionalProperties: false,
        },
        execute: async (input) => {
          const limit = Number(String(input.limit || "").trim() || "10");

          return searchStructuredMemories(config, input.query, { limit });
        },
      },
      {
        name: "get_memory_by_id",
        description: [
          "Use this tool when you already know a structured memory id and need its full detail.",
        ].join(" "),
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Exact structured memory id",
            },
          },
          required: ["id"],
          additionalProperties: false,
        },
        execute: async (input) => {
          return getStructuredMemoryById(config, input.id);
        },
      },
      {
        name: "inspect_git",
        description: [
          "Use this tool when the user asks about a git repository status, branch,diff, or recent commits.",
        ].join(" "),
        inputSchema: {
          type: "object",
          properties: {
            repo: {
              type: "string",
              description: "Absolute or relative path to a git repository",
            },
          },
          required: ["repo"],
          additionalProperties: false,
        },
        execute: async (input) => {
          return inspectGitRepo(input.repo);
        },
      },
      {
        name: "generate_weekly_report",
        description: [
          "Use this tool when the user wants a weekly summary or weekly report for one ISO week.",
        ].join(" "),
        inputSchema: {
          type: "object",
          properties: {
            week: {
              type: "string",
              description: "ISO week like YYYY-Www",
            },
          },
          required: ["week"],
          additionalProperties: false,
        },
        execute: async (input) => {
          const data = readData(config);
          const week = String(input.week || "").trim();

          const records = data.records.filter((record) => {
            return record.week === week;
          });

          return {
            week,
            count: records.length,
            markdown: buildWeeklyReport(week, records),
          };
        },
      },
    ];
  }

  module.exports = { createTools };
