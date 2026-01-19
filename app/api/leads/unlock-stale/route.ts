import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
    try {
        const supabase = await createClient();

        // Unlock leads that have been locked for more than 10 minutes
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

        const { error } = await supabase
            .from('leads')
            .update({
                current_agent_id: null,
                locked_at: null,
            })
            .not('current_agent_id', 'is', null)
            .lt('locked_at', tenMinutesAgo);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Unlock error:', error);
        return NextResponse.json(
            { success: false, message: error.message },
            { status: 500 }
        );
    }
}
