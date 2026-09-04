const fs = require('fs');
const path = require('path');
const readline = require('readline');
const XLSX = require('xlsx');

const SOURCE_DIR = process.env.GME_TASKS_DIR || path.join(
  process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming'),
  'googlemapsextractor',
  'task_results',
  'tasks'
);

const OUTPUT_DIR = process.env.OUTPUT_DIR || 'D:\\ArtificAgent_Leads\\Kuyumcu_Turkiye';
const TARGET_LIMIT = Number(process.env.TARGET_LIMIT || 10000);

const OUTPUTS = {
  finalCsv: path.join(OUTPUT_DIR, 'artificagent_kuyumcu_10000.csv'),
  finalXlsx: path.join(OUTPUT_DIR, 'artificagent_kuyumcu_10000.xlsx'),
  rawCsv: path.join(OUTPUT_DIR, 'raw_google_maps.csv'),
  enrichedCsv: path.join(OUTPUT_DIR, 'website_enriched.csv'),
  duplicatesCsv: path.join(OUTPUT_DIR, 'duplicates_removed.csv'),
  scrapePlanCsv: path.join(OUTPUT_DIR, 'scraping_query_plan.csv'),
  report: path.join(OUTPUT_DIR, 'scraping_report.txt'),
};

const FIELDS = [
  'business_name',
  'google_maps_category',
  'secondary_categories',
  'full_address',
  'district',
  'city',
  'province',
  'postal_code',
  'phone',
  'mobile_phone',
  'additional_phone_numbers',
  'website',
  'google_maps_url',
  'latitude',
  'longitude',
  'google_rating',
  'review_count',
  'business_status',
  'opening_hours',
  'instagram',
  'facebook',
  'linkedin',
  'youtube',
  'tiktok',
  'email',
  'additional_emails',
  'whatsapp_number',
  'whatsapp_url',
  'website_contact_page',
  'website_title',
  'website_description',
  'brand_name',
  'branch_name',
  'branch_indicator',
  'possible_branch_count',
  'source_search_keyword',
  'source_city',
  'lead_score',
  'lead_tier',
  'source_file',
  'place_id',
];

const PROVINCES = [
  'Adana', 'Adiyaman', 'Afyonkarahisar', 'Agri', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin',
  'Aydin', 'Balikesir', 'Bartin', 'Batman', 'Bayburt', 'Bilecik', 'Bingol', 'Bitlis', 'Bolu', 'Burdur',
  'Bursa', 'Canakkale', 'Cankiri', 'Corum', 'Denizli', 'Diyarbakir', 'Duzce', 'Edirne', 'Elazig', 'Erzincan',
  'Erzurum', 'Eskisehir', 'Gaziantep', 'Giresun', 'Gumushane', 'Hakkari', 'Hatay', 'Igdir', 'Isparta', 'Istanbul',
  'Izmir', 'Kahramanmaras', 'Karabuk', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kirikkale', 'Kirklareli',
  'Kirsehir', 'Kilis', 'Kocaeli', 'Konya', 'Kutahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Mugla',
  'Mus', 'Nevsehir', 'Nigde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Sanliurfa', 'Siirt',
  'Sinop', 'Sirnak', 'Sivas', 'Tekirdag', 'Tokat', 'Trabzon', 'Tunceli', 'Usak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak',
];

const JEWELRY_TERMS = [
  'kuyum', 'kuyumcu', 'kuyumculuk', 'mücevher', 'mucevher', 'mücevherat', 'mucevherat', 'pırlanta', 'pirlanta',
  'altın', 'altin', 'alyans', 'sarraf', 'takı', 'taki', 'ziynet', 'jewelry', 'jewellery', 'diamond', 'gold',
];

const EXCLUDE_TERMS = [
  'otel', 'hotel', 'restaurant', 'restoran', 'cafe', 'eczane', 'market', 'kuafor', 'kuaför', 'berber', 'barber',
  'beauty', 'güzellik', 'guzellik', 'salon', 'studio', 'hair', 'saç', 'sac', 'mobilya', 'emlak', 'decathlon',
  'optik', 'optical', 'hotel', 'tower', 'rezidans', 'residence',
  'aksesuar', 'accessories', 'bijuteri', 'butik', 'çanta', 'canta',
];

