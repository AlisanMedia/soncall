import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { fetchManagerAnalytics } from '@/lib/analytics';

export async function GET() {
    try {
        const supabase = await createClient();

        // Verify authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Verify manager role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        // Fetch analytics using shared logic
        const analyticsData = await fetchManagerAnalytics(supabase);

        return NextResponse.json(analyticsData);

    } catch (error: any) {
        console.error('Analytics error:', error);
        return NextResponse.json(
            { message: error.message || 'Failed to fetch analytics' },
            { status: 500 }
        );
    }
}
