import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { generateManagerInsights } from '@/lib/insights';
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

        // Fetch analytics data using shared logic
        let analyticsData = null;
        try {
            analyticsData = await fetchManagerAnalytics(supabase);
        } catch (err) {
            console.error('Failed to fetch analytics for insights:', err);
        }

        // Generate insights using rule-based engine
        const insights = analyticsData ? generateManagerInsights(analyticsData) : [];

        return NextResponse.json({
            insights,
            generated_at: new Date().toISOString(),
        });

    } catch (error: any) {
        console.error('Insights error:', error);
        return NextResponse.json(
            { message: error.message || 'Failed to generate insights' },
            { status: 500 }
        );
    }
}
