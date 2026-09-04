const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const APP_NAME = 'googlemapsextractor';
const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
const dbPath = path.join(appData, APP_NAME, 'db.nedb');
const taskIdPath = path.join(appData, APP_NAME, 'task_results', 'last_task_id.txt');
const outputDir = 'D:\\ArtificAgent_Leads\\Kuyumcu_Turkiye';
const marker = 'ARTIFICAGENT_KUYUMCU_TURKIYE_10000_HIGH_DENSITY';

const exePath = path.join(
  process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local'),
  'Programs',
  APP_NAME,
  'Google Maps Extractor.exe'
);

const keywords = ['kuyumcu', 'kuyumculuk', 'mücevher', 'pırlanta', 'altın', 'alyans', 'sarraf'];

const locations = [
  'Kapalıçarşı Fatih Istanbul', 'Nuruosmaniye Fatih Istanbul', 'Mahmutpaşa Fatih Istanbul',
  'Eminönü Fatih Istanbul', 'Laleli Fatih Istanbul', 'Beyazıt Fatih Istanbul',
  'Kadıköy Istanbul', 'Üsküdar Istanbul', 'Bakırköy Istanbul', 'Şişli Istanbul',
  'Beşiktaş Istanbul', 'Beyoğlu Istanbul', 'Zeytinburnu Istanbul', 'Bağcılar Istanbul',
  'Bahçelievler Istanbul', 'Pendik Istanbul', 'Kartal Istanbul', 'Maltepe Istanbul',
  'Ümraniye Istanbul', 'Ataşehir Istanbul', 'Beylikdüzü Istanbul', 'Esenyurt Istanbul',
  'Sultangazi Istanbul', 'Gaziosmanpaşa Istanbul', 'Arnavutköy Istanbul',

  'Ulus Ankara', 'Kızılay Ankara', 'Çankaya Ankara', 'Keçiören Ankara', 'Yenimahalle Ankara',
  'Mamak Ankara', 'Etimesgut Ankara', 'Sincan Ankara', 'Altındağ Ankara',

  'Kemeraltı Konak Izmir', 'Konak Izmir', 'Karşıyaka Izmir', 'Bornova Izmir', 'Buca Izmir',
  'Alsancak Izmir', 'Bayraklı Izmir', 'Gaziemir Izmir',

  'Osmangazi Bursa', 'Kapalı Çarşı Bursa', 'Yıldırım Bursa', 'Nilüfer Bursa', 'İnegöl Bursa',
  'Gemlik Bursa', 'Mudanya Bursa',

  'Muratpaşa Antalya', 'Kepez Antalya', 'Konyaaltı Antalya', 'Alanya Antalya', 'Manavgat Antalya',
  'Side Antalya',

  'Seyhan Adana', 'Çukurova Adana', 'Yüreğir Adana', 'Ceyhan Adana',
  'Şahinbey Gaziantep', 'Şehitkamil Gaziantep', 'Gaziantep Bakırcılar Çarşısı',
  'Selçuklu Konya', 'Meram Konya', 'Karatay Konya',
  'Akdeniz Mersin', 'Yenişehir Mersin', 'Mezitli Mersin', 'Tarsus Mersin',
  'Melikgazi Kayseri', 'Kocasinan Kayseri', 'Kayseri Kapalı Çarşı',

  'İzmit Kocaeli', 'Gebze Kocaeli', 'Darıca Kocaeli',
  'Adapazarı Sakarya', 'Serdivan Sakarya',
  'Süleymanpaşa Tekirdağ', 'Çorlu Tekirdağ',
  'Ortahisar Trabzon', 'İlkadım Samsun', 'Atakum Samsun',
  'Pamukkale Denizli', 'Merkezefendi Denizli',
  'Şehzadeler Manisa', 'Yunusemre Manisa',
  'Altıeylül Balıkesir', 'Karesi Balıkesir',
  'Efeler Aydın', 'Bodrum Muğla', 'Fethiye Muğla', 'Marmaris Muğla',
  'Tepebaşı Eskişehir', 'Odunpazarı Eskişehir',
  'Onikişubat Kahramanmaraş', 'Battalgazi Malatya', 'Artuklu Mardin',
  'İpekyolu Van', 'Yakutiye Erzurum', 'Yenişehir Diyarbakır', 'Bağlar Diyarbakır',
  'Antakya Hatay', 'Haliliye Şanlıurfa', 'Eyyübiye Şanlıurfa',
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

function taskDoc(id, query, location, keyword) {
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
      include_places_outside_city: false,
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
      max_results: 120,
      api_key: '',
      business_type: keyword,
      city_id: null,
      is_search_link: true,
      links: [mapsSearchUrl(query)],
      query,
      artificagent_marker: marker,
      source_location: location,
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
  const backupPath = path.join(outputDir, `db.nedb.high-density.backup.${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.copyFileSync(dbPath, backupPath);

  let nextId = getLastTaskId(docs);
  const newDocs = [];

  for (const location of locations) {
    for (const keyword of keywords) {
      const query = `${keyword} ${location} Turkey`;
      const taskName = `${marker}: ${query}`;
      if (existing.has(taskName)) continue;
      nextId += 1;
      newDocs.push(taskDoc(nextId, query, location, keyword));
    }
  }

  if (newDocs.length) {
    fs.appendFileSync(dbPath, `${newDocs.map((doc) => JSON.stringify(doc)).join('\n')}\n`, 'utf8');
    fs.writeFileSync(taskIdPath, String(nextId), 'utf8');
  }

  const manifestPath = path.join(outputDir, 'google_maps_extractor_high_density_pending_tasks.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    marker,
    created_at: new Date().toISOString(),
    backup_path: backupPath,
    db_path: dbPath,
    task_count_created: newDocs.length,
    total_target_queries: locations.length * keywords.length,
    max_results_per_query: 120,
    expected_raw_capacity: locations.length * keywords.length * 120,
    note: 'These high-density jewelry district searches are queued in addition to the province-wide batch.',
  }, null, 2), 'utf8');

  console.log(JSON.stringify({
    created: newDocs.length,
    targetQueries: locations.length * keywords.length,
    backupPath,
    manifestPath,
    dbPath,
    exePath,
  }, null, 2));

  if (process.env.RESTART_GME === '1' && fs.existsSync(exePath)) {
    const child = spawn(exePath, [], { detached: true, stdio: 'ignore' });
    child.unref();
  }
}

main();
