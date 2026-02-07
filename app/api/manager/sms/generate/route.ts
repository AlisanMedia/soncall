
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js'; // For type if needed, but here just import the function
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Lütfen ${agentName} için bir mesaj oluştur.` }
            ],
            max_tokens: 100,
        });

        const message = completion.choices[0].message.content?.trim();

        return NextResponse.json({ message });

    } catch (error: any) {
        console.error('Error generating SMS:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
