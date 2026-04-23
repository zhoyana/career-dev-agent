// stats-cli.js 负责统计当前所有记录。
  // 它只读取数据，不修改数据。

  const { readData } = require("../infra/store");

  async function runStatsCommand(config) {
    const data = readData(config);
    const records = data.records;

    const learningRecords = records.filter((record) => {
      return record.type === "learning";
    });

    const devlogRecords = records.filter((record) => {
      return record.type === "devlog";
    });

    const result = {
      totalCount: records.length,
      learningCount: learningRecords.length,
      devlogCount: devlogRecords.length,
      learningMinutes: sumMinutes(learningRecords),
      devlogMinutes: sumMinutes(devlogRecords),
      skills: collectUniqueSkills(records),
    };

    console.log(JSON.stringify(result, null, 2));
  }

  function sumMinutes(records) {
    return records.reduce((sum, record) => {
      return sum + Number(record.durationMinutes || 0);
    }, 0);
  }

  function collectUniqueSkills(records) {
    const skills = new Set();

    for (const record of records) {
      const recordSkills = Array.isArray(record.skills) ? record.skills : [];

      for (const skill of recordSkills) {
        const normalizedSkill = String(skill || "").trim();

        if (normalizedSkill) {
          skills.add(normalizedSkill);
        }
      }
    }

    return Array.from(skills).sort();
  }

  module.exports = { runStatsCommand };

