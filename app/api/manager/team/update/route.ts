import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { canAccessMarket, isGlobalRole } from '@/lib/market-access';

const ROLE_RANK = {
    agent: 1,
    manager: 2,
    admin: 3,
    founder: 4,
} as const;

type ManagedRole = keyof typeof ROLE_RANK;
type SalesRole = 'sdr' | 'closer';

function isManagedRole(role: string): role is ManagedRole {
    return role in ROLE_RANK;
}

function isSalesRole(role: string): role is SalesRole {
    return role === 'sdr' || role === 'closer';
}

export async function PUT(req: Request) {
    try {
        const supabase = await createClient();

        // Check authorization
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase.from('profiles').select('id, role, market_id').eq('id', user.id).single();
        if (!['manager', 'admin', 'founder'].includes(profile?.role)) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        const body = await req.json();
        const { id, fullName, tcNumber, birthDate, city, district, phoneNumber, role, salesRole, commissionRate, marketId } = body;
        const requestedRole = role || 'agent';
        const requestedSalesRole = salesRole || 'sdr';

        if (!id) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        if (!isManagedRole(requestedRole)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        if (!isSalesRole(requestedSalesRole)) {
            return NextResponse.json({ error: 'Invalid sales role' }, { status: 400 });
        }

        const requesterRole = profile?.role as ManagedRole;

        const { data: targetProfile, error: targetError } = await supabase
            .from('profiles')
            .select('role, market_id')
            .eq('id', id)
            .maybeSingle();

        if (targetError) throw targetError;
        if (!targetProfile || !isManagedRole(targetProfile.role || '')) {
            return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
        }

        const targetRole = targetProfile.role as ManagedRole;

        if (
            (requesterRole === 'manager' && (targetRole !== 'agent' || requestedRole !== 'agent')) ||
            (requesterRole !== 'founder' && targetRole === 'founder') ||
            ROLE_RANK[requestedRole] > ROLE_RANK[requesterRole] ||
            (id === user.id && requestedRole !== requesterRole) ||
            !canAccessMarket(profile, targetProfile.market_id)
        ) {
            return NextResponse.json({ error: 'Forbidden: Cannot update users with that role' }, { status: 403 });
        }

        const targetMarketId = isGlobalRole(profile?.role)
            ? (marketId || targetProfile.market_id)
            : targetProfile.market_id;

        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: fullName,
                tc_number: tcNumber,
                birth_date: birthDate,
                city,
                district,
                phone_number: phoneNumber,
                commission_rate: commissionRate,
                role: requestedRole,
                sales_role: requestedRole === 'agent' ? requestedSalesRole : 'sdr',
                market_id: targetMarketId
            })
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Team member update failed';
        console.error('Error updating member:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
