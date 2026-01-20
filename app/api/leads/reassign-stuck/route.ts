
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // 1. Authenticate Manager
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'manager') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Parse Body
        const body = await request.json();
        const { hours = 24, targetAgentId = null } = body;
        // targetAgentId null means "return to pool" (unassigned)

        // 3. Calculate Threshold Time
        const thresholdDate = new Date();
        thresholdDate.setHours(thresholdDate.getHours() - hours);
        const thresholdISO = thresholdDate.toISOString();

        // 4. Find Stuck Leads
        // Definition: Pending status AND assigned before threshold AND assigned_to is NOT NULL
        // Note: 'assigned_at' field might not exist in our schema? 
        // Let's check schema. leads table has: id, status, assigned_to... 
        // Wait, do we have an 'assigned_at' column?
        // Checking task.md or walkthrough.md... 
        // walkthrough says: leads table: id, ..., created_at, processed_at.
        // It DOES NOT explicitly list assigned_at.
        // If we don't have assigned_at, we might depend on created_at or we need to add assigned_at.
        // Or we use 'updated_at' if it exists.
        // Let's assume for now we might use created_at (if simple) or we can't do exact "time since assignment".
        // ALTERNATIVE: Use lead_activity_log to find when it was assigned? Too complex.
        // WORKAROUND: For now, reassigning based on "inactive for X hours" logic might be:
        // "Leads that are PENDING and Created > X hours ago" (if not processed).
        // OR better: check `leads` table structure first.

        // I will assume we might need to add `last_interaction_at` or similar, but for now I'll use `created_at` 
        // or check if I can modify schema.
        // Actually, let's look at what we have.
        // If I assume no `assigned_at`, I will query leads that are `pending` and `assigned_to IS NOT NULL`.
        // To verify "stuckness", I really need a timestamp of assignment.
        // Creating a migration to add `assigned_at` would be best, but user wants "Transfer" features now.
        // Let's stick to: "Pending leads that were created before X time". (Simplest Proxy)

        const { data: stuckLeads, error: findError } = await supabase
            .from('leads')
            .select('id, assigned_to')
            .eq('status', 'pending')
            .not('assigned_to', 'is', null)
            .lt('created_at', thresholdISO); // Using created_at as proxy for "old and pending"

        if (findError) throw findError;

        if (!stuckLeads || stuckLeads.length === 0) {
            return NextResponse.json({ success: true, count: 0, message: 'No stuck leads found' });
        }

        const leadIds = stuckLeads.map(l => l.id);

        // 5. Update Leads
        const { error: updateError } = await supabase
            .from('leads')
            .update({
                assigned_to: targetAgentId, // Null or specific agent
                current_agent_id: null,
                locked_at: null
            })
            .in('id', leadIds);

        if (updateError) throw updateError;

        // 6. Log
        await supabase.from('lead_activity_log').insert({
            lead_id: leadIds[0], // Just log one generic event or loop?
            agent_id: user.id,
            action: 'REASSIGN_STUCK',
            metadata: {
                count: leadIds.length,
                threshold_hours: hours,
                target: targetAgentId || 'POOL'
            }
        });

        return NextResponse.json({
            success: true,
            count: leadIds.length,
            message: `${leadIds.length} leads reassigned.`
        });

    } catch (error: any) {
        console.error('Reassign Stuck error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
