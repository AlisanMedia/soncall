'use client';

import { useState, useEffect } from 'react';
import { Profile } from '@/types';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import LeadCard from './LeadCard';
import Leaderboard from './Leaderboard';

interface AgentDashboardProps {
    profile: Profile;
}

export default function AgentDashboard({ profile }: AgentDashboardProps) {
    const [refreshKey, setRefreshKey] = useState(0);
    const supabase = createClient();
    const router = useRouter();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const handleLeadProcessed = () => {
        // Trigger refresh by incrementing key
        setRefreshKey(prev => prev + 1);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Header */}
            <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-white">ArtificAgent</h1>
                            <p className="text-sm text-purple-200">Agent Panel</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-sm text-purple-200">Hoş geldiniz,</p>
                                <p className="font-semibold text-white">{profile.full_name}</p>
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

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Leaderboard Sidebar */}
                    <div className="lg:col-span-1">
                        <Leaderboard agentId={profile.id} refreshKey={refreshKey} />
                    </div>

                    {/* Lead Card */}
                    <div className="lg:col-span-3">
                        <LeadCard
                            agentId={profile.id}
                            onLeadProcessed={handleLeadProcessed}
                            refreshKey={refreshKey}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}
