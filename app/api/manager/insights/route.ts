import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { generateManagerInsights } from '@/lib/insights';

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

        if (profile?.role !== 'manager') {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        }

        // Fetch analytics data (reuse existing endpoint logic)
        const analyticsResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/manager/analytics`, {
            headers: {
                cookie: `sb-access-token=${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
        });

        let analyticsData = null;
        if (analyticsResponse.ok) {
            analyticsData = await analyticsResponse.json();
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
