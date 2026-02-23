/**
 * Client-Safe Gamification Utilities
 * This file can be safely imported in client components
 * DOES NOT include any Supabase admin functionality
 */

/**
 * Shared Type for Rank Information
 */
export interface RankInfo {
    title: string;
    icon: 'Sprout' | 'Swords' | 'Flame' | 'Gem' | 'Crown';
    color: string;
    bgGlow: string;
    border: string;
}

/**
 * Centralized Logic for Rank Titles and Visuals
 * Based on Level (XP/1000)
 */
export const getRankInfo = (lvl: number): RankInfo => {
    if (lvl < 10) return {
        title: 'Çaylak (Rookie)',
        icon: 'Sprout',
        color: 'from-green-500 to-emerald-700',
        bgGlow: 'bg-green-500/20',
        border: 'border-green-500/30'
    };
    if (lvl < 25) return {
        title: 'Avcı (Hunter)',
        icon: 'Swords',
        color: 'from-slate-400 to-slate-600',
        bgGlow: 'bg-slate-500/20',
        border: 'border-slate-500/30'
    };
    if (lvl < 50) return {
        title: 'Usta (Veteran)',
        icon: 'Flame',
        color: 'from-orange-500 to-red-600',
        bgGlow: 'bg-orange-500/20',
        border: 'border-orange-500/30'
    };
    if (lvl < 100) return {
        title: 'Elit (Elite)',
        icon: 'Gem',
        color: 'from-cyan-500 to-blue-600',
        bgGlow: 'bg-cyan-500/20',
        border: 'border-cyan-500/30'
    };
    return {
        title: 'Efsane (Legend)',
        icon: 'Crown',
        color: 'from-fuchsia-600 to-purple-800',
        bgGlow: 'bg-purple-500/20',
        border: 'border-purple-500/30'
    };
};

/**
 * Triggers a global celebration event (confetti, sounds, etc)
 */
export const triggerCelebration = (type: 'level_up' | 'achievement' = 'level_up') => {
    if (typeof window !== 'undefined') {
        const event = new CustomEvent('artific-celebration', { detail: { type } });
        window.dispatchEvent(event);
    }
};
