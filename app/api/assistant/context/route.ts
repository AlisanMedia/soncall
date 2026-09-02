import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildAssistantContext, extractLeadCodeFromText } from '@/lib/assistant/context';

export const dynamic = 'force-dynamic';

function sanitizeLeadId(value: string | null) {
    return value && value.length < 80 ? value : null;
}

function sanitizeLeadCode(value: string | null) {
    if (!value) return null;

    const numeric = Number.parseInt(value.replace(/[^\d]/g, ''), 10);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const leadId = sanitizeLeadId(request.nextUrl.searchParams.get('leadId'));
        const question = request.nextUrl.searchParams.get('question');
        const leadCode = sanitizeLeadCode(request.nextUrl.searchParams.get('leadCode'))
            ?? extractLeadCodeFromText(question || '');

        const context = await buildAssistantContext(supabase, user.id, {
            currentLeadId: leadId,
            leadCode,
            question,
        });

        return NextResponse.json({
            contextText: context.contextText,
            dynamicVariables: {
                user_name: context.profile?.full_name || 'Agent',
                sales_role: context.profile?.sales_role || 'sdr',
                soncall_context: context.contextText.slice(0, 4500),
                selected_lead_code: context.selectedLead?.lead_number || leadCode || '',
                selected_lead_source: context.selectedLeadSource,
            },
            selectedLeadCode: context.selectedLead?.lead_number || leadCode || null,
            selectedLeadSource: context.selectedLeadSource,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Assistant context failed';
        console.error('Assistant context error:', error);

        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
