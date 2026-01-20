
import { getReportMetrics, DateRange } from './metrics';
import { generatePDF } from '@/lib/pdf/generator';
import { sendEmail, generateDailyDigestHTML } from '@/lib/email/service';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function processReport(report: any) {
    const supabase = createServiceRoleClient();
    const startTime = Date.now();
    let status = 'processing';
    let executionId: string | null = null;
    let metricsData: any = null;

    try {
        // 1. Create Execution Log
        const { data: execution, error: execError } = await supabase
            .from('report_executions')
            .insert({
                scheduled_report_id: report.id,
                report_type: report.report_type,
                execution_status: 'processing'
            })
            .select('id')
            .single();

        if (execError) throw execError;
        executionId = execution.id;

        // 2. Calculate Metrics
        // Determine range based on report type
        let range: DateRange = 'today';
        if (report.report_type === 'weekly_performance') range = 'last_week';
        if (report.report_type === 'monthly_analytics') range = 'this_month';

        const timezone = report.schedule_config?.timezone || 'Europe/Istanbul';

        metricsData = await getReportMetrics(report.manager_id, range, timezone);

        if (!metricsData) {
            throw new Error('No data found for report generation');
        }

        // 3. Generate Content
        // PDF
        const pdfBuffer = await generatePDF(metricsData);
        // Email Body
        const emailHTML = generateDailyDigestHTML(metricsData);

        // 4. Send Email
        const recipients = report.recipients?.map((r: any) => r.email) || [];
        if (recipients.length === 0) {
            throw new Error('No recipients defined');
        }

        const emailResult = await sendEmail({
            to: recipients,
            subject: `📊 ${report.title || 'ArtificAgent Raporu'} - ${new Date().toLocaleDateString('tr-TR')}`,
            html: emailHTML,
            attachments: [{
                filename: `Rapor-${new Date().toISOString().split('T')[0]}.pdf`,
                content: pdfBuffer
            }]
        });

        if (!emailResult.success) {
            throw new Error('Email sending failed: ' + JSON.stringify(emailResult.error));
        }

        // 5. Update Execution Log (Success)
        await supabase
            .from('report_executions')
            .update({
                execution_status: 'success',
                recipients_count: recipients.length,
                completed_at: new Date().toISOString(),
                metrics_snapshot: metricsData.summary // Store light snapshot
            })
            .eq('id', executionId);

        return { success: true, executionId };

    } catch (error: any) {
        console.error(`Report ${report.id} failed:`, error);

        // Log Failure
        if (executionId) {
            await supabase
                .from('report_executions')
                .update({
                    execution_status: 'failed',
                    error_message: error.message,
                    completed_at: new Date().toISOString()
                })
                .eq('id', executionId);
        }

        return { success: false, error: error.message };
    }
}
