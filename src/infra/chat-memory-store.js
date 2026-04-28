// chat-memory-store.js 负责存储 chat 模式下的会话 turn。
  // 当前文件只负责 session memory，不再负责长期记忆摘要。

  const fs = require("fs");
  const path = require("path");

  function createEmptyChatMemory() {
    return {
      version: 1,
      sessions: [],
    };
  }

  function ensureParentDirectory(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  function getChatMemoryFile(config) {
    return path.join(config.stateDir, "chat-memory.json");
  }

  function readChatMemory(config) {
    const filePath = getChatMemoryFile(config);
    ensureParentDirectory(filePath);

    if (!fs.existsSync(filePath)) {
      return createEmptyChatMemory();
    }

    const text = fs.readFileSync(filePath, "utf8");

    if (!text.trim()) {
      return createEmptyChatMemory();
    }

    const parsed = JSON.parse(text);

    return {
      version: 1,
      sessions: Array.isArray(parsed && parsed.sessions) ? parsed.sessions : [],
    };
  }

  function writeChatMemory(config, data) {
    const filePath = getChatMemoryFile(config);
    ensureParentDirectory(filePath);

    const text = JSON.stringify(data, null, 2);
    const tmpFile = `${filePath}.tmp`;

    fs.writeFileSync(tmpFile, `${text}\n`, "utf8");
    fs.renameSync(tmpFile, filePath);
  }

  function createChatSession(config) {
    const data = readChatMemory(config);
    const now = new Date().toISOString();

    const session = {
      id: `chat:${Date.now()}`,
      createdAt: now,
      updatedAt: now,
      turns: [],
    };

    data.sessions.push(session);
    writeChatMemory(config, data);

    return session;
  }

  function appendTurn(config, sessionId, role, text) {
    const data = readChatMemory(config);
    const session = data.sessions.find((item) => item.id === sessionId);

    if (!session) {
      throw new Error(`Chat session not found: ${sessionId}`);
    }

    const now = new Date().toISOString();

    session.turns.push({
      role,
      text: String(text || "").trim(),
      createdAt: now,
    });

    session.updatedAt = now;
    writeChatMemory(config, data);
  }

  function getSessionTurns(config, sessionId) {
    const data = readChatMemory(config);
    const session = data.sessions.find((item) => item.id === sessionId);

    if (!session) {
      return [];
    }

    return Array.isArray(session.turns) ? session.turns : [];
  }

  function truncateText(text, maxLength = 280) {
    const normalizedText = String(text || "").trim();

    if (normalizedText.length <= maxLength) {
      return normalizedText;
    }

    return `${normalizedText.slice(0, maxLength)}...(truncated)`;
  }

  function buildSessionContextText(config, sessionId, options = {}) {
    const maxTurns = Number(options.maxTurns || 6);
    const turns = getSessionTurns(config, sessionId);

    if (turns.length === 0) {
      return "";
    }

    const recentTurns = turns.slice(-maxTurns);

    return [
      "当前会话最近上下文：",
      ...recentTurns.map((turn) => {
        return `${turn.role}: ${truncateText(turn.text, 400)}`;
      }),
    ].join("\n");
  }

  module.exports = {
    appendTurn,
    buildSessionContextText,
    createChatSession,
    getChatMemoryFile,
    getSessionTurns,
  };
