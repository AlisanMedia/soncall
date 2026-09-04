const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const APP_NAME = 'googlemapsextractor';
const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
const dbPath = path.join(appData, APP_NAME, 'db.nedb');
const taskIdPath = path.join(appData, APP_NAME, 'task_results', 'last_task_id.txt');
const outputDir = 'D:\\ArtificAgent_Leads\\Kuyumcu_Turkiye';
const marker = 'ARTIFICAGENT_KUYUMCU_TURKIYE_10000_SATURATION';

const exePath = path.join(
  process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local'),
  'Programs',
  APP_NAME,
  'Google Maps Extractor.exe'
);

const provinces = [
  'Adana', 'Adiyaman', 'Afyonkarahisar', 'Agri', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin',
  'Aydin', 'Balikesir', 'Bartin', 'Batman', 'Bayburt', 'Bilecik', 'Bingol', 'Bitlis', 'Bolu', 'Burdur',
  'Bursa', 'Canakkale', 'Cankiri', 'Corum', 'Denizli', 'Diyarbakir', 'Duzce', 'Edirne', 'Elazig', 'Erzincan',
  'Erzurum', 'Eskisehir', 'Gaziantep', 'Giresun', 'Gumushane', 'Hakkari', 'Hatay', 'Igdir', 'Isparta', 'Istanbul',
  'Izmir', 'Kahramanmaras', 'Karabuk', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kirikkale', 'Kirklareli',
  'Kirsehir', 'Kilis', 'Kocaeli', 'Konya', 'Kutahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Mugla',
  'Mus', 'Nevsehir', 'Nigde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Sanliurfa', 'Siirt',
  'Sinop', 'Sirnak', 'Sivas', 'Tekirdag', 'Tokat', 'Trabzon', 'Tunceli', 'Usak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak',
];

const majorDistricts = [
  'Fatih Istanbul', 'Beyazıt Istanbul', 'Eminönü Istanbul', 'Sultanhamam Istanbul', 'Tahtakale Istanbul',
  'Nuruosmaniye Istanbul', 'Kapalıçarşı Istanbul', 'Mahmutpaşa Istanbul', 'Kadıköy Istanbul', 'Bahariye Istanbul',
  'Üsküdar Istanbul', 'Bakırköy Istanbul', 'Şişli Istanbul', 'Mecidiyeköy Istanbul', 'Beşiktaş Istanbul',
  'Beyoğlu Istanbul', 'Taksim Istanbul', 'Zeytinburnu Istanbul', 'Bağcılar Istanbul', 'Güngören Istanbul',
  'Bahçelievler Istanbul', 'Avcılar Istanbul', 'Beylikdüzü Istanbul', 'Esenyurt Istanbul', 'Pendik Istanbul',
  'Kartal Istanbul', 'Maltepe Istanbul', 'Ataşehir Istanbul', 'Ümraniye Istanbul', 'Sancaktepe Istanbul',
  'Sultanbeyli Istanbul', 'Gaziosmanpaşa Istanbul', 'Sultangazi Istanbul', 'Arnavutköy Istanbul',

  'Ulus Ankara', 'Kızılay Ankara', 'Sıhhiye Ankara', 'Çankaya Ankara', 'Keçiören Ankara', 'Yenimahalle Ankara',
  'Mamak Ankara', 'Altındağ Ankara', 'Etimesgut Ankara', 'Sincan Ankara', 'Pursaklar Ankara',

  'Kemeraltı Izmir', 'Konak Izmir', 'Alsancak Izmir', 'Karşıyaka Izmir', 'Bornova Izmir', 'Buca Izmir',
  'Bayraklı Izmir', 'Gaziemir Izmir', 'Çiğli Izmir', 'Menemen Izmir', 'Torbalı Izmir',

  'Osmangazi Bursa', 'Bursa Kapalı Çarşı', 'Heykel Bursa', 'Yıldırım Bursa', 'Nilüfer Bursa', 'İnegöl Bursa',
  'Gemlik Bursa', 'Mustafakemalpaşa Bursa',

  'Muratpaşa Antalya', 'Kaleiçi Antalya', 'Kepez Antalya', 'Konyaaltı Antalya', 'Alanya Antalya',
  'Manavgat Antalya', 'Serik Antalya', 'Kumluca Antalya',

  'Seyhan Adana', 'Çukurova Adana', 'Yüreğir Adana', 'Ceyhan Adana',
  'Şahinbey Gaziantep', 'Şehitkamil Gaziantep', 'Gaziantep Bakırcılar Çarşısı',
  'Selçuklu Konya', 'Meram Konya', 'Karatay Konya', 'Konya Bedesten',
  'Akdeniz Mersin', 'Yenişehir Mersin', 'Mezitli Mersin', 'Tarsus Mersin',
  'Melikgazi Kayseri', 'Kocasinan Kayseri', 'Kayseri Kapalı Çarşı',
  'İzmit Kocaeli', 'Gebze Kocaeli', 'Darıca Kocaeli', 'Gölcük Kocaeli',
  'Adapazarı Sakarya', 'Serdivan Sakarya', 'Çorlu Tekirdağ', 'Süleymanpaşa Tekirdağ',
  'Ortahisar Trabzon', 'Trabzon Uzun Sokak', 'İlkadım Samsun', 'Atakum Samsun',
  'Pamukkale Denizli', 'Merkezefendi Denizli', 'Denizli Bayramyeri',
  'Şehzadeler Manisa', 'Yunusemre Manisa', 'Altıeylül Balıkesir', 'Karesi Balıkesir',
  'Efeler Aydın', 'Nazilli Aydın', 'Bodrum Muğla', 'Fethiye Muğla', 'Marmaris Muğla',
  'Tepebaşı Eskişehir', 'Odunpazarı Eskişehir', 'Diyarbakır Sur', 'Yenişehir Diyarbakır',
  'Haliliye Şanlıurfa', 'Eyyübiye Şanlıurfa', 'Antakya Hatay', 'İskenderun Hatay',
  'Battalgazi Malatya', 'Yeşilyurt Malatya', 'Artuklu Mardin', 'İpekyolu Van',
  'Yakutiye Erzurum', 'Erzurum Taş Mağazalar',
];

