const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const APP_NAME = 'googlemapsextractor';
const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
const dbPath = path.join(appData, APP_NAME, 'db.nedb');
const taskIdPath = path.join(appData, APP_NAME, 'task_results', 'last_task_id.txt');
const outputDir = 'D:\\ArtificAgent_Leads\\Kuyumcu_Turkiye';
const marker = 'ARTIFICAGENT_KUYUMCU_TURKIYE_10000';

const exePath = path.join(
  process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local'),
  'Programs',
  APP_NAME,
  'Google Maps Extractor.exe'
);

const provinces = [
  'Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Adana', 'Gaziantep', 'Konya', 'Mersin', 'Kayseri',
  'Samsun', 'Diyarbakir', 'Hatay', 'Sanliurfa', 'Kocaeli', 'Sakarya', 'Tekirdag', 'Trabzon', 'Denizli',
  'Manisa', 'Balikesir', 'Aydin', 'Mugla', 'Eskisehir', 'Kahramanmaras', 'Malatya', 'Mardin', 'Van',
  'Erzurum', 'Corum', 'Ordu', 'Giresun', 'Rize', 'Afyonkarahisar', 'Isparta', 'Usak', 'Kutahya',
  'Adiyaman', 'Agri', 'Aksaray', 'Amasya', 'Ardahan', 'Artvin', 'Bartin', 'Batman', 'Bayburt', 'Bilecik',
  'Bingol', 'Bitlis', 'Bolu', 'Burdur', 'Canakkale', 'Cankiri', 'Duzce', 'Edirne', 'Elazig', 'Erzincan',
  'Gumushane', 'Hakkari', 'Igdir', 'Karabuk', 'Karaman', 'Kars', 'Kastamonu', 'Kirikkale', 'Kirklareli',
  'Kirsehir', 'Kilis', 'Mus', 'Nevsehir', 'Nigde', 'Osmaniye', 'Siirt', 'Sinop', 'Sirnak', 'Sivas',
  'Tokat', 'Tunceli', 'Yalova', 'Yozgat', 'Zonguldak',
];

const keywords = [
  'kuyumcu',
  'kuyumculuk',
  'mücevher mağazası',
  'pırlanta mağazası',
  'altın mağazası',
  'alyans mağazası',
  'sarraf',
];

function nowDate() {
  return { $$date: Date.now() };
}

function randomId() {
  return crypto.randomBytes(12).toString('base64url').slice(0, 16);
}

function mapsSearchUrl(query) {
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}

function readExistingDocs() {
  if (!fs.existsSync(dbPath)) return [];
  return fs.readFileSync(dbPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function getLastTaskId(docs) {
  const fromFile = fs.existsSync(taskIdPath) ? Number(fs.readFileSync(taskIdPath, 'utf8').trim()) : 0;
  const fromDb = docs.reduce((max, doc) => Math.max(max, Number(doc.id || 0)), 0);
  return Math.max(fromFile || 0, fromDb || 0);
}

function taskDoc(id, query, province, keyword) {
  return {
    id,
    status: 'pending',
    sort_id: Date.now() * 1000 + id,
    task_name: `${marker}: ${query}`,
    scraper_name: 'google_maps_scraper',
    scraper_type: 'task',
    is_all_task: false,
    priority: 0,
    is_large: false,
    parent_task_id: null,
    started_at: null,
    finished_at: null,
    data: {
      extraction_method: 'fast',
      include_places_outside_city: true,
      product_description: 'AI phone automation and AI receptionist for jewelry stores, sales calls, WhatsApp inquiries, appointment requests, stock and price questions',
      enable_emails_social: false,
      recommended_emails_count: 'none',
      verify_recommended_emails: false,
      enable_sales_summary: false,
      enable_phone_info: false,
      enrichment_filters: ['not_permanently_closed', 'has_phone'],
      filter_reviews_gt: null,
      filter_reviews_lt: null,
      filter_category_contains: '',
      lang: 'tr',
      max_results: 80,
      api_key: '',
      business_type: keyword,
      city_id: null,
      is_search_link: true,
      links: [mapsSearchUrl(`${keyword} ${province} Turkey`)],
      query: `${keyword} ${province} Turkey`,
      artificagent_marker: marker,
      source_province: province,
      source_keyword: keyword,
    },
    meta_data: {},
    result_count: 0,
    created_at: nowDate(),
    updated_at: nowDate(),
    _id: randomId(),
  };
}

function main() {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Google Maps Extractor database not found: ${dbPath}`);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const docs = readExistingDocs();
  const existing = new Set(docs.map((doc) => doc.task_name).filter(Boolean));
  const backupPath = path.join(outputDir, `db.nedb.backup.${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.copyFileSync(dbPath, backupPath);

  let nextId = getLastTaskId(docs);
  const newDocs = [];

  for (const province of provinces) {
    for (const keyword of keywords) {
      const query = `${keyword} ${province} Turkey`;
      const taskName = `${marker}: ${query}`;
      if (existing.has(taskName)) continue;
      nextId += 1;
      newDocs.push(taskDoc(nextId, query, province, keyword));
    }
  }

  if (newDocs.length) {
    fs.appendFileSync(dbPath, `${newDocs.map((doc) => JSON.stringify(doc)).join('\n')}\n`, 'utf8');
    fs.writeFileSync(taskIdPath, String(nextId), 'utf8');
  }

  const manifestPath = path.join(outputDir, 'google_maps_extractor_pending_tasks.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    marker,
    created_at: new Date().toISOString(),
    backup_path: backupPath,
    db_path: dbPath,
    task_count_created: newDocs.length,
    total_target_queries: provinces.length * keywords.length,
    max_results_per_query: 80,
    expected_raw_capacity: provinces.length * keywords.length * 80,
    note: 'Restart Google Maps Extractor after creating tasks so NeDB autoload picks up pending jobs.',
  }, null, 2), 'utf8');

  console.log(JSON.stringify({
    created: newDocs.length,
    targetQueries: provinces.length * keywords.length,
    backupPath,
    manifestPath,
    dbPath,
    exePath,
  }, null, 2));

  if (fs.existsSync(exePath)) {
    const child = spawn(exePath, [], { detached: true, stdio: 'ignore' });
    child.unref();
  }
}

main();
