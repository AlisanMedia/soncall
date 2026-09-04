const fs = require('fs');
const path = require('path');

const APP_NAME = 'googlemapsextractor';
const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
const dbPath = path.join(appData, APP_NAME, 'db.nedb');
const outputDir = 'D:\\ArtificAgent_Leads\\Kuyumcu_Turkiye';
const marker = 'ARTIFICAGENT_KUYUMCU_TURKIYE_10000';
const staleMinutes = Number(process.env.STALE_MINUTES || 20);

const priorityTerms = [
  'Kapalıçarşı', 'Nuruosmaniye', 'Mahmutpaşa', 'Eminönü', 'Beyazıt', 'Sultanhamam',
  'Fatih Istanbul', 'Kadıköy Istanbul', 'Bakırköy Istanbul', 'Şişli Istanbul',
  'Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Adana', 'Gaziantep',
  'Konya', 'Mersin', 'Kayseri', 'Kocaeli', 'Samsun', 'Denizli',
];

function parseDate(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value.$$date) return Number(value.$$date || 0);
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function readDocs() {
  return fs.readFileSync(dbPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function latestJewelryTasks(docs) {
  const latest = new Map();
  for (const doc of docs) {
    if (String(doc.task_name || '').includes(marker)) latest.set(doc.id, doc);
  }
  return [...latest.values()];
}

function shouldPrioritize(taskName) {
  return priorityTerms.some((term) => taskName.includes(term));
}

function updateDoc(doc, overrides) {
  return {
    ...doc,
    ...overrides,
    updated_at: { $$date: Date.now() },
  };
}

function main() {
  if (!fs.existsSync(dbPath)) throw new Error(`Google Maps Extractor database not found: ${dbPath}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const backupPath = path.join(outputDir, `db.nedb.prioritize.backup.${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.copyFileSync(dbPath, backupPath);

  const tasks = latestJewelryTasks(readDocs());
  const now = Date.now();
  const staleCutoff = now - staleMinutes * 60 * 1000;
  const updates = [];

  let priorityRank = 0;
  for (const task of tasks) {
    const taskName = String(task.task_name || '');
    const startedAt = parseDate(task.started_at);
    const updatedAt = parseDate(task.updated_at);
    const isStaleInProgress = task.status === 'in_progress' && Math.max(startedAt, updatedAt) < staleCutoff;

    if (isStaleInProgress) {
      updates.push(updateDoc(task, {
        status: 'pending',
        started_at: null,
        finished_at: null,
        error: null,
      }));
    }

    if (task.status === 'pending' && shouldPrioritize(taskName)) {
      priorityRank += 1;
      updates.push(updateDoc(task, {
        priority: 100,
        sort_id: now * 1000 + 10000000 - priorityRank,
      }));
    }
  }

  if (updates.length) {
    fs.appendFileSync(dbPath, `${updates.map((doc) => JSON.stringify(doc)).join('\n')}\n`, 'utf8');
  }

  const status = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    backupPath,
    totalJewelryTasks: tasks.length,
    statusBefore: status,
    updatesWritten: updates.length,
    staleResetMinutes: staleMinutes,
    prioritizedPendingTasks: updates.filter((task) => task.priority === 100).length,
  }, null, 2));
}

main();
