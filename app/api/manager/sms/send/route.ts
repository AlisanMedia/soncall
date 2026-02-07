
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendSMS } from '@/lib/sms';

export async function POST(request: NextRequest) {
    try {
        // 1. Authentication & Authorization
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Parse Request
        // Support both single 'phone' and multiple 'recipients' (array of { phone, name })
        const body = await request.json();
        const { message } = body;

        // Normalize recipients
        let recipients: (string | { phone: string, name: string })[] = [];

        if (body.recipients && Array.isArray(body.recipients)) {
            recipients = body.recipients;
        } else if (body.phone) {
            recipients = [body.phone];
        }

        if (recipients.length === 0 || !message) {
            return NextResponse.json({ error: 'Recipients and message are required' }, { status: 400 });
        }

        // 3. Send SMS Loop
        console.log(`[Bulk SMS] Starting send to ${recipients.length} recipients`);

        let successCount = 0;
        let failCount = 0;

        // Process in parallel but with some limit to avoid overwhelming provider if needed
        // For now, simple Promise.all is likely fine for small teams (<100)
        const results = await Promise.all(recipients.map(async (recipient) => {
            let phone = '';
            let name: string | undefined = undefined;

            if (typeof recipient === 'string') {
                phone = recipient;
            } else {
                phone = recipient.phone;
                name = recipient.name;
            }

            try {
                const success = await sendSMS(phone, message, name);
                return success;
            } catch (e) {
                console.error(`Failed to send to ${phone}`, e);
                return false;
            }
        }));

        successCount = results.filter(r => r === true).length;
        failCount = results.filter(r => r === false).length;

        console.log(`[Bulk SMS] Complete. Success: ${successCount}, Failed: ${failCount}`);

        return NextResponse.json({
            success: true,
            stats: {
                total: recipients.length,
                sent: successCount,
                failed: failCount
            }
        });

    } catch (error: any) {
        console.error('Error sending SMS:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
