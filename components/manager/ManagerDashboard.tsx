'use client';

import { useState } from 'react';
import { Profile } from '@/types';
import TeamList from '@/components/manager/TeamList';
import { LogOut, Upload, Users, BarChart3, Activity, TrendingUp, Trophy, MessageCircle, AlertTriangle, Target, Calendar, Briefcase, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import FileUpload from '@/components/manager/FileUpload';
import LeadDistribution from '@/components/manager/LeadDistribution';
import TeamMonitoring from '@/components/manager/TeamMonitoring';
import ReportsView from './ReportsView';
import AnalyticsView from './AnalyticsView';
import AgentRankings from './AgentRankings';
import LeadManagementView from './LeadManagementView';
import BroadcastPanel from './BroadcastPanel';
import ChatPanel from '../chat/ChatPanel';
import ChatNotificationBadge from '../chat/ChatNotificationBadge';
import AdminPanel from './AdminPanel';
import GoalManager from './GoalManager';
import SalesApprovals from './SalesApprovals';
import TopSellers from './TopSellers';
import AppointmentCalendar from './AppointmentCalendar';
import ProfileSettings from './ProfileSettings';


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
    const [showBroadcast, setShowBroadcast] = useState(false);
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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 pb-20">
            {/* Header */}
            <header className="bg-white/10 backdrop-blur-lg border-b border-white/20 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
                    <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 h-14">
                        {/* Left Side: Logo */}
                        <div className="flex items-center gap-3">
                            <img
                                src="/artificagent-logo.png"
                                alt="ArtificAgent"
                                className="h-8 opacity-90"
                            />
                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold text-white">ArtificAgent</h1>
                                <p className="text-xs sm:text-sm text-purple-200">Manager Dashboard</p>
                            </div>
                        </div>

                        {/* Center: Navigation Items (Absolute) */}
                        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-1 bg-slate-800/80 backdrop-blur-md rounded-2xl p-1.5 border border-white/10 shadow-xl z-10">
                            {[
                                { id: 'monitor', icon: Activity, label: 'Takım' },
                                { id: 'team', icon: Briefcase, label: 'Personel' },
                                { id: 'leads', icon: Users, label: 'Leads' },
                                { id: 'analytics', icon: TrendingUp, label: 'Analytics' },
                                { id: 'rankings', icon: Trophy, label: 'Rank' },
                                { id: 'reports', icon: BarChart3, label: 'Rapor' },
                                { id: 'goals', icon: Target, label: 'Hedefler' },
                                { id: 'calendar', icon: Calendar, label: 'Randevular' },
                                { id: 'upload', icon: Upload, label: 'Yükle' },
                                { id: 'admin', icon: AlertTriangle, label: 'Admin' },
                                { id: 'settings', icon: Settings, label: 'Ayarlar' },
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setCurrentTab(item.id as Tab)}
                                    className={`p-2 rounded-xl transition-all relative group ${currentTab === item.id
                                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                                        : 'text-purple-200 hover:bg-white/10 hover:text-white'
                                        }`}
                                    title={item.label}
                                >
                                    <item.icon className="w-5 h-5" />
                                    {/* Tooltip */}
                                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-black/80 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                        {item.label}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Right Side: Profile & Logout */}
                        <div className="flex items-center justify-between sm:justify-end gap-4">
                            <div className="text-right">
                                <p className="text-xs text-purple-200">Hoş geldiniz,</p>
                                <p className="text-sm font-semibold text-white">{profile.full_name}</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                                title="Çıkış Yap"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile Navigation (Visible only on small screens) */}
            <div className="md:hidden sticky top-0 z-40 bg-slate-900/50 backdrop-blur-md border-b border-white/5 overflow-x-auto">
                <div className="flex p-2 gap-2 min-w-max">
                    {[
                        { id: 'monitor', icon: Activity, label: 'Takım' },
                        { id: 'team', icon: Briefcase, label: 'Personel' },
                        { id: 'leads', icon: Users, label: 'Leads' },
                        { id: 'analytics', icon: TrendingUp, label: 'Analytics' },
                        { id: 'rankings', icon: Trophy, label: 'Rank' },
                        { id: 'reports', icon: BarChart3, label: 'Rapor' },
                        { id: 'goals', icon: Target, label: 'Hedefler' },
                        { id: 'calendar', icon: Calendar, label: 'Randevular' },
                        { id: 'upload', icon: Upload, label: 'Yükle' },
                        { id: 'admin', icon: AlertTriangle, label: 'Admin' },
                        { id: 'settings', icon: Settings, label: 'Ayarlar' },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setCurrentTab(item.id as Tab)}
                            className={`p-2 rounded-lg flex flex-col items-center gap-1 min-w-[60px] ${currentTab === item.id
                                ? 'bg-purple-600 text-white'
                                : 'text-purple-200 hover:bg-white/10'
                                }`}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="text-[10px]">{item.label}</span>
                        </button>
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

            {/* Floating Action Buttons */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-4">
                {/* Broadcast Button */}
                <button
                    onClick={() => setShowBroadcast(!showBroadcast)}
                    className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                    title="Broadcast to All Agents"
                >
                    <span className="text-xl">📢</span>
                </button>

                {/* Chat Button */}
                <button
                    onClick={() => setChatOpen(!chatOpen)}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 relative"
                    title="Open Chat"
                >
                    <MessageCircle className="w-7 h-7" />
                    <ChatNotificationBadge userId={profile.id} />
                </button>
            </div>

            {/* Broadcast Panel Popup */}
            {showBroadcast && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="max-w-2xl w-full">
                        <BroadcastPanel
                            managerId={profile.id}
                            onClose={() => setShowBroadcast(false)}
                        />
                    </div>
                </div>
            )}

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
