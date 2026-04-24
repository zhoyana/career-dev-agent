// update-record-cli.js 负责按 id 更新记录。

  const { parseArgs, readStdinJson, requireOption } = require("../infra/cli-utils");
  const { updateRecordById } = require("../infra/store");

  async function runUpdateRecordCommand(config) {
    const options = parseArgs(process.argv.slice(3));

    if (!options.stdin) {
      throw new Error("update currently requires --stdin");
    }

    const id = requireOption(options, "id");
    const patch = await readStdinJson();

    const updated = updateRecordById(config, id, (record) => {
      return buildUpdatedRecord(record, patch);
    });

    if (!updated) {
      throw new Error(`Record not found: ${id}`);
    }

    console.log(JSON.stringify({
      ok: true,
      record: updated,
    }, null, 2));
  }

  function buildUpdatedRecord(record, patch) {
    return {
      ...record,

      // 只更新传进来的字段；没传的保留原值。
      summary: patch.summary !== undefined ? String(patch.summary || "").trim() : record.summary,
      durationMinutes: patch.durationMinutes !== undefined ? Number(patch.durationMinutes) :
  record.durationMinutes,
      skills: patch.skills !== undefined ? (Array.isArray(patch.skills) ? patch.skills : []) :
  record.skills,
      bugs: patch.bugs !== undefined ? (Array.isArray(patch.bugs) ? patch.bugs : []) :
  record.bugs,
      tests: patch.tests !== undefined ? patch.tests : record.tests,
      topic: patch.topic !== undefined ? String(patch.topic || "").trim() : record.topic,
      project: patch.project !== undefined ? String(patch.project || "").trim() : record.project,
      source: patch.source !== undefined ? String(patch.source || "").trim() : record.source,
    };
  }

  module.exports = { runUpdateRecordCommand };

