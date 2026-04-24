  const fs = require("fs");
    const path = require("path");

    const { readData } = require("./store");

    function buildDashboard(config) {
      const data = readData(config);
      const records = Array.isArray(data.records) ? data.records : [];

      const learningRecords = records.filter((record) => {
        return record.type === "learning";
      });

      const devlogRecords = records.filter((record) => {
        return record.type === "devlog";
      });

      const stats = {
        totalCount: records.length,
        learningCount: learningRecords.length,
        devlogCount: devlogRecords.length,
        learningMinutes: sumMinutes(learningRecords),
        devlogMinutes: sumMinutes(devlogRecords),
        generatedAt: formatGeneratedAt(new Date()),
      };

      const recentRecords = [...records]
        .sort((left, right) => {
          return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
        })
        .slice(0, 10);

      const topSkills = buildTopSkills(records);
      const recentTrend = buildRecentTrend(records, 7);

      fs.mkdirSync(config.siteDir, { recursive: true });

      const outputFile = path.join(config.siteDir, "dashboard.html");
      const html = buildDashboardHtml(stats, recentTrend, recentRecords, topSkills);

      fs.writeFileSync(outputFile, html, "utf8");

      return {
        outputFile,
        stats,
      };
    }

    function sumMinutes(records) {
      return records.reduce((sum, record) => {
        return sum + Number(record.durationMinutes || 0);
      }, 0);
    }

    function buildTopSkills(records) {
      const skillCounts = new Map();

      for (const record of records) {
        const skills = Array.isArray(record.skills) ? record.skills : [];

        for (const skill of skills) {
          const key = String(skill || "").trim();

          if (!key) {
            continue;
          }

          const current = skillCounts.get(key) || 0;
          skillCounts.set(key, current + 1);
        }
      }

      return Array.from(skillCounts.entries())
        .map(([skill, count]) => {
          return { skill, count };
        })
        .sort((left, right) => {
          if (right.count !== left.count) {
            return right.count - left.count;
          }

          return left.skill.localeCompare(right.skill);
        })
        .slice(0, 10);
    }

    function buildRecentTrend(records, days) {
      const result = [];
      const today = new Date();

      for (let offset = days - 1; offset >= 0; offset -= 1) {
        const current = new Date(today);
        current.setUTCDate(today.getUTCDate() - offset);

        const dateKey = formatDateKey(current);

        result.push({
          date: dateKey,
          recordCount: 0,
          learningMinutes: 0,
          devlogMinutes: 0,
        });
      }

      const trendMap = new Map(
        result.map((item) => {
          return [item.date, item];
        })
      );

      for (const record of records) {
        const dateKey = normalizeDate(record.date);

        if (!trendMap.has(dateKey)) {
          continue;
        }

        const item = trendMap.get(dateKey);
        const minutes = Number(record.durationMinutes || 0);

        item.recordCount += 1;

        if (record.type === "learning") {
          item.learningMinutes += minutes;
        }

        if (record.type === "devlog") {
          item.devlogMinutes += minutes;
        }
      }

      return result;
    }

    function normalizeDate(value) {
      const text = String(value || "").trim();

      if (!text) {
        return "";
      }

      return text;
    }

    function formatDateKey(date) {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const day = String(date.getUTCDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    }

    function formatGeneratedAt(date) {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const day = String(date.getUTCDate()).padStart(2, "0");
      const hours = String(date.getUTCHours()).padStart(2, "0");
      const minutes = String(date.getUTCMinutes()).padStart(2, "0");

      return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
    }

    function getRecordTitle(record) {
      const topic = String(record.topic || "").trim();
      const project = String(record.project || "").trim();

      if (topic) {
        return topic;
      }

      if (project) {
        return project;
      }

      return "Untitled";
    }

    function getRecordSummary(record) {
      const summary = String(record.summary || "").trim();

      if (summary) {
        return summary;
      }

      return "No summary";
    }

    function getRecordDate(record) {
      const date = String(record.date || "").trim();

      if (date) {
        return date;
      }

      return "Unknown date";
    }

    function getRecordType(record) {
      const type = String(record.type || "").trim();

      if (type) {
        return type;
      }

      return "unknown";
    }

     function buildDashboardHtml(stats, recentTrend, recentRecords, topSkills) {
    const hasRecords = stats.totalCount > 0;

    const trendContent = hasRecords
      ? `
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Record Count</th>
              <th>Learning Minutes</th>
              <th>Devlog Minutes</th>
            </tr>
          </thead>
          <tbody>
            ${recentTrend.map((item) => {
              return `<tr><td>${escapeHtml(item.date)}</td><td>${item.recordCount}</
  td><td>${item.learningMinutes}</td><td>${item.devlogMinutes}</td></tr>`;
            }).join("\n")}
          </tbody>
        </table>
      `
      : `<div class="empty">No activity in the last 7 days.</div>`;

    const recentRecordsContent = recentRecords.length > 0
      ? `
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Title</th>
              <th>Summary</th>
              <th>Minutes</th>
            </tr>
          </thead>
          <tbody>
            ${recentRecords.map((record) => {
              const title = escapeHtml(getRecordTitle(record));
              const summary = escapeHtml(getRecordSummary(record));
              const date = escapeHtml(getRecordDate(record));
              const type = escapeHtml(getRecordType(record));
              const minutes = Number(record.durationMinutes || 0);

              return `<tr><td>${date}</td><td>${type}</td><td>${title}</td><td>${summary}</
  td><td>${minutes}</td></tr>`;
            }).join("\n")}
          </tbody>
        </table>
      `
      : `<div class="empty">No recent records.</div>`;

    const topSkillsContent = topSkills.length > 0
      ? `
        <ul>
          ${topSkills.map((item) => {
            return `<li class="skill-item"><span>${escapeHtml(item.skill)}</span><span
  class="badge">${item.count}</span></li>`;
          }).join("\n")}
        </ul>
      `
      : `<div class="empty">No skills found.</div>`;

    const footerNote = hasRecords
      ? "This dashboard summarizes your structured learning and development records."
      : "No records yet. Add learning or devlog records first.";

    return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Career Dev Agent Dashboard</title>
    <style>
      :root {
        --bg: #f4f1ea;
        --panel: #fffdf8;
        --panel-soft: #f8f4ec;
        --text: #1f2937;
        --muted: #6b7280;
        --line: #ded6c8;
        --accent: #8c5e34;
        --accent-soft: #efe2d3;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        padding: 24px;
        background: linear-gradient(180deg, #efe7db 0%, #f8f5ef 100%);
        color: var(--text);
        font-family: Georgia, "Times New Roman", serif;
      }

      .container {
        max-width: 1120px;
        margin: 0 auto;
      }

      .hero {
        margin-bottom: 24px;
        padding: 24px;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: var(--panel);
      }

      .hero h1 {
        margin: 0 0 8px;
        font-size: 36px;
      }

      .hero p {
        margin: 0;
        color: var(--muted);
      }

      .section {
        margin-bottom: 24px;
      }

      .section h2 {
        margin: 0 0 12px;
        font-size: 22px;
      }

      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
      }

      .card {
        padding: 18px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--panel);
      }

      .label {
        margin-bottom: 8px;
        font-size: 13px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .value {
        font-size: 28px;
        font-weight: 700;
      }

      .panel {
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--panel);
        overflow: hidden;
      }

      .panel-body {
        padding: 16px;
      }

      .empty {
        padding: 16px;
        border: 1px dashed var(--line);
        border-radius: 12px;
        background: var(--panel-soft);
        color: var(--muted);
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        text-align: left;
        padding: 12px 14px;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }

      th {
        background: #f6efe5;
        font-size: 13px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      tr:last-child td {
        border-bottom: none;
      }

      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      li.skill-item {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid var(--line);
      }

      li.skill-item:last-child {
        border-bottom: none;
      }

      .badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
      }

      .footer-note {
        margin-top: 8px;
        color: var(--muted);
        font-size: 14px;
      }

      @media (max-width: 720px) {
        body {
          padding: 16px;
        }

        .hero h1 {
          font-size: 28px;
        }

        th,
        td {
          padding: 10px;
          font-size: 14px;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="hero">
        <h1>Career Dev Agent Dashboard</h1>
        <p>Last updated: ${escapeHtml(stats.generatedAt)}</p>
      </div>

      <div class="section">
        <h2>Overview</h2>
        <div class="cards">
          <div class="card"><div class="label">Total Records</div><div
  class="value">${stats.totalCount}</div></div>
          <div class="card"><div class="label">Learning Records</div><div
  class="value">${stats.learningCount}</div></div>
          <div class="card"><div class="label">Devlog Records</div><div
  class="value">${stats.devlogCount}</div></div>
          <div class="card"><div class="label">Learning Minutes</div><div
  class="value">${stats.learningMinutes}</div></div>
          <div class="card"><div class="label">Devlog Minutes</div><div
  class="value">${stats.devlogMinutes}</div></div>
        </div>
      </div>

      <div class="section">
        <h2>Recent 7 Days</h2>
        <div class="panel">
          <div class="panel-body">
            ${trendContent}
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Recent Records</h2>
        <div class="panel">
          <div class="panel-body">
            ${recentRecordsContent}
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Top Skills</h2>
        <div class="panel">
          <div class="panel-body">
            ${topSkillsContent}
          </div>
        </div>
      </div>

      <p class="footer-note">${escapeHtml(footerNote)}</p>
    </div>
  </body>
  </html>`;
  }


    function escapeHtml(value) {
      return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;");
    }

    module.exports = { buildDashboard };
