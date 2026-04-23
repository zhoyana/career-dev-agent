// weekly-report-cli.js 负责生成周报。
//
// 用法示例：
//   node ./bin/career-dev-agent.js weekly-report --week 2026-W17

const { listRecordsByWeek } = require("../infra/store");
const { getIsoWeek, parseArgs, todayDateString } = require("../infra/cli-utils");

async function runWeeklyReportCommand(config) {
  const options = parseArgs(process.argv.slice(3));

  // 如果用户没有传 --week，就默认生成今天所在周的周报。
  const week = String(options.week || getIsoWeek(todayDateString())).trim();
  const records = listRecordsByWeek(config, week);

  console.log(buildWeeklyReport(week, records));
}

function buildWeeklyReport(week, records) {
  const learningRecords = records.filter((record) => record.type === "learning");
  const devlogRecords = records.filter((record) => record.type === "devlog");

  const learningMinutes = sumMinutes(learningRecords);
  const devlogMinutes = sumMinutes(devlogRecords);
  const skills = collectSkills(records);
  const projects = collectProjects(devlogRecords);
  const bugs = collectBugs(devlogRecords);

  const lines = [];
  lines.push(`# Career Dev Agent Weekly Report: ${week}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Learning records: ${learningRecords.length}`);
  lines.push(`- Development logs: ${devlogRecords.length}`);
  lines.push(`- Learning time: ${learningMinutes} minutes`);
  lines.push(`- Development time: ${devlogMinutes} minutes`);
  lines.push("");

  lines.push("## Learning");
  lines.push("");
  if (learningRecords.length === 0) {
    lines.push("- No learning records.");
  } else {
    for (const record of learningRecords) {
      lines.push(`- ${record.topic}: ${record.summary} (${record.durationMinutes} min)`);
    }
  }
  lines.push("");

  lines.push("## Development");
  lines.push("");
  if (devlogRecords.length === 0) {
    lines.push("- No development logs.");
  } else {
    for (const record of devlogRecords) {
      lines.push(`- ${record.project}: ${record.summary} (${record.durationMinutes} min)`);
      if (record.git && record.git.changedFiles && record.git.changedFiles.length > 0) {
        lines.push(`  - Changed files: ${record.git.changedFiles.slice(0, 5).join(", ")}`);
      }
    }
  }
  lines.push("");

  lines.push("## Skills");
  lines.push("");
  if (skills.length === 0) {
    lines.push("- No skills recorded.");
  } else {
    for (const skill of skills) {
      lines.push(`- ${skill}`);
    }
  }
  lines.push("");

  lines.push("## Projects");
  lines.push("");
  if (projects.length === 0) {
    lines.push("- No projects recorded.");
  } else {
    for (const project of projects) {
      lines.push(`- ${project}`);
    }
  }
  lines.push("");

  lines.push("## Bugs And Fixes");
  lines.push("");
  if (bugs.length === 0) {
    lines.push("- No bugs recorded.");
  } else {
    for (const bug of bugs) {
      lines.push(`- ${bug.title || "Untitled bug"}: ${bug.solution || bug.summary || "No solution recorded"}`);
    }
  }
  lines.push("");

  return lines.join("\n");
}

function sumMinutes(records) {
  return records.reduce((sum, record) => {
    return sum + Number(record.durationMinutes || 0);
  }, 0);
}

function collectSkills(records) {
  const skills = new Set();

  for (const record of records) {
    for (const skill of Array.isArray(record.skills) ? record.skills : []) {
      skills.add(String(skill).trim());
    }
  }

  return Array.from(skills).filter(Boolean).sort();
}

function collectProjects(records) {
  const projects = new Set();

  for (const record of records) {
    if (record.project) {
      projects.add(record.project);
    }
  }

  return Array.from(projects).sort();
}

function collectBugs(records) {
  const bugs = [];

  for (const record of records) {
    if (Array.isArray(record.bugs)) {
      bugs.push(...record.bugs);
    }
  }

  return bugs;
}

module.exports = { buildWeeklyReport, runWeeklyReportCommand };
