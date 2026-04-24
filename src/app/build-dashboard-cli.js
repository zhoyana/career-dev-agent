// build-dashboard-cli.js 负责命令行触发 dashboard 生成。

  const { buildDashboard } = require("../infra/dashboard-builder");

  async function runBuildDashboardCommand(config) {
    const result = buildDashboard(config);

    console.log(JSON.stringify({
      ok: true,
      outputFile: result.outputFile,
      stats: result.stats,
    }, null, 2));
  }

  module.exports = { runBuildDashboardCommand };
