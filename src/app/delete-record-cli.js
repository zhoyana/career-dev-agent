// delete-record-cli.js 负责按 id 删除一条记录。

  const { parseArgs, requireOption } = require("../infra/cli-utils");
  const { deleteRecordById } = require("../infra/store");

  async function runDeleteRecordCommand(config) {
    const options = parseArgs(process.argv.slice(3));
    const id = requireOption(options, "id");

    const deleted = deleteRecordById(config, id);

    if (!deleted) {
      throw new Error(`Record not found: ${id}`);
    }

    console.log(JSON.stringify({
      ok: true,
      deletedId: id,
    }, null, 2));
  }

  module.exports = { runDeleteRecordCommand };
