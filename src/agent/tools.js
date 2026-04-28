// tools.js 负责定义 Agent 可用的工具。
  // 每个工具都包含：name、description、inputSchema、execute。
  // 后续 LLM 会基于这些定义来决定调用哪个工具。

  const { readData, listRecordsByDate } = require("../infra/store");
  const { inspectGitRepo } = require("../infra/git-inspector");
  const { buildWeeklyReport } = require("../app/weekly-report-cli");

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
          "Typical requests include: 查看某一天的记录, 那天做了什么, 某日学了什么, 某日开发了什么.",
          "Input must include date in YYYY-MM-DD format.",
          "Prefer this tool over search_records when the user already provides an exact date.",
          "Do not use this tool for ISO week requests such as YYYY-W17; use generate_weekly_report instead.",
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
          "Use this tool when the user wants to search local records by keyword,topic, project, summary, or skill.",
          "Typical requests include: 搜索某个主题, 查和 Node.js 相关的记录, 找某个项目的开发日志, 检索某项技能.",
          "Input must include a natural language or keyword query string.",
          "Prefer this tool when the user does not provide an exact date and instead describes a concept, keyword, skill, or project name.",
          "Do not use this tool for exact single-date lookup if a YYYY-MM-DD date is already given; use read_records_by_date instead.",
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
          "Typical requests include: 最近几条 learning 记录, 最近几条开发日志, 最近在学什么, 最近做了哪些开发工作.",
          "Input type must be one of: learning or devlog.",
          "Use this tool first when you need candidate record ids before choosing one record to inspect in detail with get_record_by_id.",
          "Prefer this tool over search_records when the user asks for recent items by record type rather than keyword search.",
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
            records: records.slice(0, 10).map(summarizeRecordCandidate).filter(Boolean),
          };

        },
      },
      {
        name: "get_record_by_id",
        description: [
          "Use this tool when you already know a specific record id and need the full detail of that one record.",
          "Typical requests include: 查看某条记录详情, 读取刚才候选列表中的一条记录, 根据 id 获取完整内容.",
          "Input must include a record id string.",
          "Use this tool after list_records_by_type or other retrieval steps when you need one record in full detail before answering.",
          "Do not use this tool if you do not already have a concrete record id.",
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
        name: "inspect_git",
        description: [
          "Use this tool when the user asks about a git repository status, branch,diff, or recent commits.",
          "Typical requests include: 查看仓库状态, 检查 git diff, 最近提交, 当前分支,分析某个 repo.",
          "Input must include a repository path, absolute or relative.",
          "Prefer this tool only for repository inspection tasks, not for searching learning or devlog records.",
          "Do not use this tool for weekly reports, date-based record lookup, or keyword search in local memory records.",
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
          "Typical requests include: 生成周报, 查看某周总结, 汇总一周做了什么.",
          "Input must include week in ISO week format YYYY-Www, such as 2026-W17.",
          "Prefer this tool over read_records_by_date when the user asks about a whole week instead of one exact date.",
          "Do not use this tool for single-date requests or free-text keyword search.",
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
