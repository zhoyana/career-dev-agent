// config.js 负责集中管理配置。
// 这样以后要改数据文件路径，不需要到处找代码。

const os = require("os");
const path = require("path");

function readConfig() {
  // os.homedir() 会返回当前用户的 home 目录。
  // 在你的机器上通常是 /home/jovyan。
  const homeDir = os.homedir();

  // 环境变量允许用户覆盖默认位置。
  // 如果没有设置 CAREER_DEV_AGENT_STATE_DIR，就使用 ~/.career-dev-agent。
  const stateDir = process.env.CAREER_DEV_AGENT_STATE_DIR
    || path.join(homeDir, ".career-dev-agent");

  return {
    stateDir,

    // 所有学习日志、开发日志暂时都存在这一个 JSON 文件里。
    dataFile: process.env.CAREER_DEV_AGENT_DATA_FILE
      || path.join(stateDir, "career-dev-agent-data.json"),
  };
}

module.exports = { readConfig };
