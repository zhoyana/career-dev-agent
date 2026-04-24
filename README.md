# Career Dev Agent

  本地 AI 求职学习与开发日志 Agent。
  它把自然语言学习/开发记录转成结构化 JSON，写入本地长期记忆，并生成统计、查询、删除和周报。

  ## Why

  学习和做项目时，信息很容易散落在聊天、终端和脑子里。
  这个项目的目标是把这些碎片沉淀成可查询、可统计、可复盘的记录。

  ## Features

  - `write-learning`: 写入学习记录
  - `write-devlog`: 写入开发日志
  - `read`: 按日期读取
  - `list`: 列出记录，可按类型过滤
  - `stats`: 统计记录数量、时长、技能
  - `delete`: 按 id 删除记录
  - `weekly-report`: 生成周报
  - `agent`: 规则版自然语言记录
  - `agent-llm`: LLM 版自然语言记录
  - `agent-llm --dry-run`: 只解析，不写入

  ## Architecture

  自然语言输入 -> Agent 解析 -> 结构化 JSON -> 本地存储 -> 统计/周报

  核心模块：
  - `src/app/`: CLI 命令
  - `src/infra/store.js`: JSON 存储
  - `src/infra/openai-client.js`: LLM 调用
  - `src/index.js`: 命令分发

  ## Quick Start

  ```bash
  npm install
  npm run check

  设置环境变量：

  export OPENAI_API_KEY="your_key"
  export OPENAI_BASE_URL="your_openai_compatible_base_url"

  ## Examples

  规则版 Agent：

  cat <<'EOF' | node ./bin/career-dev-agent.js agent --stdin
  今天我在 career-dev-agent 项目上花了 2 小时，实现了 list 命令，学习了 Node.js CLI、filter 和
  map。
  EOF

  LLM 版 Agent 预览：

  cat <<'EOF' | node ./bin/career-dev-agent.js agent-llm --stdin --dry-run
  今天我在 career-dev-agent 项目上花了 1 小时，实现了 dry-run 功能，并学习了 JSON 输出约束。
  EOF

  真实写入后查看：

  node ./bin/career-dev-agent.js stats
  node ./bin/career-dev-agent.js weekly-report --week 2026-W17

  ## Data

  默认数据文件：

  ~/.career-dev-agent/career-dev-agent-data.json

  ## Roadmap

  - 更稳的 intent 识别
  - 更好的 JSON 校验与重试
  - Dashboard
  - 企业微信桥接

