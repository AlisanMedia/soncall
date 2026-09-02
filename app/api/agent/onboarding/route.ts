import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_ACTIONS = new Set(['complete_step', 'complete', 'dismiss', 'reset']);

function sanitizeSteps(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 20);
}

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('sales_role')
            .eq('id', user.id)
            .maybeSingle();

        const { data, error } = await supabase
            .from('agent_onboarding_progress')
            .select('completed_steps, completed_at, dismissed_at, sales_role')
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) {
            return NextResponse.json({
                setupRequired: true,
                progress: null,
                salesRole: profile?.sales_role || 'sdr',
            });
        }

        return NextResponse.json({
            setupRequired: false,
            progress: data,
            salesRole: data?.sales_role || profile?.sales_role || 'sdr',
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Onboarding state failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const action = typeof body?.action === 'string' ? body.action : '';

        if (!VALID_ACTIONS.has(action)) {
            return NextResponse.json({ error: 'Invalid onboarding action' }, { status: 400 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('sales_role')
            .eq('id', user.id)
            .maybeSingle();

        const salesRole = profile?.sales_role || body?.salesRole || 'sdr';
        const incomingSteps = sanitizeSteps(body?.completedSteps);
        const stepId = typeof body?.stepId === 'string' ? body.stepId.trim() : '';

        const { data: current } = await supabase
            .from('agent_onboarding_progress')
            .select('completed_steps')
            .eq('user_id', user.id)
            .maybeSingle();

        const currentSteps = sanitizeSteps(current?.completed_steps);
        const completedSteps = action === 'complete_step' && stepId
            ? Array.from(new Set([...currentSteps, stepId]))
            : incomingSteps;

        const payload = {
            user_id: user.id,
            sales_role: salesRole,
            completed_steps: action === 'reset' ? [] : completedSteps,
            completed_at: action === 'complete' ? new Date().toISOString() : null,
            dismissed_at: action === 'dismiss' ? new Date().toISOString() : null,
        };

        const { data, error } = await supabase
            .from('agent_onboarding_progress')
            .upsert(payload, { onConflict: 'user_id' })
            .select('completed_steps, completed_at, dismissed_at, sales_role')
            .single();

        if (error) {
            return NextResponse.json({
                setupRequired: true,
                progress: null,
                message: error.message,
            });
        }

        return NextResponse.json({
            setupRequired: false,
            progress: data,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Onboarding update failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
