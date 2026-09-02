import { createAdminClient } from '@/lib/supabase/admin';

export const GLOBAL_ROLES = new Set(['admin', 'founder']);
export const MANAGER_ROLES = new Set(['manager', 'admin', 'founder']);

export type MarketProfile = {
    id: string;
    role: string | null;
    full_name?: string | null;
    email?: string | null;
    sales_role?: 'sdr' | 'closer' | null;
    market_id?: string | null;
};

export function isGlobalRole(role?: string | null) {
    return GLOBAL_ROLES.has(role || '');
}

export function canManageMarket(role?: string | null) {
    return MANAGER_ROLES.has(role || '');
}

export async function getAdminProfile(userId: string) {
    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
        .from('profiles')
        .select('id, role, full_name, email, sales_role, market_id')
        .eq('id', userId)
        .maybeSingle();

    if (error) throw error;
    return { profile: data as MarketProfile | null, adminSupabase };
}

export function canAccessMarket(profile: MarketProfile | null, marketId?: string | null) {
    if (!profile) return false;
    if (isGlobalRole(profile.role)) return true;
    return Boolean(profile.market_id && marketId && profile.market_id === marketId);
}

export function resolveRequestedMarketId(profile: MarketProfile | null, requestedMarketId?: string | null) {
    if (!profile) return null;
    if (isGlobalRole(profile.role)) return requestedMarketId || profile.market_id || null;
    return profile.market_id || null;
}
