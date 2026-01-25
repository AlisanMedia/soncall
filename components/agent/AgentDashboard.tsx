'use client';

import { useState, useEffect } from 'react';
import { Profile } from '@/types';
import { LogOut, MessageCircle, Settings, Phone, Target, List, DollarSign } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import LeadCard from './LeadCard';
import Leaderboard from './Leaderboard';
import NotificationToast from './NotificationToast';
import GamificationBar from './GamificationBar';
import AgentTasks from './AgentTasks';
import ChatPanel from '../chat/ChatPanel';
import ChatNotificationBadge from '../chat/ChatNotificationBadge';
import AgentSettings from './AgentSettings';
import LeadHistoryView from './LeadHistoryView';
import MySales from './MySales';
import { ExpandableTabs } from '@/components/ui/expandable-tabs';
import { BGPattern } from '@/components/ui/bg-pattern';

const getRankColor = (rank?: string) => {
    switch (rank) {
        case 'Godlike': return 'bg-red-500/20 text-red-300 border-red-500/30';
        case 'Efsane': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
        case 'Usta': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
        case 'Uzman': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
        default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30'; // Çaylak
    }
};

const calculateLevelAndRank = (processedCount: number) => {
    const level = Math.floor(processedCount / 50) + 1;
    let rank = 'Çaylak';
    if (level >= 5) rank = 'Uzman';
    if (level >= 10) rank = 'Usta';
    if (level >= 20) rank = 'Efsane';
    if (level >= 50) rank = 'Godlike';
    return { level, rank };
};

interface AgentDashboardProps {
    profile: Profile;
}

interface Notification {
    id: string;
    type: 'milestone' | 'streak' | 'encouragement' | 'achievement';
    message: string;
    icon: string;
    timestamp: string;
}