const STRONG_JEWELRY_TERMS = [
  'kuyum', 'kuyumcu', 'kuyumculuk', 'mücevher', 'mucevher', 'mücevherat', 'mucevherat', 'pırlanta', 'pirlanta',
  'altın mağazası', 'altin magazasi', 'alyans', 'sarraf', 'takı mağazası', 'taki magazasi', 'ziynet',
  'jewelry store', 'jewellery store', 'diamond jewelry', 'gold jewelry',
];

const LUXURY_TERMS = ['pırlanta', 'pirlanta', 'diamond', 'mücevher', 'mucevher', 'luxury', 'lüks', 'luks', 'alyans'];
const BRANCH_TERMS = ['şube', 'sube', 'mağaza', 'magaza', 'avm', 'plaza', 'mall', 'branch'];
const CONTACT_PATH_TERMS = ['contact', 'iletisim', 'bize-ulasin', 'hakkimizda', 'subeler', 'magazalar', 'appointment', 'randevu'];
const SCRAPE_KEYWORDS = [
  'kuyumcu',
  'kuyumculuk',
  'mücevher mağazası',
  'mücevherat',
  'pırlanta mağazası',
  'altın mağazası',
  'alyans mağazası',
  'sarraf',
  'takı mağazası',
  'jewelry store',
  'diamond jewelry',
  'gold jewelry',
  'luxury jewelry',
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .toLowerCase()
    .trim();
}

function extractFirst(value) {
  if (Array.isArray(value)) return value.find(Boolean) || '';
  return value || '';
}

function asList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value].filter(Boolean);
}

function cleanPhone(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith('+')) {
    const onlyDigits = digits.replace(/\D/g, '');
    if (onlyDigits.length === 10 && onlyDigits.startsWith('5')) digits = `+90${onlyDigits}`;
    else if (onlyDigits.length === 10) digits = `+90${onlyDigits}`;
    else if (onlyDigits.length === 11 && onlyDigits.startsWith('0')) digits = `+90${onlyDigits.slice(1)}`;
    else digits = onlyDigits ? `+${onlyDigits}` : '';
  }

  return digits;
}

function isMobile(phone) {
  return /^\+?90?5\d{9}$/.test(String(phone || '').replace(/\s/g, ''));
}

