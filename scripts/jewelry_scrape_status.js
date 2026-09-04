const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dbPath = path.join(
  process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming'),
  'googlemapsextractor',
  'db.nedb'
);
const outputDir = 'D:\\ArtificAgent_Leads\\Kuyumcu_Turkiye';
const progressPath = path.join(outputDir, 'scraping_progress.json');
const marker = 'ARTIFICAGENT_KUYUMCU_TURKIYE_10000';
const target = 10000;

function readTaskStatus() {
  const latest = new Map();
  for (const line of fs.readFileSync(dbPath, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const doc = JSON.parse(line);
      if (String(doc.task_name || '').includes(marker)) latest.set(doc.id, doc);
    } catch {
      // Ignore partial lines while Botasaurus writes.
    }
  }

  const status = { total: latest.size, results: 0, active: [] };
  for (const task of latest.values()) {
    status[task.status] = (status[task.status] || 0) + 1;
    status.results += Number(task.result_count || 0);
    if (task.status === 'in_progress') {
      status.active.push({
        id: task.id,
        task_name: task.task_name,
        result_count: Number(task.result_count || 0),
      });
    }
  }
  return status;
}

function exportLatest() {
  const output = execFileSync('node', ['scripts\\export_jewelry_leads.js'], {
    cwd: 'D:\\soncall',
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(output.trim());
}

function main() {
  const taskStatus = readTaskStatus();
  const exported = exportLatest();
  const finalLeads = Number(exported.finalLeads || 0);
  const summary = {
    checked_at: new Date().toISOString(),
    final_leads: finalLeads,
    remaining_to_10000: Math.max(0, target - finalLeads),
    progress_percent: Number(((finalLeads / target) * 100).toFixed(2)),
    raw_google_maps_results: exported.rawBusinesses,
    jewelry_candidates: exported.jewelryCandidates,
    duplicates_removed: exported.duplicatesRemoved,
    task_status: taskStatus,
    files: exported.files,
  };

  fs.writeFileSync(progressPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

main();
