
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { processReport } from '@/lib/reports/processor';

export const dynamic = 'force-dynamic'; // Prevent caching
export const maxDuration = 300; // Allow 5 minutes processing time

export async function GET(request: NextRequest) {
    // Vercel Cron authentication (optional but recommended)
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //     return new Response('Unauthorized', { status: 401 });
    // }

    try {
        const supabase = createServiceRoleClient();

        // 1. Fetch active daily digest reports
        const { data: reports, error } = await supabase
            .from('scheduled_reports')
            .select('*')
            .eq('report_type', 'daily_digest')
            .eq('is_active', true);

        if (error) throw error;

        if (!reports || reports.length === 0) {
            return NextResponse.json({ message: 'No active reports to process' });
        }

        // 2. Process each report
        const results = await Promise.all(reports.map(report => processReport(report)));

        // 3. Update last_sent_at for successful reports
        const successIds = results
            .filter(r => r.success && r.executionId)
            .map((r, i) => reports[i].id); // This mapping depends on order preservation

        if (successIds.length > 0) {
            await supabase
                .from('scheduled_reports')
                .update({ last_sent_at: new Date().toISOString() })
                .in('id', successIds);
        }

        return NextResponse.json({
            success: true,
            processed: reports.length,
            results
        });

    } catch (error: any) {
        console.error('Cron job failed:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
