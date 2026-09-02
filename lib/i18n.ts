export type SupportedLocale = 'tr' | 'en';

export type TranslationKey =
  | 'manager.dashboardTitle'
  | 'manager.panelSubtitle'
  | 'manager.nav.monitor'
  | 'manager.nav.alerts'
  | 'manager.nav.team'
  | 'manager.nav.leads'
  | 'manager.nav.calendar'
  | 'manager.nav.analytics'
  | 'manager.nav.reports'
  | 'manager.nav.rankings'
  | 'manager.nav.goals'
  | 'manager.nav.upload'
  | 'manager.nav.admin'
  | 'manager.nav.smsLogs'
  | 'manager.nav.settings'
  | 'manager.sidebar.expand'
  | 'manager.sidebar.collapse'
  | 'manager.sidebar.operation'
  | 'manager.upload.stepUpload'
  | 'manager.upload.stepDistribute'
  | 'manager.market.defaultOperation'
  | 'common.logout'
  | 'agent.panel.sdr'
  | 'agent.panel.closer'
  | 'agent.nav.call'
  | 'agent.nav.meeting'
  | 'agent.nav.appointments'
  | 'agent.nav.leadSearch'
  | 'agent.nav.mySales'
  | 'agent.nav.settings'
  | 'agent.manual.add'
  | 'agent.profile.welcome'
  | 'agent.profile.level';

const translations: Record<SupportedLocale, Record<TranslationKey, string>> = {
  tr: {
    'manager.dashboardTitle': 'Manager Dashboard',
    'manager.panelSubtitle': 'Yönetici paneli',
    'manager.nav.monitor': 'Genel Bakış',
    'manager.nav.alerts': 'Alarmlar',
    'manager.nav.team': 'Personel',
    'manager.nav.leads': 'Leads',
    'manager.nav.calendar': 'Randevular',
    'manager.nav.analytics': 'Analiz',
    'manager.nav.reports': 'Raporlar',
    'manager.nav.rankings': 'Sıralama',
    'manager.nav.goals': 'Hedefler',
    'manager.nav.upload': 'Yükle',
    'manager.nav.admin': 'Admin',
    'manager.nav.smsLogs': 'SMS Geçmişi',
    'manager.nav.settings': 'Ayarlar',
    'manager.sidebar.expand': 'Menüyü genişlet',
    'manager.sidebar.collapse': 'Menüyü daralt',
    'manager.sidebar.operation': 'Operasyon',
    'manager.upload.stepUpload': '1. CSV Yükle',
    'manager.upload.stepDistribute': '2. Lead Dağıt',
    'manager.market.defaultOperation': 'Türkiye Operasyonu',
    'common.logout': 'Çıkış Yap',
    'agent.panel.sdr': 'SDR Panel',
    'agent.panel.closer': 'Closer Panel',
    'agent.nav.call': 'Çağrı',
    'agent.nav.meeting': 'Toplantı',
    'agent.nav.appointments': 'Randevular',
    'agent.nav.leadSearch': 'Lead Arama',
    'agent.nav.mySales': 'Satışlarım',
    'agent.nav.settings': 'Ayarlar',
    'agent.manual.add': 'Manuel Ekle',
    'agent.profile.welcome': 'Hoş geldiniz,',
    'agent.profile.level': 'Lvl',
  },
  en: {
    'manager.dashboardTitle': 'Manager Dashboard',
    'manager.panelSubtitle': 'Manager panel',
    'manager.nav.monitor': 'Overview',
    'manager.nav.alerts': 'Alerts',
    'manager.nav.team': 'Team',
    'manager.nav.leads': 'Leads',
    'manager.nav.calendar': 'Appointments',
    'manager.nav.analytics': 'Analytics',
    'manager.nav.reports': 'Reports',
    'manager.nav.rankings': 'Rankings',
    'manager.nav.goals': 'Goals',
    'manager.nav.upload': 'Upload',
    'manager.nav.admin': 'Admin',
    'manager.nav.smsLogs': 'SMS History',
    'manager.nav.settings': 'Settings',
    'manager.sidebar.expand': 'Expand menu',
    'manager.sidebar.collapse': 'Collapse menu',
    'manager.sidebar.operation': 'Operation',
    'manager.upload.stepUpload': '1. Upload CSV',
    'manager.upload.stepDistribute': '2. Distribute Leads',
    'manager.market.defaultOperation': 'Turkey Operation',
    'common.logout': 'Log Out',
    'agent.panel.sdr': 'SDR Panel',
    'agent.panel.closer': 'Closer Panel',
    'agent.nav.call': 'Call',
    'agent.nav.meeting': 'Meeting',
    'agent.nav.appointments': 'Appointments',
    'agent.nav.leadSearch': 'Lead Search',
    'agent.nav.mySales': 'My Sales',
    'agent.nav.settings': 'Settings',
    'agent.manual.add': 'Add Manually',
    'agent.profile.welcome': 'Welcome,',
    'agent.profile.level': 'Lvl',
  },
};

export function normalizeLocale(language?: string | null): SupportedLocale {
  return language?.toLowerCase().startsWith('en') ? 'en' : 'tr';
}

export function getTranslator(locale: SupportedLocale) {
  return (key: TranslationKey) => translations[locale][key] || translations.tr[key];
}
