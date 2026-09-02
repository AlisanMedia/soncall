import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { createClient } from '@/lib/supabase/server';
import { buildAssistantContext, extractLeadCodeFromText } from '@/lib/assistant/context';
import { logAiUsage } from '@/lib/ai-usage';
import {
    getAssistantSpecialistPrompt,
    SONCALL_ASSISTANT_SYSTEM_PROMPT,
} from '@/lib/assistant/soncall-assistant-prompt';

export const dynamic = 'force-dynamic';

type AssistantMessage = {
    role: 'user' | 'assistant';
    content: string;
};

function sanitizeMessages(value: unknown): AssistantMessage[] {
    if (!Array.isArray(value)) return [];

    return value
        .filter((message): message is AssistantMessage => (
            Boolean(message)
            && (message.role === 'user' || message.role === 'assistant')
            && typeof message.content === 'string'
            && message.content.trim().length > 0
        ))
        .slice(-10)
        .map((message) => ({
            role: message.role,
            content: message.content.trim().slice(0, 2200),
        }));
}

function sanitizeLeadId(value: unknown) {
    return typeof value === 'string' && value.length > 0 && value.length < 80 ? value : null;
}

function sanitizeLeadCode(value: unknown) {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
    if (typeof value !== 'string') return null;

    const numeric = Number.parseInt(value.replace(/[^\d]/g, ''), 10);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export async function POST(request: NextRequest) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { error: 'OPENAI_API_KEY tanımlı değil. Chat yardımcı agent cevap üretemez.' },
                { status: 503 }
            );
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const messages = sanitizeMessages(body?.messages);
        const currentLeadId = sanitizeLeadId(body?.currentLeadId);
        const specialistPrompt = getAssistantSpecialistPrompt(body?.specialist);
        const lastUserMessage = [...messages].reverse().find(message => message.role === 'user')?.content || '';
        const requestedLeadCode = sanitizeLeadCode(body?.leadCode) ?? extractLeadCodeFromText(lastUserMessage);

        if (!lastUserMessage) {
            return NextResponse.json(
                { error: 'Mesaj bulunamadı.' },
                { status: 400 }
            );
        }

        const context = await buildAssistantContext(supabase, user.id, {
            currentLeadId,
            leadCode: requestedLeadCode,
            question: lastUserMessage,
        });

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completionMessages: ChatCompletionMessageParam[] = [
            { role: 'system', content: SONCALL_ASSISTANT_SYSTEM_PROMPT },
            { role: 'system', content: specialistPrompt },
            { role: 'system', content: `Canlı SonCall bağlamı:\n${context.contextText}` },
            ...messages.map((message): ChatCompletionMessageParam => ({
                role: message.role,
                content: message.content,
            })),
        ];

        const model = process.env.SONCALL_ASSISTANT_MODEL || 'gpt-4o-mini';
        const completion = await openai.chat.completions.create({
            model,
            temperature: 0.35,
            max_tokens: 900,
            messages: completionMessages,
        });

        const answer = completion.choices[0]?.message?.content?.trim()
            || 'Net bir cevap üretilemedi. Lead notlarını kontrol edip tekrar sor.';

        if (context.selectedLead?.id) {
            supabase
                .from('lead_activity_log')
                .insert({
                    lead_id: context.selectedLead.id,
                    agent_id: user.id,
                    action: 'assistant_help',
                    metadata: {
                        channel: 'chat',
                        specialist: body?.specialist || 'sdr_coach',
                        lead_code: context.selectedLead.lead_number || requestedLeadCode || null,
                        question: lastUserMessage.slice(0, 500),
                        selected_lead_source: context.selectedLeadSource,
                    },
                })
                .then(({ error }) => {
                    if (error) console.warn('Assistant help log failed:', error.message);
                });
        }

        await logAiUsage(supabase, {
            userId: user.id,
            leadId: context.selectedLead?.id || currentLeadId,
            marketId: context.profile?.market_id || null,
            feature: 'assistant_chat',
            model,
            inputTokens: completion.usage?.prompt_tokens || 0,
            outputTokens: completion.usage?.completion_tokens || 0,
            totalTokens: completion.usage?.total_tokens || 0,
            metadata: {
                specialist: body?.specialist || 'sdr_coach',
                selected_lead_source: context.selectedLeadSource,
                selected_lead_code: context.selectedLead?.lead_number || requestedLeadCode || null,
            },
        });

        return NextResponse.json({
            answer,
            context: {
                salesRole: context.profile?.sales_role || 'sdr',
                hasCurrentLead: Boolean(context.currentLead),
                selectedLeadCode: context.selectedLead?.lead_number || requestedLeadCode || null,
                selectedLeadSource: context.selectedLeadSource,
                remainingWorkCount: context.remainingWorkCount,
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Assistant chat failed';
        console.error('Assistant chat error:', error);

        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
