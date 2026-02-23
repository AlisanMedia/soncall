'use client';

import { useState, useEffect } from 'react';
import { Profile } from '@/types';
import { LogOut, MessageCircle, Settings, Phone, Target, List, DollarSign, UserPlus, Calendar } from 'lucide-react';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import ManualLeadDialog from './ManualLeadDialog';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import LeadCard from './LeadCard';
import Leaderboard from './Leaderboard';
import NotificationToast from './NotificationToast';
import { GlobalMissionTimer } from './GlobalMissionTimer';
import GamificationBar from './GamificationBar';
import AgentSchedule from './AgentSchedule';
import { ExpandableTabs } from '@/components/ui/expandable-tabs';
import LeadHistoryView from './LeadHistoryView';
import MySales from './MySales';
import AgentSettings from './AgentSettings';
import ChatNotificationBadge from '../chat/ChatNotificationBadge';
import ChatPanel from '../chat/ChatPanel';
import AgentTasks from './AgentTasks';

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
    const [activeTab, setActiveTab] = useState<'work' | 'history' | 'sales' | 'appointments' | 'settings'>('work');
    const [refreshKey, setRefreshKey] = useState(0);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [chatOpen, setChatOpen] = useState(false);
    const [managerId, setManagerId] = useState<string | null>(null);

    const [stats, setStats] = useState({ level: 1, rank: 'Çaylak' });
    const [manualLeadOpen, setManualLeadOpen] = useState(false);

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

        checkNotifications();

        // Celebration Listener
        const handleCelebration = (e: any) => {
            const { type } = e.detail;
            import('canvas-confetti').then(confetti => {
                if (type === 'level_up') {
                    // Epic Level Up Confetti
                    const duration = 5 * 1000;
                    const animationEnd = Date.now() + duration;
                    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

                    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

                    const interval: any = setInterval(function () {
                        const timeLeft = animationEnd - Date.now();

                        if (timeLeft <= 0) {
                            return clearInterval(interval);
                        }

                        const particleCount = 50 * (timeLeft / duration);
                        confetti.default({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
                        confetti.default({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
                    }, 250);
                } else {
                    // Standard Achievement Confetti
                    confetti.default({
                        particleCount: 150,
                        spread: 70,
                        origin: { y: 0.6 },
                        colors: ['#A855F7', '#EC4899', '#6366F1']
                    });
                }
            });
        };

        window.addEventListener('artific-celebration', handleCelebration);

        return () => {
            clearInterval(interval);
            window.removeEventListener('artific-celebration', handleCelebration);
        };
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

    const handleManualLeadSuccess = (leadId: string) => {
        // Switch to work tab if not already on it
        if (activeTab !== 'work') {
            setActiveTab('work');
        }

        // Save to localStorage so LeadCard loads this specific lead
        localStorage.setItem(`agent_${profile.id}_current_lead`, leadId);

        // Force refresh LeadCard
        setRefreshKey(prev => prev + 1);

        // Close dialog
        setManualLeadOpen(false);
    };

    return (
        <div className="min-h-screen pb-20 relative overflow-hidden isolate animate-fade-in">
            {/* Animated Background Grid */}
            <div className="fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(168,85,247,0.15)_0%,_transparent_50%)]" />
                <div className="absolute inset-0" style={{
                    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
                    backgroundSize: '50px 50px'
                }} />
            </div>
            {/* Header */}
            <header className="glass-nav sticky top-0 z-50">
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
                        </div>

                        {/* Global Mission HUD - Always visible if critical */}
                        <GlobalMissionTimer />

                        {/* Navigation Tabs - Integrated into header for easy access */}
                        <div className="hidden sm:block">
                            <ExpandableTabs
                                tabs={[
                                    { title: "Çağrı", icon: Phone },
                                    { title: "Randevular", icon: Calendar },
                                    { title: "Geçmiş", icon: List },
                                    { title: "Satışlarım", icon: DollarSign },
                                    { type: "separator" },
                                    { title: "Ayarlar", icon: Settings },
                                ]}
                                className="bg-black/20 border-white/5"
                                activeColor="text-purple-400 bg-purple-500/10"
                                defaultIndex={activeTab === 'work' ? 0 : activeTab === 'appointments' ? 1 : activeTab === 'history' ? 2 : activeTab === 'sales' ? 3 : 5}
                                onChange={(index) => {
                                    if (index === 0) setActiveTab('work');
                                    if (index === 1) setActiveTab('appointments');
                                    if (index === 2) setActiveTab('history');
                                    if (index === 3) setActiveTab('sales');
                                    if (index === 5) setActiveTab('settings');
                                }}
                            />
                        </div>

                        {/* Manual Lead Button */}
                        <button
                            onClick={() => setManualLeadOpen(true)}
                            className="hidden sm:flex items-center gap-2 px-4 py-2 btn-primary-gradient rounded-xl text-white text-sm font-semibold hover:scale-105 active:scale-95 transition-smooth"
                            title="Yeni Müşteri Ekle"
                        >
                            <UserPlus className="w-4 h-4" />
                            <span className="hidden lg:inline">Manuel Ekle</span>
                        </button>
                        {/* Mobile Fallback - Simplified */}
                        <nav className="flex sm:hidden items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/5">
                            <button
                                onClick={() => setActiveTab('work')}
                                className={`p-2 rounded-md transition-all ${activeTab === 'work' ? 'bg-purple-600 text-white' : 'text-gray-300'}`}
                            >
                                <Phone className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setActiveTab('appointments')}
                                className={`p-2 rounded-md transition-all ${activeTab === 'appointments' ? 'bg-purple-600 text-white' : 'text-gray-300'}`}
                            >
                                <Calendar className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setManualLeadOpen(true)}
                                className="p-2 rounded-md text-purple-400 hover:bg-white/5 transition-all active:scale-95"
                            >
                                <UserPlus className="w-5 h-5" />
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
            {
                notifications.slice(0, 3).map((notification, index) => (
                    <NotificationToast
                        key={notification.id}
                        notification={notification}
                        onClose={removeNotification}
                    />
                ))
            }

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
                            <div className="glass-card glass-card-hover p-6 relative">
                                <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} borderWidth={3} />
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

                {/* Appointments Tab [NEW] */}
                {activeTab === 'appointments' && (
                    <div className="animate-fade-in-up">
                        <AgentSchedule agentId={profile.id} />
                    </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && <LeadHistoryView />}

                {/* Sales Tab */}
                {activeTab === 'sales' && <MySales />}

                {/* Settings Tab */}
                {activeTab === 'settings' && <AgentSettings userProfile={profile} />}
            </main>

            {/* Floating Chat Button (Only show in Work tab) - Optimized for Mobile */}
            {
                (activeTab === 'work' || activeTab === 'history' || activeTab === 'appointments') && (
                    <button
                        onClick={() => setChatOpen(!chatOpen)}
                        className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white w-14 h-14 md:w-16 md:h-16 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center safe-bottom safe-right touch-target-large"
                        title="Open Chat"
                        aria-label="Open Chat"
                    >
                        <MessageCircle className="w-6 h-6 md:w-7 md:h-7" />
                        <ChatNotificationBadge userId={profile.id} />
                    </button>
                )
            }

            {/* Chat Panel - Defaulting to Team Chat (Broadcast) so agents can talk to each other */}

            <ChatPanel
                userId={profile.id}
                isOpen={chatOpen}
                onClose={() => setChatOpen(false)}
                title="Team Chat"
            />

            <ManualLeadDialog
                isOpen={manualLeadOpen}
                onClose={() => setManualLeadOpen(false)}
                onSuccess={handleManualLeadSuccess}
                agentId={profile.id}
            />
        </div >
    );
}