export default function AgentDashboard({ profile: initialProfile }: AgentDashboardProps) {
    const [profile, setProfile] = useState<Profile>(initialProfile);
    const [activeTab, setActiveTab] = useState<'work' | 'history' | 'sales' | 'settings'>('work');
    const [refreshKey, setRefreshKey] = useState(0);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [chatOpen, setChatOpen] = useState(false);
    const [managerId, setManagerId] = useState<string | null>(null);
    const [stats, setStats] = useState({ level: 1, rank: 'Çaylak' });

    const supabase = createClient();
    const router = useRouter();

    // Helper to process notifications with localStorage logic
    const processNewNotifications = (incomingNotifications: Notification[]) => {
        if (!incomingNotifications || incomingNotifications.length === 0) return;

        // Use localStorage key scoped to user to avoid conflicts
        const storageKey = `seen_notifications_${initialProfile.id}`;
        let seenIds: string[] = [];
        try {
            seenIds = JSON.parse(localStorage.getItem(storageKey) || '[]');
        } catch (e) {
            console.error('Error reading seen notifications', e);
        }

        const seenSet = new Set(seenIds);

        // Filter out any notification ID that has EVER been seen
        const newNotifs = incomingNotifications.filter(n => !seenSet.has(n.id));

        if (newNotifs.length > 0) {
            // New unseen notifications found!

            // 1. Mark them as seen immediately in storage
            newNotifs.forEach(n => seenSet.add(n.id));
            localStorage.setItem(storageKey, JSON.stringify(Array.from(seenSet)));

            // 2. Show them to the user
            setNotifications(prev => {
                // Double check against current state to prevent duplicates in very fast race conditions
                const uniqueNew = newNotifs.filter(n => !prev.some(p => p.id === n.id));
                return [...prev, ...uniqueNew];
            });
        }
    };

    useEffect(() => {
        // Fetch fresh profile data including new fields
        const getProfile = async () => {
            const { data } = await supabase.from('profiles').select('*').eq('id', initialProfile.id).single();
            if (data) setProfile(data);

            // Calculate level
            const { count } = await supabase
                .from('lead_activity_log')
                .select('*', { count: 'exact', head: true })
                .eq('agent_id', initialProfile.id)
                .eq('action', 'completed');

            const { level, rank } = calculateLevelAndRank(count || 0);
            setStats({ level, rank });
        };
        getProfile();
    }, [initialProfile.id]);

    useEffect(() => {
        // Fetch manager ID for direct messaging
        const fetchManager = async () => {
            try {
                const { data } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('role', 'manager')
                    .limit(1)
                    .single();

                if (data) {
                    setManagerId(data.id);
                }
            } catch (err) {
                console.error('Failed to fetch manager:', err);
            }
        };

        fetchManager();

        // Poll for notifications
        const checkNotifications = async () => {
            try {
                const response = await fetch('/api/agent/notifications');
                const data = await response.json();

                if (response.ok && data.notifications) {
                    processNewNotifications(data.notifications);
                }
            } catch (err) {
                console.error('Notification check error:', err);
            }
        };

        const interval = setInterval(checkNotifications, 15000); // Check every 15s

        // Initial check on mount
        checkNotifications();

        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const handleLeadProcessed = () => {
        // Trigger refresh by incrementing key
        setRefreshKey(prev => prev + 1);

        // Also check for notifications immediately after action
        fetch('/api/agent/notifications')
            .then(res => res.json())
            .then(data => {
                if (data.notifications) {
                    processNewNotifications(data.notifications);
                }
            })
            .catch(err => console.error('Immediate notification check error:', err));
    };

    const removeNotification = (id: string) => {
        // Just remove from view. It is already marked as seen in localStorage essentially "on receipt"
        // so it won't come back on next poll.
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 pb-20 relative overflow-hidden isolate">
            <BGPattern variant="dots" fill="#ffffff" className="opacity-20" mask="fade-edges" />
            {/* Header */}
            <header className="bg-white/10 backdrop-blur-lg border-b border-white/20 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
                    <div className="flex items-center justify-between gap-2">
                        {/* Logo & Brand - Hidden on very small screens if needed, or simplified */}
                        <div className="flex items-center gap-2 sm:gap-6 flex-shrink-0">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <img
                                    src="/artificagent-logo.png"
                                    alt="ArtificAgent"
                                    className="h-8 w-8 sm:h-8 sm:w-auto opacity-90"
                                />
                                <div className="hidden sm:block">
                                    <h1 className="text-xl font-bold text-white tracking-tight">ArtificAgent</h1>
                                    <p className="text-xs text-purple-200">Agent Panel</p>
                                </div>
                            </div>

                            {/* Navigation Tabs - Integrated into header for easy access */}
                            <div className="hidden sm:block">
                                <ExpandableTabs
                                    tabs={[
                                        { title: "Çağrı", icon: Phone },
                                        { title: "Geçmiş", icon: List },
                                        { title: "Satışlarım", icon: DollarSign },
                                        { type: "separator" },
                                        { title: "Ayarlar", icon: Settings },
                                    ]}
                                    className="bg-black/20 border-white/5"
                                    activeColor="text-purple-400 bg-purple-500/10"
                                    defaultIndex={activeTab === 'work' ? 0 : activeTab === 'history' ? 1 : activeTab === 'sales' ? 2 : 4}
                                    onChange={(index) => {
                                        if (index === 0) setActiveTab('work');
                                        if (index === 1) setActiveTab('history');
                                        if (index === 2) setActiveTab('sales');
                                        if (index === 4) setActiveTab('settings');
                                    }}
                                />
                            </div>
                            {/* Mobile Fallback - Simplified */}
                            <nav className="flex sm:hidden items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/5">
                                <button
                                    onClick={() => setActiveTab('work')}
                                    className={`p-2 rounded-md transition-all ${activeTab === 'work' ? 'bg-purple-600 text-white' : 'text-gray-300'}`}
                                >
                                    <Phone className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={`p-2 rounded-md transition-all ${activeTab === 'history' ? 'bg-purple-600 text-white' : 'text-gray-300'}`}
                                >
                                    <List className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setActiveTab('sales')}
                                    className={`p-2 rounded-md transition-all ${activeTab === 'sales' ? 'bg-purple-600 text-white' : 'text-gray-300'}`}
                                >
                                    <DollarSign className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setActiveTab('settings')}
                                    className={`p-2 rounded-md transition-all ${activeTab === 'settings' ? 'bg-purple-600 text-white' : 'text-gray-300'}`}
                                >
                                    <Settings className="w-5 h-5" />
                                </button>
                            </nav>
                        </div>

                        {/* User Profile Info */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="flex items-center gap-3 text-right">
                                <div className="hidden md:block">
                                    <p className="text-xs text-purple-200">Hoş geldiniz,</p>
                                    <p className="font-semibold text-white text-sm truncate max-w-[150px]">{profile.nickname || profile.full_name}</p>
                                    <div className={`mt-1 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border inline-block ${getRankColor(stats.rank)}`}>
                                        {stats.rank}
                                    </div>
                                </div>
                                <div className="relative">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-purple-500/20 border border-purple-500/50 overflow-hidden">
                                        <img
                                            src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.email}`}
                                            alt="Avatar"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded-full border border-white/20 font-mono z-10 whitespace-nowrap">
                                        Lvl {stats.level}
                                    </div>
                                </div>
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

            {/* Notifications */}
            {notifications.slice(0, 3).map((notification, index) => (
                <NotificationToast
                    key={notification.id}
                    notification={notification}
                    onClose={removeNotification}
                />
            ))}

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
                {/* Work Tab - Keep mounted to preserve state */}
                <div className={`space-y-6 ${activeTab !== 'work' ? 'hidden' : ''}`}>
                    {/* Gamification Bar */}
                    <div className="w-full">
                        <GamificationBar agentId={profile.id} />
                    </div>

                    <div className="flex flex-col lg:grid lg:grid-cols-4 gap-6">
                        {/* Lead Card - Main Work Area (First on Mobile) */}
                        <div className="lg:col-span-3 order-1 lg:order-2 space-y-6">
                            <LeadCard
                                agentId={profile.id}
                                onLeadProcessed={handleLeadProcessed}
                                refreshKey={refreshKey}
                            />

                            {/* Tasks Section */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Target className="w-5 h-5 text-purple-400" />
                                    Görevler
                                </h3>
                                <AgentTasks agentId={profile.id} />
                            </div>
                        </div>

                        {/* Leaderboard Sidebar */}
                        <div className="lg:col-span-1 order-2 lg:order-1">
                            <Leaderboard agentId={profile.id} refreshKey={refreshKey} />
                        </div>
                    </div>
                </div>

                {/* History Tab */}
                {activeTab === 'history' && <LeadHistoryView />}

                {/* Sales Tab */}
                {activeTab === 'sales' && <MySales />}

                {/* Settings Tab */}
                {activeTab === 'settings' && <AgentSettings userProfile={profile} />}
            </main>

            {/* Floating Chat Button (Only show in Work tab) */}
            {(activeTab === 'work' || activeTab === 'history') && (
                <button
                    onClick={() => setChatOpen(!chatOpen)}
                    className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95"
                    title="Open Chat"
                >
                    <MessageCircle className="w-6 h-6" />
                    <ChatNotificationBadge userId={profile.id} />
                </button>
            )}

            {/* Chat Panel - Defaulting to Team Chat (Broadcast) so agents can talk to each other */}
            <ChatPanel
                userId={profile.id}
                isOpen={chatOpen}
                onClose={() => setChatOpen(false)}
                title="Team Chat"
            />
        </div>
    );
}
