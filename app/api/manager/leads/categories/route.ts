import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = await createClient();

        // Check auth
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Fetch categories
        // Optimization: We fetch just the category column. 
        // Since Supabase JS client doesn't support .distinct() directly on simple selects easily without RPC,
        // we fetch all (or a large limit) and dedup in memory. 
        // For < 50k leads this is fine.
        const { data, error } = await supabase
            .from('leads')
            .select('category')
            .order('created_at', { ascending: false })
            .limit(5000); // Analyze last 5000 leads

        if (error) throw error;

        // Dedup and normalize
        const uniqueCategories = new Set<string>();
        data?.forEach(l => {
            if (l.category && l.category.trim() !== '') {
                uniqueCategories.add(l.category);
            } else {
                uniqueCategories.add('Belirsiz');
            }
        });

        const categories = Array.from(uniqueCategories).sort();

        return NextResponse.json({ categories });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
