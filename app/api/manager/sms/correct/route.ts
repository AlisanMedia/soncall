
import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { createClient } from '@/lib/supabase/server';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { text, context } = body;

        if (!text) {
            return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
        }

        const prompt = `
        You are an expert executive communication assistant. 
        Your task is to rewrite the following draft SMS message to be grammatically correct, professional, and polite, while maintaining a friendly tone.
        The message is in Turkish.
        
        Rules:
        1. Correct any spelling or grammar mistakes.
        2. Ensure the tone is professional yet accessible (not overly formal, not street slang).
        3. Keep the meaning exactly the same, do not add new information unless implied by context.
        4. The output must be ONLY the rewritten message, no explanations or quotes.
        
        Draft Message: "${text}"
        Context: ${context || 'General business communication'}
        `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'gpt-4o',
            max_tokens: 150,
            temperature: 0.7,
        });

        const correctedMessage = completion.choices[0].message.content?.trim();

        return NextResponse.json({ message: correctedMessage });

    } catch (error: any) {
        console.error('AI Correction Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
