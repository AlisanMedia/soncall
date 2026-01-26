
import { Resend } from 'resend';

interface SendReportParams {
    to: string[];
    subject: string;
    html: string;
    attachments?: Array<{
        filename: string;
        content: Buffer; // PDF buffer
    }>;
}

function getResend() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        return null;
    }
    return new Resend(apiKey);
}

export async function sendEmail({ to, subject, html, attachments }: SendReportParams) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('⚠️ RESEND_API_KEY is missing. Email simulation mode.');
        console.log('--- EMAIL SIMULATION ---');
        console.log(`To: ${to.join(', ')}`);
        console.log(`Subject: ${subject}`);
        console.log('--- END SIMULATION ---');
        return { success: true, id: 'simulated_id' };
    }

    const resend = getResend();
    if (!resend) {
        console.warn('⚠️ RESEND_API_KEY is missing. Email simulation mode.');
        console.log('--- EMAIL SIMULATION ---');
        console.log(`To: ${to.join(', ')}`);
        console.log(`Subject: ${subject}`);
        console.log('--- END SIMULATION ---');
        return { success: true, id: 'simulated_id' };
    }

    try {
        const { data, error } = await resend.emails.send({
            // ÖNEMLİ: Domain doğrulaması yapılmadıysa SADECE 'onboarding@resend.dev' adresinden gönderim yapılabilir.
            // Domain eklerseniz burayı 'info@artificagent.com' yapabilirsiniz.
            from: process.env.REPORT_FROM_EMAIL || 'onboarding@resend.dev',
            to: to,
            replyTo: 'artificagent@gmail.com', // Kullanıcının istediği yanıt adresi
            subject: subject,
            html: html,
            attachments: attachments,
        });

        if (error) {
            console.error('Email send failed:', error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Email send exception:', error);
        return { success: false, error };
    }
}

export function generateDailyDigestHTML(data: any) {
    // Basic HTML template for the email body
    // In a real app, use @react-email/components
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: -apple-system, system-ui, sans-serif; color: #333; line-height: 1.5; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #6D28D9; color: white; padding: 20px; border-radius: 10px 10px 0 0; }
            .stats { display: flex; gap: 10px; margin: 20px 0; }
            .card { background: #f4f4f5; padding: 15px; border-radius: 8px; flex: 1; text-align: center; }
            .value { font-size: 24px; font-weight: bold; color: #6D28D9; }
            .label { font-size: 12px; text-transform: uppercase; color: #666; }
            .mvp { background: #fffbeb; border: 1px solid #fbbf24; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .footer { font-size: 12px; color: #666; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin:0; font-size: 20px;">ArtificAgent Günlük Rapor</h1>
                <p style="margin:5px 0 0 0; opacity: 0.9;">${new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            
            <div style="padding: 20px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;">
                <div class="stats">
                    <div class="card">
                        <div class="value">${data.summary.totalLeadsTotal}</div>
                        <div class="label">Lead İşlendi</div>
                    </div>
                    <div class="card">
                        <div class="value">${data.summary.appointments}</div>
                        <div class="label">Randevu</div>
                    </div>
                    <div class="card">
                        <div class="value">%${data.summary.conversionRate}</div>
                        <div class="label">Dönüşüm</div>
                    </div>
                </div>

                ${data.mvp ? `
                <div class="mvp">
                    <h3 style="margin-top:0;">🏆 Günün MVP'si</h3>
                    <p style="margin-bottom:0;">
                        <strong>${data.mvp.name}</strong> bugün <strong>${data.mvp.processed}</strong> lead işleyerek en yüksek skoru elde etti!
                    </p>
                </div>
                ` : ''}

                <h3>🔍 Öne Çıkanlar</h3>
                <ul>
                    ${data.highlights.map((h: string) => `<li>${h}</li>`).join('')}
                </ul>

                <p style="text-align: center; margin-top: 30px;">
                    <a href="https://artificagent.com/dashboard/reports" style="background: #6D28D9; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-weight: bold;">
                        Detaylı Raporu Görüntüle
                    </a>
                </p>
            </div>

            <div class="footer">
                <p>Bu rapor otomatik olarak oluşturulmuştur.</p>
                <p>Ekli PDF dosyasında detaylı analizleri bulabilirsiniz.</p>
            </div>
        </div>
    </body>
    </html>
    `;
}
