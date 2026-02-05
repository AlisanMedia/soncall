'use client';

import { GlassButton } from '@/components/ui/glass-button';
import { useState } from 'react';
import { Profile } from '@/types';
import dynamic from 'next/dynamic';
import { BGPattern } from '@/components/ui/bg-pattern';

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

// Keep default tab components static for faster LCP
import TeamMonitoring from '@/components/manager/TeamMonitoring';
import TopSellers from './TopSellers';
import SalesApprovals from './SalesApprovals';

import { LogOut, Upload, Users, BarChart3, Activity, TrendingUp, Trophy, Sparkles, AlertTriangle, Target, Calendar, Briefcase, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import ChatPanel from '../chat/ChatPanel';
import ChatNotificationBadge from '../chat/ChatNotificationBadge';
import DashboardSwitcher from '../shared/DashboardSwitcher';


interface ManagerDashboardProps {
    profile: Profile;
}

type Step = 'upload' | 'distribute';
type Tab = 'upload' | 'monitor' | 'reports' | 'analytics' | 'rankings' | 'leads' | 'admin' | 'goals' | 'calendar' | 'team' | 'settings';

export default function ManagerDashboard({ profile }: ManagerDashboardProps) {
    const [currentTab, setCurrentTab] = useState<Tab>('monitor');

    const [currentStep, setCurrentStep] = useState<Step>('upload');
    const [batchId, setBatchId] = useState<string | null>(null);
    const [totalLeads, setTotalLeads] = useState(0);
    const [chatOpen, setChatOpen] = useState(false);
    const supabase = createClient();
    const router = useRouter();

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
            {/* Header */}
            <header className="glass-nav sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
                    <div className="flex items-center justify-between gap-2 min-h-[56px]">
                        {/* Left Side: Logo */}
                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                            <img
                                src="/artificagent-logo.png"
                                alt="ArtificAgent"
                                className="h-8 opacity-90"
                            />
                            <div className="hidden sm:block">
                                <h1 className="text-xl sm:text-2xl font-bold text-white">ArtificAgent</h1>
                                <p className="text-xs sm:text-sm text-purple-200">Manager Dashboard</p>
                            </div>
                        </div>

                        {/* Center: Navigation Items (Absolute) */}
                        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-1 bg-slate-800/80 backdrop-blur-md rounded-2xl p-1.5 border border-white/10 shadow-xl z-10">
                            {[
                                { id: 'monitor', icon: Activity, label: 'Genel Bakış' },
                                { id: 'team', icon: Users, label: 'Personel' },
                                { id: 'leads', icon: Briefcase, label: 'Leads' },
                                { id: 'calendar', icon: Calendar, label: 'Randevular' },
                                { id: 'analytics', icon: TrendingUp, label: 'Analiz' },
                                { id: 'reports', icon: BarChart3, label: 'Raporlar' },
                                { id: 'rankings', icon: Trophy, label: 'Sıralama' },
                                { id: 'goals', icon: Target, label: 'Hedefler' },
                                { id: 'upload', icon: Upload, label: 'Yükle' },
                                { id: 'admin', icon: AlertTriangle, label: 'Admin' },
                                { id: 'settings', icon: Settings, label: 'Ayarlar' },
                            ].map((item) => (
                                <GlassButton
                                    key={item.id}
                                    onClick={() => setCurrentTab(item.id as Tab)}
                                    size="icon"
                                    className={`transition-all relative group ${currentTab === item.id
                                        ? '!bg-purple-600 !border-purple-500 shadow-lg shadow-purple-500/25'
                                        : 'opacity-70 hover:opacity-100'
                                        }`}
                                    title={item.label}
                                >
                                    <item.icon className="w-5 h-5 text-white" />
                                    {/* Tooltip */}
                                    <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-[10px] bg-black/80 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                        {item.label}
                                    </span>
                                </GlassButton>
                            ))}
                        </div>

                        {/* Right Side: Profile & Logout */}
                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                            <div className="hidden sm:block text-right">
                                <p className="text-xs text-purple-200">Hoş geldiniz,</p>
                                <p className="text-sm font-semibold text-white truncate max-w-[120px]">{profile.full_name}</p>
                            </div>
                            <GlassButton
                                onClick={handleLogout}
                                size="icon"
                                className="bg-white/10 hover:bg-white/20"
                                title="Çıkış Yap"
                            >
                                <LogOut className="w-5 h-5 text-white" />
                            </GlassButton>
                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile Navigation (Visible only on small screens) - Enhanced with Smooth Scroll */}
            <div className="md:hidden sticky top-0 z-40 bg-slate-900/50 backdrop-blur-md border-b border-white/5 overflow-x-auto scrollbar-thin">
                <div className="flex p-2 gap-2 min-w-max">
                    {[
                        { id: 'monitor', icon: Activity, label: 'Genel Bakış' },
                        { id: 'team', icon: Users, label: 'Personel' },
                        { id: 'leads', icon: Briefcase, label: 'Leads' },
                        { id: 'calendar', icon: Calendar, label: 'Randevular' },
                        { id: 'analytics', icon: TrendingUp, label: 'Analiz' },
                        { id: 'reports', icon: BarChart3, label: 'Raporlar' },
                        { id: 'rankings', icon: Trophy, label: 'Sıralama' },
                        { id: 'goals', icon: Target, label: 'Hedefler' },
                        { id: 'upload', icon: Upload, label: 'Yükle' },
                        { id: 'admin', icon: AlertTriangle, label: 'Admin' },
                        { id: 'settings', icon: Settings, label: 'Ayarlar' },
                    ].map((item) => (
                        <GlassButton
                            key={item.id}
                            onClick={() => setCurrentTab(item.id as Tab)}
                            className={`min-w-[70px] transition-all touch-target active:scale-95 ${currentTab === item.id
                                ? '[&>.glass-button]:!bg-purple-600 [&>.glass-button]:!border-purple-500 [&>.glass-button]:shadow-lg'
                                : 'opacity-70 hover:opacity-100'
                                }`}
                            contentClassName="flex flex-col items-center gap-1 !p-3"
                        >
                            <item.icon className="w-5 h-5 text-white" />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </GlassButton>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <SalesApprovals />
                {currentTab === 'monitor' && (
                    <>
                        <div className="mb-8">
                            <TopSellers />
                        </div>
                        <TeamMonitoring />
                    </>
                )}
                {/* Prevent duplicate render placeholder - removed */}
                {currentTab === 'calendar' && <AppointmentCalendar />}
                {currentTab === 'team' && <TeamList />}
                {currentTab === 'leads' && <LeadManagementView />}
                {currentTab === 'analytics' && <AnalyticsView />}
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
                                    <span className="font-medium">1. CSV Yükle</span>
                                </div>
                                <div className="hidden sm:block w-12 h-0.5 bg-white/20"></div>
                                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${currentStep === 'distribute'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-white/10 text-purple-200'
                                    }`}>
                                    <Users className="w-5 h-5" />
                                    <span className="font-medium">2. Lead Dağıt</span>
                                </div>
                            </div>
                        </div>

                        {/* Step Content */}
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-4 sm:p-8 border border-white/20">
                            {currentStep === 'upload' && (
                                <FileUpload onUploadSuccess={handleUploadSuccess} />
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
            </main>

            {/* Floating Action Buttons - Mobile Optimized */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-4 safe-bottom safe-right">
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
