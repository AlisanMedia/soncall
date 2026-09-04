const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DB_PATH = path.join(
  process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming'),
  'googlemapsextractor',
  'db.nedb'
);

const OUTPUT_DIR = 'D:\\ArtificAgent_Leads\\Kuyumcu_Turkiye';
const PROGRESS_PATH = path.join(OUTPUT_DIR, 'scraping_progress.json');
const LOG_PATH = path.join(OUTPUT_DIR, 'scraping_progress.log');
const MARKER = 'ARTIFICAGENT_KUYUMCU_TURKIYE_10000';
const INTERVAL_MS = Number(process.env.MONITOR_INTERVAL_MS || 5 * 60 * 1000);
const TARGET_LIMIT = Number(process.env.TARGET_LIMIT || 10000);

function readTaskStatus() {
  const latest = new Map();
  if (!fs.existsSync(DB_PATH)) return { total: 0, results: 0 };

  for (const line of fs.readFileSync(DB_PATH, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const doc = JSON.parse(line);
      if (String(doc.task_name || '').includes(MARKER)) {
        latest.set(doc.id, doc);
      }
    } catch {
      // NeDB is append-only and can briefly contain partial lines while the app writes.
    }
  }

  const status = { total: latest.size, results: 0 };
  for (const doc of latest.values()) {
    status[doc.status] = (status[doc.status] || 0) + 1;
    status.results += Number(doc.result_count || 0);
    if (doc.status === 'in_progress') {
      status.active = {
        id: doc.id,
        task_name: doc.task_name,
        result_count: Number(doc.result_count || 0),
      };
    }
  }
  return status;
}

function runExport() {
  const output = execFileSync('node', ['scripts\\export_jewelry_leads.js'], {
    cwd: 'D:\\soncall',
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(output.trim());
}

function appendLog(entry) {
  fs.appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`, 'utf8');
}

function tick() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const entry = {
    checked_at: new Date().toISOString(),
    task_status: readTaskStatus(),
  };

  try {
    entry.export = runExport();
    entry.final_leads = entry.export.finalLeads;
    entry.target_reached = entry.final_leads >= TARGET_LIMIT;
  } catch (error) {
    entry.export_error = String(error.message || error);
  }

  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(entry, null, 2), 'utf8');
  appendLog(entry);
  console.log(JSON.stringify(entry, null, 2));

  if (entry.target_reached) process.exit(0);
}

tick();
setInterval(tick, INTERVAL_MS);
