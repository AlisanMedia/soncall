'use client';

import { useState, useEffect } from 'react';
import { Profile } from '@/types';
import { LogOut, MessageCircle, Settings, Phone, Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import LeadCard from './LeadCard';
import Leaderboard from './Leaderboard';
import NotificationToast from './NotificationToast';
import GamificationBar from './GamificationBar';
import AchievementsGrid from './AchievementsGrid';
import ChatPanel from '../chat/ChatPanel';
import ChatNotificationBadge from '../chat/ChatNotificationBadge';
import AgentSettings from './AgentSettings';

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
    const [activeTab, setActiveTab] = useState<'work' | 'settings'>('work');
    const [refreshKey, setRefreshKey] = useState(0);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [chatOpen, setChatOpen] = useState(false);
    const [managerId, setManagerId] = useState<string | null>(null);
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        // Fetch fresh profile data including new fields
        const getProfile = async () => {
            const { data } = await supabase.from('profiles').select('*').eq('id', initialProfile.id).single();
            if (data) setProfile(data);
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

                if (response.ok && data.notifications && data.notifications.length > 0) {
                    setNotifications(prev => {
                        const newNotifs = data.notifications.filter(
                            (n: Notification) => !prev.some(p => p.id === n.id)
                        );
                        return [...prev, ...newNotifs];
                    });
                }
            } catch (err) {
                console.error('Notification check error:', err);
            }
        };

        const interval = setInterval(checkNotifications, 15000); // Check every 15s
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
                if (data.notifications && data.notifications.length > 0) {
                    setNotifications(prev => {
                        const newNotifs = data.notifications.filter(
                            (n: Notification) => !prev.some(p => p.id === n.id)
                        );
                        return [...prev, ...newNotifs];
                    });
                }
            })
            .catch(err => console.error('Immediate notification check error:', err));
    };

    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 pb-20">
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
                            <nav className="flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/5">
                                <button
                                    onClick={() => setActiveTab('work')}
                                    className={`p-2 sm:px-4 sm:py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'work'
                                        ? 'bg-purple-600 text-white shadow-lg'
                                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                                        }`}
                                    title="Çağrı Paneli"
                                >
                                    <Phone className="w-5 h-5 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">Çağrı</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('settings')}
                                    className={`p-2 sm:px-4 sm:py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'settings'
                                        ? 'bg-purple-600 text-white shadow-lg'
                                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                                        }`}
                                    title="Ayarlar"
                                >
                                    <Settings className="w-5 h-5 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">Ayarlar</span>
                                </button>
                            </nav>
                        </div>

                        {/* User Profile Info */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="flex items-center gap-3 text-right">
                                <div className="hidden md:block">
                                    <p className="text-xs text-purple-200">Hoş geldiniz,</p>
                                    <p className="font-semibold text-white text-sm truncate max-w-[150px]">{profile.nickname || profile.full_name}</p>
                                </div>
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-purple-500/20 border border-purple-500/50 overflow-hidden">
                                    <img
                                        src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.email}`}
                                        alt="Avatar"
                                        className="w-full h-full object-cover"
                                    />
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
                {activeTab === 'work' ? (
                    <div className="space-y-6">
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

                                {/* Achievements Section */}
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <Trophy className="w-5 h-5 text-yellow-500" />
                                        Başarım Koleksiyonu
                                    </h3>
                                    <AchievementsGrid agentId={profile.id} />
                                </div>
                            </div>

                            {/* Leaderboard Sidebar */}
                            <div className="lg:col-span-1 order-2 lg:order-1">
                                <Leaderboard agentId={profile.id} refreshKey={refreshKey} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <AgentSettings userProfile={profile} />
                )}
            </main>

            {/* Floating Chat Button (Only show in Work tab) */}
            {activeTab === 'work' && (
                <button
                    onClick={() => setChatOpen(!chatOpen)}
                    className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95"
                    title="Open Chat"
                >
                    <MessageCircle className="w-6 h-6" />
                    <ChatNotificationBadge userId={profile.id} />
                </button>
            )}

            {/* Chat Panel */}
            <ChatPanel
                userId={profile.id}
                isOpen={chatOpen}
                onClose={() => setChatOpen(false)}
                receiverId={managerId || undefined}
                title={managerId ? "Chat with Manager" : "Team Chat"}
            />
        </div>
    );
}
