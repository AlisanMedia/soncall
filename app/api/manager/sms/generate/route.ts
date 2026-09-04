
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { logAiUsage } from '@/lib/ai-usage';


export async function POST(request: NextRequest) {
    try {
        // 1. Authentication & Authorization
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ error: 'AI service is not configured' }, { status: 503 });
        }
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const { data: profile } = await supabase
            .from('profiles')
            .select('role, market_id')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Parse Request
        const { agentName, context } = await request.json();

        if (!agentName) {
            return NextResponse.json({ error: 'Agent name is required' }, { status: 400 });
        }

        // 3. call AI
        const systemPrompt = `
            Sen profesyonel, motive edici ve arkadaş canlısı bir çağrı merkezi takımı liderisin.
            Görevin, takımdaki bir personele (${agentName}) göndermek üzere kısa, etkili ve motive edici bir SMS mesajı oluşturmak.
            Mesaj 160 karakteri geçmemeli (SMS sınırı).
            Türkçe karakterler kullanabilirsin ama kısa ve net ol.
            
            Bağlam: ${context || 'Genel motivasyon mesajı'}
            
            Sadece mesaj metnini döndür, başka hiçbir şey yazma.
        `;

        const model = process.env.OPENAI_SMS_MODEL || 'gpt-4o-mini';
        const completion = await openai.chat.completions.create({
            model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Lütfen ${agentName} için bir mesaj oluştur.` }
            ],
            max_tokens: 100,
        });

        const message = completion.choices[0].message.content?.trim();

        await logAiUsage(supabase, {
            userId: user.id,
            marketId: profile?.market_id || null,
            feature: 'sms_generate',
            model,
            inputTokens: completion.usage?.prompt_tokens || 0,
            outputTokens: completion.usage?.completion_tokens || 0,
            totalTokens: completion.usage?.total_tokens || 0,
            metadata: { agent_name: agentName },
        });

        return NextResponse.json({ message });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'SMS generation failed';
        console.error('Error generating SMS:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
