// structured-memory-store.js 负责存储结构化长期记忆。
  // 当前版本提供：写入门控、去重、压缩记忆、最近记忆列表、关键词搜索、按 id 获取详情。
  // 修复点：同 group 的 compressed memory 会覆盖旧版本；展示时按 group 去重。

  const fs = require("fs");
  const path = require("path");

  function createEmptyStructuredMemoryData() {
    return {
      version: 1,
      memories: [],
    };
  }

  function ensureParentDirectory(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  function getStructuredMemoryFile(config) {
    return path.join(config.stateDir, "structured-memories.json");
  }

  function readStructuredMemoryData(config) {
    const filePath = getStructuredMemoryFile(config);
    ensureParentDirectory(filePath);

    if (!fs.existsSync(filePath)) {
      return createEmptyStructuredMemoryData();
    }

    const text = fs.readFileSync(filePath, "utf8");

    if (!text.trim()) {
      return createEmptyStructuredMemoryData();
    }

    const parsed = JSON.parse(text);

    return {
      version: 1,
      memories: Array.isArray(parsed && parsed.memories) ? parsed.memories : [],
    };
  }

  function writeStructuredMemoryData(config, data) {
    const filePath = getStructuredMemoryFile(config);
    ensureParentDirectory(filePath);

    const text = JSON.stringify(data, null, 2);
    const tmpFile = `${filePath}.tmp`;

    fs.writeFileSync(tmpFile, `${text}\n`, "utf8");
    fs.renameSync(tmpFile, filePath);
  }

  function truncateText(text, maxLength = 280) {
    const normalizedText = String(text || "").trim();

    if (normalizedText.length <= maxLength) {
      return normalizedText;
    }

    return `${normalizedText.slice(0, maxLength)}...(truncated)`;
  }

  function uniqueStrings(values) {
    return [...new Set(values.filter(Boolean).map((value) => String(value).trim()))];
  }

  function sortMemoriesByPriority(memories) {
    return [...memories].sort((left, right) => {
      const leftCompressed = Boolean(left.isCompressed);
      const rightCompressed = Boolean(right.isCompressed);

      if (leftCompressed !== rightCompressed) {
        return rightCompressed ? 1 : -1;
      }

      return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
    });
  }

  function collectRecordsFromResult(result) {
    const steps = Array.isArray(result && result.steps) ? result.steps : [];
    const records = [];

    for (const step of steps) {
      const toolResult = step && step.toolResult ? step.toolResult : null;

      if (!toolResult || typeof toolResult !== "object") {
        continue;
      }

      if (toolResult.record && typeof toolResult.record === "object") {
        records.push(toolResult.record);
      }

      if (Array.isArray(toolResult.records)) {
        for (const record of toolResult.records) {
          if (record && typeof record === "object") {
            records.push(record);
          }
        }
      }
    }

    return records;
  }

  function inferMemoryType(userInput, result, records) {
    const text = `${String(userInput || "")}\n${String(result.finalAnswer || "")}`.toLowerCase();
    const toolNames = (result.steps || []).map((step) => step.toolName);

    if (toolNames.includes("generate_weekly_report")) {
      return "weekly_summary";
    }

    if (toolNames.includes("inspect_git")) {
      return "git_insight";
    }

    if (text.includes("learning") || text.includes("学习")) {
      return "learning_focus";
    }

    if (text.includes("devlog") || text.includes("开发") || text.includes("项目")) {
      return "project_focus";
    }

    if (records.length > 0) {
      return "record_insight";
    }

    return "chat_insight";
  }

  function inferTitle(memoryType, records, userInput) {
    const firstRecord = records[0] || null;

    if (memoryType === "learning_focus" && firstRecord && firstRecord.topic) {
      return `最近学习重点：${firstRecord.topic}`;
    }

    if (memoryType === "project_focus" && firstRecord && firstRecord.project) {
      return `最近开发重点：${firstRecord.project}`;
    }

    if (memoryType === "weekly_summary" && firstRecord && firstRecord.week) {
      return `周总结：${firstRecord.week}`;
    }

    return truncateText(userInput, 80);
  }

  function inferTags(records, result, memoryType) {
    const recordSkills = records.flatMap((record) => {
      return Array.isArray(record.skills) ? record.skills : [];
    });

    const recordTopics = records.flatMap((record) => {
      return [record.topic, record.project];
    });

    const toolNames = (result.steps || []).map((step) => step.toolName);

    return uniqueStrings([
      memoryType,
      ...toolNames,
      ...recordTopics,
      ...recordSkills,
    ]).slice(0, 12);
  }

  function collectRelatedRecordIds(records) {
    return uniqueStrings(records.map((record) => record.id)).slice(0, 10);
  }

  function hasWeakLanguage(text) {
    const normalizedText = String(text || "");

    const weakPhrases = [
      "没有明确提到",
      "可能是",
      "可能在",
      "你可以回顾",
      "你可以再查",
      "未记录",
      "不确定",
      "无法确认",
      "没有找到明确",
      "推测",
      "猜测",
    ];

    return weakPhrases.some((phrase) => normalizedText.includes(phrase));
  }

  function shouldPersistStructuredMemory(result, records) {
    if (!result || result.ok !== true) {
      return false;
    }

    if (!String(result.finalAnswer || "").trim()) {
      return false;
    }

    if (Number(result.stepCount || 0) < 1) {
      return false;
    }

    if (records.length === 0) {
      return false;
    }

    if (hasWeakLanguage(result.finalAnswer || "")) {
      return false;
    }

    return true;
  }

  function buildStructuredMemoryEntry({ sessionId, userInput, result }) {
    const now = new Date().toISOString();
    const records = collectRecordsFromResult(result);
    const memoryType = inferMemoryType(userInput, result, records);
    const title = inferTitle(memoryType, records, userInput);
    const tags = inferTags(records, result, memoryType);
    const relatedRecordIds = collectRelatedRecordIds(records);
    const toolNames = uniqueStrings((result.steps || []).map((step) => step.toolName));

    const entry = {
    id: `memory:${Date.now()}`,
    memoryType,
    title,
    summary: truncateText(result.finalAnswer || "", 400),
    userInput: truncateText(userInput || "", 200),
    toolNames,
    relatedRecordIds,
    tags,
    sourceSessionId: sessionId,
    stepCount: Number(result.stepCount || 0),
    createdAt: now,
    isCompressed: false,
    compressedFromCount: 0,
    sourceMemoryIds: [],
    groupKey: "",
  };

  entry.groupKey = buildCompressionGroupKey(entry);

  return entry;

  }

  function isDuplicateMemory(existingMemory, nextMemory) {
    return (
      existingMemory.memoryType === nextMemory.memoryType
      && existingMemory.title === nextMemory.title
      && existingMemory.summary === nextMemory.summary
    );
  }

  function appendStructuredMemory(config, payload) {
    const data = readStructuredMemoryData(config);
    const records = collectRecordsFromResult(payload.result);

    if (!shouldPersistStructuredMemory(payload.result, records)) {
      return null;
    }

    const entry = buildStructuredMemoryEntry(payload);

    const duplicated = data.memories.some((memory) => {
      return isDuplicateMemory(memory, entry);
    });

    if (duplicated) {
      return null;
    }

    data.memories.push(entry);
    writeStructuredMemoryData(config, data);

    return entry;
  }

  function summarizeMemory(memory) {
    return {
      id: memory.id,
      memoryType: memory.memoryType,
      title: memory.title,
      summary: memory.summary,
      tags: Array.isArray(memory.tags) ? memory.tags : [],
      toolNames: Array.isArray(memory.toolNames) ? memory.toolNames : [],
      relatedRecordIds: Array.isArray(memory.relatedRecordIds)
        ? memory.relatedRecordIds
        : [],
      createdAt: memory.createdAt,
      isCompressed: Boolean(memory.isCompressed),
      compressedFromCount: Number(memory.compressedFromCount || 0),
      sourceMemoryIds: Array.isArray(memory.sourceMemoryIds)
        ? memory.sourceMemoryIds
        : [],
      groupKey: memory.groupKey || "",
    };
  }

  function buildCompressionGroupKey(memory) {
    const type = String(memory.memoryType || "");
    const relatedIds = Array.isArray(memory.relatedRecordIds)
      ? memory.relatedRecordIds.slice(0, 3).join("|")
      : "";

    if (relatedIds) {
      return `${type}::${relatedIds}`;
    }

    const topicTag = (Array.isArray(memory.tags) ? memory.tags : []).find((tag) => {
      return ![
        "learning_focus",
        "project_focus",
        "record_insight",
        "chat_insight",
        "weekly_summary",
        "git_insight",
        "list_records_by_type",
        "get_record_by_id",
        "search_records",
        "read_records_by_date",
        "list_recent_memories",
        "search_memories",
        "get_memory_by_id",
      ].includes(tag);
    }) || "";

    if (topicTag) {
      return `${type}::${topicTag}`;
    }

    return `${type}::${memory.title || ""}`;
  }

  function canCompressMemory(memory) {
    if (!memory) {
      return false;
    }

    if (memory.isCompressed) {
      return false;
    }

    return ["learning_focus", "project_focus", "record_insight"].includes(memory.memoryType);
  }

  function buildCompressedMemory(group) {
    const sorted = [...group].sort((left, right) => {
      return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
    });

    const head = sorted[0];
    const title = head.title;
    const memoryType = head.memoryType;
    const groupKey = buildCompressionGroupKey(head);
    const summary = truncateText(
      uniqueStrings(sorted.map((memory) => memory.summary)).join(" "),
      500
    );

    return {
      id: `memory:${Date.now()}:${Math.floor(Math.random() * 1000)}`,
      memoryType,
      title,
      summary,
      userInput: "",
      toolNames: uniqueStrings(sorted.flatMap((memory) => memory.toolNames || [])).slice(0, 12),
      relatedRecordIds: uniqueStrings(
        sorted.flatMap((memory) => memory.relatedRecordIds || [])
      ).slice(0, 12),
      tags: uniqueStrings(sorted.flatMap((memory) => memory.tags || [])).slice(0, 12),
      sourceSessionId: "",
      stepCount: Math.max(...sorted.map((memory) => Number(memory.stepCount || 0)), 0),
      createdAt: new Date().toISOString(),
      isCompressed: true,
      compressedFromCount: sorted.length,
      sourceMemoryIds: sorted.map((memory) => memory.id),
      groupKey,
    };
  }

  function compressStructuredMemories(config) {
    const data = readStructuredMemoryData(config);
    const rawMemories = data.memories.filter(canCompressMemory);

    if (rawMemories.length < 2) {
      return null;
    }

    const groups = new Map();

    for (const memory of rawMemories) {
      const key = buildCompressionGroupKey(memory);

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key).push(memory);
    }

    let appended = null;
    let changed = false;

    for (const [groupKey, group] of groups.entries()) {
      if (group.length < 2) {
        continue;
      }

      const compressed = buildCompressedMemory(group);
      compressed.groupKey = groupKey;

      // 删除同 groupKey 的旧 compressed memory，只保留最新压缩结果。
      const beforeCount = data.memories.length;
      data.memories = data.memories.filter((memory) => {
        return !(memory.isCompressed && memory.groupKey === groupKey);
      });

      if (data.memories.length !== beforeCount) {
        changed = true;
      }

      data.memories.push(compressed);
      appended = compressed;
      changed = true;
    }

    if (changed) {
      writeStructuredMemoryData(config, data);
    }

    return appended;
  }

  function dedupeMemoriesForDisplay(memories) {
    const sorted = sortMemoriesByPriority(memories);
    const compressedByGroup = new Map();
    const rawByGroup = new Map();
    const noGroupMemories = [];

    for (const memory of sorted) {
      const groupKey = String(memory.groupKey || "").trim();

      if (!groupKey) {
        noGroupMemories.push(memory);
        continue;
      }

      if (memory.isCompressed) {
        if (!compressedByGroup.has(groupKey)) {
          compressedByGroup.set(groupKey, memory);
        }
        continue;
      }

      if (!rawByGroup.has(groupKey)) {
        rawByGroup.set(groupKey, memory);
      }
    }

    const merged = [];

    // 如果某个 group 有 compressed，就只保留 compressed。
    for (const [groupKey, memory] of compressedByGroup.entries()) {
      merged.push(memory);
      rawByGroup.delete(groupKey);
    }

    // 只有不存在 compressed 的 group，才展示 raw。
    for (const memory of rawByGroup.values()) {
      merged.push(memory);
    }

    // 没有 groupKey 的记忆单独保留。
    for (const memory of noGroupMemories) {
      merged.push(memory);
    }

    return sortMemoriesByPriority(merged);
  }


  function listRecentStructuredMemories(config, options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit || 5), 20));
    const data = readStructuredMemoryData(config);
    const deduped = dedupeMemoriesForDisplay(data.memories).slice(0, limit);

    return {
      count: deduped.length,
      memories: deduped.map(summarizeMemory),
    };
  }

  function searchStructuredMemories(config, query, options = {}) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    const limit = Math.max(1, Math.min(Number(options.limit || 10), 20));
    const data = readStructuredMemoryData(config);

    const matched = data.memories.filter((memory) => {
      const text = [
        memory.memoryType || "",
        memory.title || "",
        memory.summary || "",
        ...(Array.isArray(memory.tags) ? memory.tags : []),
        ...(Array.isArray(memory.toolNames) ? memory.toolNames : []),
        ...(Array.isArray(memory.relatedRecordIds) ? memory.relatedRecordIds : []),
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(normalizedQuery);
    });

    const deduped = dedupeMemoriesForDisplay(matched).slice(0, limit);

    return {
      query,
      count: deduped.length,
      memories: deduped.map(summarizeMemory),
    };
  }

  function getStructuredMemoryById(config, id) {
    const normalizedId = String(id || "").trim();
    const data = readStructuredMemoryData(config);
    const memory = data.memories.find((item) => item.id === normalizedId) || null;

    return {
      id: normalizedId,
      found: Boolean(memory),
      memory,
    };
  }

  function buildStructuredMemoryContextText(config, options = {}) {
    const maxMemories = Number(options.maxMemories || 5);
    const maxChars = Number(options.maxChars || 1400);

    const recent = listRecentStructuredMemories(config, {
      limit: maxMemories,
    });

    if (recent.count === 0) {
      return "";
    }

    const lines = ["可参考的结构化长期记忆："];

    for (const memory of recent.memories) {
      lines.push(
        [
          `- [${memory.memoryType}] ${memory.title}`,
          `  summary: ${truncateText(memory.summary || "", 220)}`,
          `  tags: ${(memory.tags || []).join(", ")}`,
          `  tools: ${(memory.toolNames || []).join(", ")}`,
          `  compressed: ${memory.isCompressed ? `yes (${memory.compressedFromCount})` : "no"}`,
        ].join("\n")
      );
    }

    return truncateText(lines.join("\n"), maxChars);
  }

  module.exports = {
    appendStructuredMemory,
    buildStructuredMemoryContextText,
    compressStructuredMemories,
    getStructuredMemoryById,
    getStructuredMemoryFile,
    listRecentStructuredMemories,
    readStructuredMemoryData,
    searchStructuredMemories,
  };
