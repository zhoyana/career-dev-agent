
# Career Dev Agent

这是一个学习版项目：从零构建“AI 求职学习 + 代码开发日志 Agent”的本地 CLI 工具。

## 当前已经实现的能力

- `write-learning`：写入学习记录
- `write-devlog`：写入代码开发日志
- `inspect-git`：读取 Git 仓库状态
- `read`：按日期读取记录
- `weekly-report`：生成周报 Markdown

## 运行帮助

```bash
node ./bin/career-dev-agent.js help
```

## 写入学习记录

```bash
cat ./examples/learning-record.json | node ./bin/career-dev-agent.js write-learning --stdin
```

## 检查 Git 仓库

```bash
node ./bin/career-dev-agent.js inspect-git --repo /home/jovyan/timeline-for-agent-main
```

## 写入开发日志

```bash
cat ./examples/devlog-record.json | node ./bin/career-dev-agent.js write-devlog --repo /home/jovyan/timeline-for-agent-main --stdin
```

## 按日期读取

```bash
node ./bin/career-dev-agent.js read --date 2026-04-23
```

## 生成周报

```bash
node ./bin/career-dev-agent.js weekly-report --week 2026-W17
```

## 数据保存在哪里

默认保存在：

```text
~/.career-dev-agent/career-dev-agent-data.json
```

你可以直接打开这个 JSON 文件观察数据结构。

## learning Note
