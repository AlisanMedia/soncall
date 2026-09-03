'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import { Market, Profile } from '@/types';
import dynamic from 'next/dynamic';

const TeamList = dynamic(() => import('@/components/manager/TeamList'));
const FileUpload = dynamic(() => import('@/components/manager/FileUpload'));
const LeadDistribution = dynamic(() => import('@/components/manager/LeadDistribution'));
const ReportsView = dynamic(() => import('./ReportsView'));
const AnalyticsView = dynamic(() => import('./AnalyticsView'));
const AgentRankings = dynamic(() => import('./AgentRankings'));
const LeadManagementView = dynamic(() => import('./LeadManagementView'));
const AdminPanel = dynamic(() => import('./AdminPanel'));
const GoalManager = dynamic(() => import('./GoalManager'));
const AppointmentCalendar = dynamic(() => import('./AppointmentCalendar'));
const ProfileSettings = dynamic(() => import('./ProfileSettings'));
const SmsLogs = dynamic(() => import('./SmsLogs'));
const ManagerAlertsCenter = dynamic(() => import('./ManagerAlertsCenter'));

// Keep default tab components static for faster LCP
import TeamMonitoring from '@/components/manager/TeamMonitoring';
import TopSellers from './TopSellers';
import SalesApprovals from './SalesApprovals';

