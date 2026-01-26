'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface Profile {
    id: string;
    full_name: string;
    role: string;
    avatar_url?: string;
}

interface MentionAutocompleteProps {
    searchQuery: string;
    onSelect: (user: Profile) => void;
    currentUserId: string;
}

export default function MentionAutocomplete({ searchQuery, onSelect, currentUserId }: MentionAutocompleteProps) {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const supabase = createClient();

    useEffect(() => {
        const fetchProfiles = async () => {
            // Fetch agents and managers
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, role, avatar_url')
                .in('role', ['agent', 'manager', 'admin', 'founder'])
                .neq('id', currentUserId); // Don't show self

            if (data) {
                setProfiles(data);
            }
            setLoading(false);
        };

        fetchProfiles();
    }, [currentUserId]);

    useEffect(() => {
        if (!profiles.length) return;

        const filtered = profiles.filter(profile =>
            profile.full_name.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 5); // Limit to 5 results

        setFilteredProfiles(filtered);
        setSelectedIndex(0); // Reset selection
    }, [searchQuery, profiles]);

    // Handle keyboard navigation from parent could be implemented here or passed down
    // For now, we rely on click

    if (loading || filteredProfiles.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute bottom-full left-0 mb-2 w-64 bg-[#1a1a2e] border border-white/20 rounded-xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl"
        >
            <div className="p-2 border-b border-white/10 text-xs font-semibold text-purple-300 uppercase tracking-wider">
                Bahsetmek İstediğiniz Kişi
            </div>
            <div className="max-h-60 overflow-y-auto">
                {filteredProfiles.map((profile, index) => (
                    <button
                        key={profile.id}
                        onClick={() => onSelect(profile)}
                        className={`w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-white/10 ${index === selectedIndex ? 'bg-white/5' : ''
                            }`}
                    >
                        <div className="relative">
                            {profile.avatar_url ? (
                                <img
                                    src={profile.avatar_url}
                                    alt={profile.full_name}
                                    className="w-8 h-8 rounded-full object-cover border border-purple-500/30"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold border border-purple-500/30">
                                    {profile.full_name.charAt(0)}
                                </div>
                            )}
                            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#1a1a2e] ${profile.role === 'manager' || profile.role === 'admin' || profile.role === 'founder'
                                ? 'bg-amber-500' // Gold/Amber for management
                                : 'bg-cyan-500' // Cyan for agents
                                }`} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-white">{profile.full_name}</div>
                            <div className="text-[10px] text-purple-300/70 uppercase font-semibold">
                                {profile.role === 'manager' || profile.role === 'founder' ? 'Yönetici' : 'Temsilci'}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </motion.div>
    );
}