function getDomain(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function findSocial(record, name) {
  const direct = record[name];
  if (direct) return direct;

  const links = [
    ...asList(record.social_links),
    ...asList(record.links),
    ...asList(record.website_links),
  ];

  return links.find((link) => normalizeText(link).includes(name)) || '';
}

function detectProvince(record) {
  const haystack = normalizeText([
    record.query,
    record.address,
    record.full_address,
    record.city,
    record.state,
    record.province,
  ].join(' '));

  return PROVINCES.find((province) => haystack.includes(normalizeText(province))) || '';
}

function detectCity(record, province) {
  const query = String(record.query || '');
  const provinceFromQuery = PROVINCES.find((item) => normalizeText(query).includes(normalizeText(item)));
  return record.city || record.district || provinceFromQuery || province || '';
}

function detectKeyword(record) {
  const query = normalizeText(record.query || '');
  return JEWELRY_TERMS.find((term) => query.includes(normalizeText(term))) || '';
}

function isJewelryCandidate(record) {
  const nameAndDescription = normalizeText([
    record.name,
    record.title,
    record.description,
  ].join(' '));
  const categoryAndQuery = normalizeText([
    record.category,
    record.type,
    asList(record.categories).join(' '),
  ].join(' '));
  const haystack = `${nameAndDescription} ${categoryAndQuery}`;

  const hasStrongJewelry = STRONG_JEWELRY_TERMS.some((term) => haystack.includes(normalizeText(term)));
  const hasJewelryIntentInQuery = STRONG_JEWELRY_TERMS.some((term) => categoryAndQuery.includes(normalizeText(term)));
  const hasGenericGoldDiamond = ['diamond', 'gold', 'altin'].some((term) => haystack.includes(term));
  const hasJewelry = hasStrongJewelry || (hasJewelryIntentInQuery && hasGenericGoldDiamond);
  if (!hasJewelry) return false;

  const isClearlyUnrelated = EXCLUDE_TERMS.some((term) => haystack.includes(normalizeText(term)))
    && !STRONG_JEWELRY_TERMS.some((term) => nameAndDescription.includes(normalizeText(term)) || categoryAndQuery.includes(normalizeText(term)));

  return !isClearlyUnrelated;
}

function detectContactPage(record) {
  const links = [
    record.website,
    record.link,
    ...asList(record.website_links),
    ...asList(record.links),
  ].filter(Boolean);

  return links.find((link) => CONTACT_PATH_TERMS.some((term) => normalizeText(link).includes(term))) || '';
}

function detectWhatsapp(record, phones) {
  const links = [
    record.whatsapp,
    record.whatsapp_url,
    ...asList(record.links),
    ...asList(record.website_links),
  ].filter(Boolean);

  const whatsappUrl = links.find((link) => normalizeText(link).includes('whatsapp') || normalizeText(link).includes('wa.me')) || '';
  const whatsappNumber = record.whatsapp_number || cleanPhone(whatsappUrl) || phones.find(isMobile) || '';
  return { whatsappNumber, whatsappUrl };
}

function scoreLead(record, normalized) {
  let score = 0;
  if (normalized.phone) score += 20;
  if (normalized.mobile_phone) score += 10;
  if (normalized.website) score += 10;
  if (normalized.email) score += 10;
  if (normalized.whatsapp_number || normalized.whatsapp_url) score += 10;
  if (normalized.instagram) score += 5;

  const reviews = Number(normalized.review_count || 0);
  if (reviews >= 500) score += 15;
  else if (reviews >= 100) score += 10;
  else if (reviews >= 20) score += 5;

  const haystack = normalizeText([
    record.name,
    record.description,
    record.category,
    record.query,
    normalized.website_title,
    normalized.website_description,
  ].join(' '));

  if (normalized.branch_indicator === 'yes') score += 10;
  if (LUXURY_TERMS.some((term) => haystack.includes(normalizeText(term)))) score += 10;
  if (haystack.includes('e-ticaret') || haystack.includes('eticaret') || haystack.includes('catalog') || haystack.includes('katalog') || haystack.includes('shop')) score += 10;
  if (normalized.website_contact_page || haystack.includes('randevu') || haystack.includes('appointment') || haystack.includes('form')) score += 5;

  return Math.min(score, 100);
}

function tier(score) {
  if (score >= 75) return 'A';
  if (score >= 55) return 'B';
  if (score >= 35) return 'C';
  return 'D';
}

function normalizeRecord(record, sourceFile) {
  const province = detectProvince(record);
  const city = detectCity(record, province);
  const phones = [
    record.phone_international,
    record.phone,
    ...asList(record.phones),
    ...asList(record.phone_numbers),
  ].map(cleanPhone).filter(Boolean);
  const uniquePhones = [...new Set(phones)];
  const phone = uniquePhones[0] || '';
  const mobilePhone = uniquePhones.find(isMobile) || '';
  const website = record.website || '';
  const domain = getDomain(website);
  const emails = [
    ...asList(record.email),
    ...asList(record.emails),
    ...asList(record.recommended_emails),
  ].filter(Boolean);
  const instagram = record.instagram || findSocial(record, 'instagram');
  const facebook = record.facebook || findSocial(record, 'facebook');
  const linkedin = record.linkedin || findSocial(record, 'linkedin');
  const youtube = record.youtube || findSocial(record, 'youtube');
  const tiktok = record.tiktok || findSocial(record, 'tiktok');
  const whatsapp = detectWhatsapp(record, uniquePhones);
  const categories = [
    record.category,
    record.type,
    ...asList(record.categories),
  ].filter(Boolean);
  const name = record.name || record.business_name || record.title || '';
  const branchIndicator = BRANCH_TERMS.some((term) => normalizeText([name, record.address, record.description].join(' ')).includes(normalizeText(term))) ? 'yes' : '';
  const brandName = name
    .replace(/\s+-\s+.*$/g, '')
    .replace(/\s+\([^)]*\)$/g, '')
    .replace(/\s+(şube|sube|mağaza|magaza).*$/i, '')
    .trim();

  const normalized = {
    business_name: name,
    google_maps_category: categories[0] || '',
    secondary_categories: categories.slice(1).join('; '),
    full_address: record.address || record.full_address || '',
    district: record.district || '',
    city,
    province,
    postal_code: record.postal_code || '',
    phone,
    mobile_phone: mobilePhone,
    additional_phone_numbers: uniquePhones.slice(1).join('; '),
    website,
    google_maps_url: record.link || record.google_maps_url || '',
    latitude: record.latitude || record.lat || record.gps_coordinates?.latitude || '',
    longitude: record.longitude || record.lng || record.gps_coordinates?.longitude || '',
    google_rating: record.rating || record.google_rating || '',
    review_count: record.reviews || record.review_count || '',
    business_status: record.business_status || record.status || '',
    opening_hours: typeof record.hours === 'string' ? record.hours : JSON.stringify(record.hours || record.workday_timing || ''),
    instagram,
    facebook,
    linkedin,
    youtube,
    tiktok,
    email: emails[0] || '',
    additional_emails: emails.slice(1).join('; '),
    whatsapp_number: whatsapp.whatsappNumber,
    whatsapp_url: whatsapp.whatsappUrl,
    website_contact_page: detectContactPage(record),
    website_title: record.website_title || record.title || '',
    website_description: record.website_description || record.meta_description || '',
    brand_name: brandName,
    branch_name: branchIndicator ? name : '',
    branch_indicator: branchIndicator,
    possible_branch_count: '',
    source_search_keyword: detectKeyword(record),
    source_city: city,
    lead_score: 0,
    lead_tier: '',
    source_file: sourceFile,
    place_id: record.place_id || '',
    _domain: domain,
  };

  normalized.lead_score = scoreLead(record, normalized);
  normalized.lead_tier = tier(normalized.lead_score);

  return normalized;
}

