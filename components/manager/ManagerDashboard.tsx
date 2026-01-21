'use client';

import { useState } from 'react';
import { Profile } from '@/types';
import { LogOut, Upload, Users, BarChart3, Activity, TrendingUp, Trophy, MessageCircle, AlertTriangle, Target } from 'lucide-react';
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

interface ManagerDashboardProps {
    profile: Profile;
}

type Step = 'upload' | 'distribute';
type Tab = 'upload' | 'monitor' | 'reports' | 'analytics' | 'rankings' | 'leads' | 'admin' | 'goals';

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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

            {/* Scrollable Tabs */}
            <div className="sticky top-[80px] z-40 bg-slate-900/50 backdrop-blur-md border-b border-white/5 py-2">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                        <button
                            onClick={() => setCurrentTab('monitor')}
                            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap ${currentTab === 'monitor'
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'text-purple-200 hover:bg-white/10'
                                }`}
                        >
                            <Activity className="w-4 h-4" />
                            <span>Takım</span>
                        </button>
                        <button
                            onClick={() => setCurrentTab('leads')}
                            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap ${currentTab === 'leads'
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'text-purple-200 hover:bg-white/10'
                                }`}
                        >
                            <Users className="w-4 h-4" />
                            <span>Leads</span>
                        </button>
                        <button
                            onClick={() => setCurrentTab('analytics')}
                            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap ${currentTab === 'analytics'
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'text-purple-200 hover:bg-white/10'
                                }`}
                        >
                            <TrendingUp className="w-4 h-4" />
                            <span>Analytics</span>
                        </button>
                        <button
                            onClick={() => setCurrentTab('rankings')}
                            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap ${currentTab === 'rankings'
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'text-purple-200 hover:bg-white/10'
                                }`}
                        >
                            <Trophy className="w-4 h-4" />
                            <span>Rank</span>
                        </button>
                        <button
                            onClick={() => setCurrentTab('reports')}
                            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap ${currentTab === 'reports'
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'text-purple-200 hover:bg-white/10'
                                }`}
                        >
                            <BarChart3 className="w-4 h-4" />
                            <span>Rapor</span>
                        </button>
                        <button
                            onClick={() => setCurrentTab('goals')}
                            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap ${currentTab === 'goals'
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'text-purple-200 hover:bg-white/10'
                                }`}
                        >
                            <Target className="w-4 h-4" />
                            <span>Hedefler</span>
                        </button>
                        <button
                            onClick={() => setCurrentTab('admin')}
                            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap ${currentTab === 'admin'
                                ? 'bg-red-600 text-white shadow-lg'
                                : 'text-purple-200 hover:bg-white/10'
                                }`}
                        >
                            <AlertTriangle className="w-4 h-4" />
                            <span>Admin</span>
                        </button>
                        <button
                            onClick={() => setCurrentTab('upload')}
                            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap ${currentTab === 'upload'
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'text-purple-200 hover:bg-white/10'
                                }`}
                        >
                            <Upload className="w-4 h-4" />
                            <span>Yükle</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <SalesApprovals />
                {currentTab === 'monitor' && <TeamMonitoring />}
                {currentTab === 'leads' && <LeadManagementView />}
                {currentTab === 'analytics' && <AnalyticsView />}
                {currentTab === 'rankings' && <AgentRankings />}
                {currentTab === 'goals' && <GoalManager />}
                {currentTab === 'reports' && <ReportsView managerId={profile.id} />}
                {currentTab === 'admin' && <AdminPanel />}

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
