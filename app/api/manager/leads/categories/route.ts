import { NextResponse } from 'next/server';
import { requireManagerAccess } from '@/lib/api/auth';
import { resolveRequestedMarketId } from '@/lib/market-access';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const auth = await requireManagerAccess();
        if (!auth.ok) return auth.response;
        const marketId = resolveRequestedMarketId(auth.profile, new URL(request.url).searchParams.get('marketId'));
        if (!marketId) return NextResponse.json({ error: 'Operasyon seçimi gerekli.' }, { status: 400 });

        const admin = createAdminClient();
        const categories = new Set<string>();
        const chunkSize = 1000;
        for (let from = 0; ; from += chunkSize) {
            const { data, error } = await admin.from('leads').select('category').eq('market_id', marketId)
                .range(from, from + chunkSize - 1);
            if (error) throw error;
            for (const lead of data || []) categories.add(lead.category?.trim() || 'Belirsiz');
            if (!data || data.length < chunkSize) break;
        }
        return NextResponse.json({ categories: [...categories].sort((a, b) => a.localeCompare(b, 'tr')) });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Sektörler yüklenemedi';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