function dedupeKey(record) {
  if (record.place_id) return `place:${record.place_id}`;
  if (record.phone) return `phone:${record.phone}`;
  if (record._domain) return `domain:${record._domain}`;
  return `name:${normalizeText(record.business_name)}:${normalizeText(record.full_address || record.city || record.province)}`;
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[",\r\n]/.test(stringValue)) return `"${stringValue.replace(/"/g, '""')}"`;
  return stringValue;
}

function writeCsv(filePath, rows) {
  const content = [
    FIELDS.join(','),
    ...rows.map((row) => FIELDS.map((field) => csvEscape(row[field])).join(',')),
  ].join('\r\n');
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeScrapePlan(filePath, currentRows) {
  const covered = new Set(currentRows.map((row) => `${normalizeText(row.source_search_keyword)}:${normalizeText(row.city || row.province)}`));
  const priorityProvinces = [
    'Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Adana', 'Gaziantep', 'Konya', 'Mersin', 'Kayseri',
    'Samsun', 'Diyarbakir', 'Hatay', 'Sanliurfa', 'Kocaeli', 'Sakarya', 'Tekirdag', 'Trabzon', 'Denizli',
    'Manisa', 'Balikesir', 'Aydin', 'Mugla', 'Eskisehir', 'Kahramanmaras', 'Malatya', 'Mardin', 'Van',
    'Erzurum', 'Corum', 'Ordu', 'Giresun', 'Rize', 'Afyonkarahisar', 'Isparta', 'Usak', 'Kutahya',
  ];
  const orderedProvinces = [
    ...priorityProvinces,
    ...PROVINCES.filter((province) => !priorityProvinces.includes(province)),
  ];
  const rows = [];

  orderedProvinces.forEach((province, provinceIndex) => {
    SCRAPE_KEYWORDS.forEach((keyword, keywordIndex) => {
      const key = `${normalizeText(keyword)}:${normalizeText(province)}`;
      rows.push({
        priority: provinceIndex < priorityProvinces.length ? 'high' : 'normal',
        run_order: provinceIndex * SCRAPE_KEYWORDS.length + keywordIndex + 1,
        country: 'Turkey',
        province,
        city: province,
        keyword,
        query: `${keyword} ${province}`,
        already_has_local_result: covered.has(key) ? 'yes' : 'no',
        recommended_scraper: 'Google Maps Scraper',
      });
    });
  });

  const headers = ['priority', 'run_order', 'country', 'province', 'city', 'keyword', 'query', 'already_has_local_result', 'recommended_scraper'];
  const content = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\r\n');
  fs.writeFileSync(filePath, content, 'utf8');
}

function rowsToSheet(rows) {
  return XLSX.utils.json_to_sheet(rows.map((row) => {
    const next = {};
    FIELDS.forEach((field) => {
      if (!field.startsWith('_')) next[field] = row[field] || '';
    });
    return next;
  }));
}

function countBy(rows, field) {
  const counts = new Map();
  rows.forEach((row) => {
    const key = row[field] || 'Unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function average(rows, field) {
  const values = rows.map((row) => Number(row[field] || 0)).filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function parseNdjsonFile(filePath) {
  const rows = [];
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) rows.push(...parsed);
      else rows.push(parsed);
    } catch (error) {
      if (!trimmed.includes('\u0000')) {
        console.warn(`Could not parse line in ${path.basename(filePath)}: ${error.message}`);
      }
    }
  }

  return rows;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const files = fs.readdirSync(SOURCE_DIR)
    .filter((file) => file.endsWith('.ndjson'))
    .map((file) => path.join(SOURCE_DIR, file));

  const rawRecords = [];
  const parseErrors = [];

  for (const file of files) {
    try {
      const records = await parseNdjsonFile(file);
      rawRecords.push(...records.map((record) => ({ ...record, _source_file: path.basename(file) })));
    } catch (error) {
      parseErrors.push(`${path.basename(file)}: ${error.message}`);
    }
  }

  const candidates = rawRecords
    .filter(isJewelryCandidate)
    .map((record) => normalizeRecord(record, record._source_file));

  const seen = new Map();
  const duplicates = [];

  for (const candidate of candidates) {
    if (!candidate.business_name) continue;
    const status = normalizeText(candidate.business_status);
    if (status.includes('permanently closed') || status.includes('kalici olarak kapali')) continue;

    const key = dedupeKey(candidate);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, candidate);
      continue;
    }

    duplicates.push(candidate);
    if (candidate.lead_score > existing.lead_score) {
      seen.set(key, candidate);
    }
  }

  const deduped = [...seen.values()];
  const finalRows = deduped
    .sort((a, b) => {
      if (b.lead_score !== a.lead_score) return b.lead_score - a.lead_score;
      return Number(b.review_count || 0) - Number(a.review_count || 0);
    })
    .slice(0, TARGET_LIMIT);

  const enrichedRows = finalRows.filter((row) =>
    row.website || row.email || row.instagram || row.facebook || row.whatsapp_number || row.whatsapp_url
  );

  writeCsv(OUTPUTS.rawCsv, candidates);
  writeCsv(OUTPUTS.enrichedCsv, enrichedRows);
  writeCsv(OUTPUTS.duplicatesCsv, duplicates);
  writeCsv(OUTPUTS.finalCsv, finalRows);
  writeScrapePlan(OUTPUTS.scrapePlanCsv, finalRows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, rowsToSheet(finalRows), 'ALL_LEADS');
  XLSX.utils.book_append_sheet(workbook, rowsToSheet(finalRows.filter((row) => row.lead_tier === 'A')), 'A_TIER');
  XLSX.utils.book_append_sheet(workbook, rowsToSheet(finalRows.filter((row) => row.lead_tier === 'B')), 'B_TIER');
  XLSX.utils.book_append_sheet(workbook, rowsToSheet(finalRows.filter((row) => row.lead_tier === 'C')), 'C_TIER');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(countBy(finalRows, 'city').slice(0, 200)), 'CITY_SUMMARY');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(countBy(finalRows, 'brand_name').slice(0, 200)), 'BRANDS');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
    { metric: 'total_raw_businesses_found', value: rawRecords.length },
    { metric: 'total_jewelry_candidates', value: candidates.length },
    { metric: 'total_after_deduplication', value: deduped.length },
    { metric: 'total_final_leads', value: finalRows.length },
    { metric: 'duplicates_removed', value: duplicates.length },
  ]), 'SCRAPING_STATS');
  XLSX.writeFile(workbook, OUTPUTS.finalXlsx);

  const tierCounts = countBy(finalRows, 'lead_tier').reduce((acc, item) => {
    acc[item.name] = item.count;
    return acc;
  }, {});
  const topCities = countBy(finalRows, 'city').slice(0, 20);
  const topBrands = countBy(finalRows, 'brand_name').filter((item) => item.name !== 'Unknown').slice(0, 20);
  const provincesCovered = new Set(finalRows.map((row) => row.province).filter(Boolean)).size;
  const citiesCovered = new Set(finalRows.map((row) => row.city).filter(Boolean)).size;
  const withWebsites = finalRows.filter((row) => row.website).length;

  const report = [
    'ARTIFICAGENT TURKEY JEWELRY LEAD DATABASE REPORT',
    `Generated at: ${new Date().toISOString()}`,
    '',
    `source_directory: ${SOURCE_DIR}`,
    `output_directory: ${OUTPUT_DIR}`,
    '',
    `total raw businesses found: ${rawRecords.length}`,
    `total jewelry candidates found: ${candidates.length}`,
    `total businesses after deduplication: ${deduped.length}`,
    `total final leads: ${finalRows.length}`,
    `A tier count: ${tierCounts.A || 0}`,
    `B tier count: ${tierCounts.B || 0}`,
    `C tier count: ${tierCounts.C || 0}`,
    `D tier count: ${tierCounts.D || 0}`,
    '',
    `businesses with phones: ${finalRows.filter((row) => row.phone).length}`,
    `businesses with websites: ${withWebsites}`,
    `businesses with emails: ${finalRows.filter((row) => row.email).length}`,
    `businesses with WhatsApp: ${finalRows.filter((row) => row.whatsapp_number || row.whatsapp_url).length}`,
    `businesses with Instagram: ${finalRows.filter((row) => row.instagram).length}`,
    '',
    `number of provinces covered: ${provincesCovered}`,
    `number of cities covered: ${citiesCovered}`,
    '',
    'top 20 cities by lead count:',
    ...topCities.map((item, index) => `${index + 1}. ${item.name}: ${item.count}`),
    '',
    'top 20 brands/chains discovered:',
    ...topBrands.map((item, index) => `${index + 1}. ${item.name}: ${item.count}`),
    '',
    `average review count: ${average(finalRows, 'review_count').toFixed(2)}`,
    `website enrichment success rate: ${finalRows.length ? ((withWebsites / finalRows.length) * 100).toFixed(2) : '0.00'}%`,
    `duplicate count removed: ${duplicates.length}`,
    `scraping query plan: ${OUTPUTS.scrapePlanCsv}`,
    '',
    'errors encountered:',
    ...(parseErrors.length ? parseErrors : ['none']),
    '',
    finalRows.length < TARGET_LIMIT
      ? `WARNING: Current local extractor files produced ${finalRows.length} unique jewelry leads. Run more Google Maps Extractor tasks with jewelry keywords/cities to reach ${TARGET_LIMIT}.`
      : `Target met: selected best ${TARGET_LIMIT} leads by lead_score and review_count.`,
  ].join('\r\n');

  fs.writeFileSync(OUTPUTS.report, report, 'utf8');

  console.log(JSON.stringify({
    sourceDir: SOURCE_DIR,
    outputDir: OUTPUT_DIR,
    rawBusinesses: rawRecords.length,
    jewelryCandidates: candidates.length,
    deduped: deduped.length,
    finalLeads: finalRows.length,
    duplicatesRemoved: duplicates.length,
    files: OUTPUTS,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