const keywordPatterns = [
  'kuyumcu',
  'kuyumculuk',
  'mücevherat',
  'pırlanta',
  'altın',
  'sarraf',
  'alyans',
  'ziynet altın',
  'jewelry store',
  'gold shop',
];

const provinceAreaPatterns = ['merkez', 'çarşı', 'kapalı çarşı', 'ana cadde', 'avm', 'sanayi'];

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

function makeTask(id, query, location, keyword) {
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
      product_description: 'AI sales automation, AI receptionist, appointment booking and WhatsApp follow-up for jewelry stores',
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

function buildQueries() {
  const queries = [];
  for (const province of provinces) {
    for (const area of provinceAreaPatterns) {
      for (const keyword of keywordPatterns) {
        queries.push({ query: `${keyword} ${province} ${area} Turkey`, location: `${province} ${area}`, keyword });
      }
    }
  }
  for (const location of majorDistricts) {
    for (const keyword of keywordPatterns) {
      queries.push({ query: `${keyword} ${location} Turkey`, location, keyword });
    }
  }
  return queries;
}

function main() {
  if (!fs.existsSync(dbPath)) throw new Error(`Google Maps Extractor database not found: ${dbPath}`);

  fs.mkdirSync(outputDir, { recursive: true });
  const docs = readExistingDocs();
  const existingTaskNames = new Set(docs.map((doc) => doc.task_name).filter(Boolean));
  const backupPath = path.join(outputDir, `db.nedb.saturation.backup.${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.copyFileSync(dbPath, backupPath);

  let nextId = getLastTaskId(docs);
  const newDocs = [];
  for (const item of buildQueries()) {
    const taskName = `${marker}: ${item.query}`;
    if (existingTaskNames.has(taskName)) continue;
    nextId += 1;
    newDocs.push(makeTask(nextId, item.query, item.location, item.keyword));
  }

  if (newDocs.length) {
    fs.appendFileSync(dbPath, `${newDocs.map((doc) => JSON.stringify(doc)).join('\n')}\n`, 'utf8');
    fs.writeFileSync(taskIdPath, String(nextId), 'utf8');
  }

  const manifestPath = path.join(outputDir, 'google_maps_extractor_saturation_pending_tasks.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    marker,
    created_at: new Date().toISOString(),
    backup_path: backupPath,
    db_path: dbPath,
    task_count_created: newDocs.length,
    total_target_queries: buildQueries().length,
    max_results_per_query: 120,
    expected_raw_capacity: buildQueries().length * 120,
    note: 'Saturation batch for reaching 10,000 unique Turkish jewelry leads. Existing tasks are not duplicated.',
  }, null, 2), 'utf8');

  console.log(JSON.stringify({
    created: newDocs.length,
    targetQueries: buildQueries().length,
    expectedRawCapacity: buildQueries().length * 120,
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
