
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { processReport } from '@/lib/reports/processor';

// Manual trigger for testing a specific report
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { reportId } = body;

        if (!reportId) {
            return NextResponse.json({ message: 'Report ID required' }, { status: 400 });
        }

        const supabase = createServiceRoleClient();

        const { data: report, error } = await supabase
            .from('scheduled_reports')
            .select('*')
            .eq('id', reportId)
            .single();

        if (error || !report) {
            return NextResponse.json({ message: 'Report not found' }, { status: 404 });
        }

        const result = await processReport(report);

        return NextResponse.json(result);

    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