import { LogOut, Upload, Users, BarChart3, Activity, TrendingUp, Trophy, Sparkles, AlertTriangle, Target, Calendar, Briefcase, Settings, MessageSquare, ShieldAlert, Globe2, Lock, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import ChatPanel from '../chat/ChatPanel';
import ChatNotificationBadge from '../chat/ChatNotificationBadge';
import { getTranslator, normalizeLocale, type TranslationKey } from '@/lib/i18n';


interface ManagerDashboardProps {
    profile: Profile;
}

type Step = 'upload' | 'distribute';
type Tab = 'upload' | 'monitor' | 'alerts' | 'reports' | 'analytics' | 'rankings' | 'leads' | 'admin' | 'goals' | 'calendar' | 'team' | 'settings' | 'sms-logs';

const navigationItems: { id: Tab; icon: ElementType; labelKey: TranslationKey }[] = [
    { id: 'monitor', icon: Activity, labelKey: 'manager.nav.monitor' },
    { id: 'alerts', icon: ShieldAlert, labelKey: 'manager.nav.alerts' },
    { id: 'team', icon: Users, labelKey: 'manager.nav.team' },
    { id: 'leads', icon: Briefcase, labelKey: 'manager.nav.leads' },
    { id: 'calendar', icon: Calendar, labelKey: 'manager.nav.calendar' },
    { id: 'analytics', icon: TrendingUp, labelKey: 'manager.nav.analytics' },
    { id: 'reports', icon: BarChart3, labelKey: 'manager.nav.reports' },
    { id: 'rankings', icon: Trophy, labelKey: 'manager.nav.rankings' },
    { id: 'goals', icon: Target, labelKey: 'manager.nav.goals' },
    { id: 'upload', icon: Upload, labelKey: 'manager.nav.upload' },
    { id: 'admin', icon: AlertTriangle, labelKey: 'manager.nav.admin' },
    { id: 'sms-logs', icon: MessageSquare, labelKey: 'manager.nav.smsLogs' },
    { id: 'settings', icon: Settings, labelKey: 'manager.nav.settings' },
];

export default function ManagerDashboard({ profile }: ManagerDashboardProps) {
    const [currentTab, setCurrentTab] = useState<Tab>('monitor');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const [currentStep, setCurrentStep] = useState<Step>('upload');
    const [batchId, setBatchId] = useState<string | null>(null);
    const [totalLeads, setTotalLeads] = useState(0);
    const [chatOpen, setChatOpen] = useState(false);
    const [markets, setMarkets] = useState<Market[]>([]);
    const [selectedMarketId, setSelectedMarketId] = useState<string | null>(profile.market_id || null);
    const [canSwitchMarket, setCanSwitchMarket] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    const selectedMarket = useMemo(
        () => markets.find((market) => market.id === selectedMarketId) || markets[0] || null,
        [markets, selectedMarketId]
    );
    const locale = normalizeLocale(selectedMarket?.default_language || profile.preferred_language);
    const t = getTranslator(locale);

    useEffect(() => {
        const loadMarkets = async () => {
            try {
                const response = await fetch('/api/markets');
                const data = await response.json();
                const nextMarkets = data.markets || [];
                setMarkets(nextMarkets);
                setCanSwitchMarket(Boolean(data.canSwitchMarket));
                setSelectedMarketId((current) => current || data.currentMarketId || nextMarkets[0]?.id || null);
            } catch (error) {
                console.error('Failed to load markets', error);
            }
        };

        loadMarkets();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const handleUploadSuccess = (newBatchId: string, count: number) => {
        setBatchId(newBatchId);
        setTotalLeads(count);
        setCurrentStep('distribute');
    };

    const handleDistributionComplete = () => {
        // Reset to upload step for next batch
        setCurrentStep('upload');
        setBatchId(null);
        setTotalLeads(0);
    };

    return (
        <div className="min-h-screen pb-20 relative overflow-hidden isolate animate-fade-in">
            {/* Animated Background Grid */}
            <div className="fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(168,85,247,0.15)_0%,_transparent_50%)]" />
                <div className="absolute inset-0" style={{
                    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
                    backgroundSize: '50px 50px'
                }} />
            </div>
            {/* Sidebar Navigation */}
            <aside className={`fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-white/10 bg-slate-950/70 backdrop-blur-xl shadow-2xl shadow-black/30 transition-all duration-300 md:flex ${sidebarCollapsed ? 'w-20' : 'w-72'}`}>
                <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
                    <img
                        src="/artificagent-logo.png"
                        alt="ArtificAgent"
                        className="h-8 w-auto flex-shrink-0 opacity-90"
                    />
                    {!sidebarCollapsed && (
                        <div className="hidden min-w-0 md:block">
                            <h1 className="truncate text-lg font-bold text-white">ArtificAgent</h1>
                            <p className="truncate text-xs text-purple-200">{t('manager.dashboardTitle')}</p>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between border-b border-white/10 px-3 py-3">
                    {!sidebarCollapsed && (
                        <div className="hidden min-w-0 text-xs text-slate-300 md:block">
                            <p className="truncate font-semibold text-white">{profile.full_name}</p>
                            <p className="truncate text-purple-200">{t('manager.panelSubtitle')}</p>
                        </div>
                    )}
                    <button
                        onClick={() => setSidebarCollapsed((value) => !value)}
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 hover:text-white"
                        title={sidebarCollapsed ? t('manager.sidebar.expand') : t('manager.sidebar.collapse')}
                        aria-label={sidebarCollapsed ? t('manager.sidebar.expand') : t('manager.sidebar.collapse')}
                    >
                        {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                    </button>
                </div>

                <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin">
                    {navigationItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentTab === item.id;
                        const label = t(item.labelKey);

                        return (
                            <button
                                key={item.id}
                                onClick={() => setCurrentTab(item.id)}
                                className={`group relative flex h-11 w-full items-center rounded-xl border text-sm font-semibold transition-all ${sidebarCollapsed ? 'justify-center px-0' : 'justify-start gap-3 px-3'
                                    } ${isActive
                                        ? 'border-purple-400/40 bg-purple-600/25 text-white shadow-lg shadow-purple-600/10'
                                        : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/10 hover:text-white'
                                    }`}
                                title={label}
                            >
                                <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-purple-100' : 'text-slate-300 group-hover:text-white'}`} />
                                {!sidebarCollapsed && <span className="truncate">{label}</span>}
                                {isActive && <span className="absolute left-0 top-2 h-7 w-1 rounded-r-full bg-purple-300" />}
                            </button>
                        );
                    })}
                </nav>

                <div className="border-t border-white/10 p-3">
                    {!sidebarCollapsed && (
                        <div className="mb-3 hidden rounded-xl border border-white/10 bg-white/[0.04] p-3 md:block">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-200">
                                <Globe2 className="h-4 w-4" />
                                {t('manager.sidebar.operation')}
                            </div>
                            {canSwitchMarket ? (
                                <select
                                    value={selectedMarketId || ''}
                                    onChange={(event) => setSelectedMarketId(event.target.value || null)}
                                    className="w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-sm font-semibold text-white outline-none"
                                >
                                    {markets.map((market) => (
                                        <option key={market.id} value={market.id}>
                                            {market.code} - {market.name}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                    <span className="truncate">{selectedMarket?.code || 'TR'} - {selectedMarket?.name || 'Türkiye'}</span>
                                    <Lock className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                                </div>
                            )}
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className={`flex h-11 w-full items-center rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white ${sidebarCollapsed ? 'justify-center px-0' : 'justify-start gap-3 px-3'}`}
                        title={t('common.logout')}
                    >
                        <LogOut className="h-5 w-5 flex-shrink-0" />
                        {!sidebarCollapsed && <span>{t('common.logout')}</span>}
                    </button>
                </div>
            </aside>

            {/* Tab Content */}
            <main className={`min-h-screen px-3 py-4 pb-28 transition-all duration-300 sm:px-6 sm:py-6 md:pb-10 lg:px-8 ${sidebarCollapsed ? 'md:ml-20' : 'md:ml-72'}`}>
                <div className="mb-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 lg:hidden">
                    <div className="flex items-center gap-2 text-sm text-white">
                        <Globe2 className="w-4 h-4 text-cyan-300" />
                        <span>{selectedMarket?.name || t('manager.market.defaultOperation')}</span>
                    </div>
                    {canSwitchMarket && (
                        <select
                            value={selectedMarketId || ''}
                            onChange={(event) => setSelectedMarketId(event.target.value || null)}
                            className="max-w-[170px] rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-sm text-white"
                        >
                            {markets.map((market) => (
                                <option key={market.id} value={market.id}>
                                    {market.code} - {market.name}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
                {currentTab === 'monitor' && (
                    <>
                        <ManagerAlertsCenter selectedMarketId={selectedMarketId} />
                        <SalesApprovals />
                        <div className="mb-8">
                            <TopSellers />
                        </div>
                        <TeamMonitoring selectedMarketId={selectedMarketId} />
                    </>
                )}
                {currentTab === 'alerts' && <ManagerAlertsCenter selectedMarketId={selectedMarketId} />}
                {/* Prevent duplicate render placeholder - removed */}
                {currentTab === 'calendar' && <AppointmentCalendar />}
                {currentTab === 'team' && <TeamList selectedMarketId={selectedMarketId} markets={markets} canSwitchMarket={canSwitchMarket} />}
                {currentTab === 'leads' && <LeadManagementView selectedMarketId={selectedMarketId} />}
                {currentTab === 'analytics' && <AnalyticsView selectedMarketId={selectedMarketId} />}
                {currentTab === 'rankings' && <AgentRankings />}
                {currentTab === 'goals' && <GoalManager />}
                {currentTab === 'reports' && <ReportsView managerId={profile.id} />}
                {currentTab === 'admin' && <AdminPanel />}
                {currentTab === 'settings' && <ProfileSettings profile={profile} />}

                {currentTab === 'upload' && (
                    <>
                        {/* Responsive Step Indicator */}
                        <div className="mb-8 overflow-x-auto">
                            <div className="flex items-center sm:justify-center gap-4 min-w-max">
                                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${currentStep === 'upload'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-white/10 text-purple-200'
                                    }`}>
                                    <Upload className="w-5 h-5" />
                                    <span className="font-medium">{t('manager.upload.stepUpload')}</span>
                                </div>
                                <div className="hidden sm:block w-12 h-0.5 bg-white/20"></div>
                                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${currentStep === 'distribute'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-white/10 text-purple-200'
                                    }`}>
                                    <Users className="w-5 h-5" />
                                    <span className="font-medium">{t('manager.upload.stepDistribute')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Step Content */}
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-4 sm:p-8 border border-white/20">
                            {currentStep === 'upload' && (
                                <FileUpload onUploadSuccess={handleUploadSuccess} selectedMarketId={selectedMarketId} selectedMarketName={selectedMarket?.name} />
                            )}


                            {currentStep === 'distribute' && batchId && (
                                <LeadDistribution
                                    batchId={batchId}
                                    totalLeads={totalLeads}
                                    onComplete={handleDistributionComplete}
                                />
                            )}
                        </div>
                    </>
                )}

                {currentTab === 'sms-logs' && <SmsLogs />}
            </main>

            <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-950/90 px-2 py-2 shadow-2xl shadow-black/40 backdrop-blur-xl md:hidden safe-bottom">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {navigationItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentTab === item.id;
                        const label = t(item.labelKey);

                        return (
                            <button
                                key={item.id}
                                onClick={() => setCurrentTab(item.id)}
                                className={`flex min-w-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[10px] font-semibold transition ${isActive
                                    ? 'border-purple-400/40 bg-purple-600/25 text-white'
                                    : 'border-transparent text-slate-300 hover:bg-white/10 hover:text-white'
                                    }`}
                                title={label}
                                aria-label={label}
                            >
                                <Icon className="h-5 w-5 flex-shrink-0" />
                                <span className="w-full truncate text-center leading-tight">{label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* Floating Action Buttons - Mobile Optimized */}
            <div className="fixed bottom-24 right-4 z-50 flex flex-col gap-3 safe-bottom safe-right md:bottom-6 md:right-6 md:gap-4">
                {/* Chat Button */}
                <button
                    onClick={() => setChatOpen(!chatOpen)}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white w-14 h-14 md:w-16 md:h-16 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 relative touch-target-large"
                    title="Open Chat"
                    aria-label="Open Chat"
                >
                    <Sparkles className="w-6 h-6 md:w-7 md:h-7" />
                    <ChatNotificationBadge userId={profile.id} />
                </button>
            </div>

            {/* Chat Panel */}
            <ChatPanel
                userId={profile.id}
                isOpen={chatOpen}
                onClose={() => setChatOpen(false)}
                title="Team Chat"
            />
        </div>
    );
}

