type AiUsageClient = {
    from: (table: string) => {
        insert: (payload: Record<string, unknown>) => unknown;
    };
};

export type AiUsageFeature =
    | 'assistant_chat'
    | 'call_transcription'
    | 'call_analysis'
    | 'sms_generate'
    | 'sms_correct'
    | 'lead_enrich';

type Price = {
    inputPer1M?: number;
    outputPer1M?: number;
    audioPerMinute?: number;
};

const MODEL_PRICING_USD: Record<string, Price> = {
    'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
    'gpt-4o': { inputPer1M: 2.50, outputPer1M: 10.00 },
    'gpt-5-nano': { inputPer1M: 0.05, outputPer1M: 0.40 },
    'gpt-5-mini': { inputPer1M: 0.25, outputPer1M: 2.00 },
    'gpt-4o-mini-transcribe': { audioPerMinute: 0.003 },
    'gpt-4o-transcribe': { audioPerMinute: 0.006 },
    'whisper-1': { audioPerMinute: 0.006 },
};

export function estimateAiCostUsd({
    model,
    inputTokens = 0,
    outputTokens = 0,
    audioSeconds = 0,
}: {
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    audioSeconds?: number;
}) {
    const pricing = MODEL_PRICING_USD[model] || MODEL_PRICING_USD['gpt-4o-mini'];
    const tokenCost =
        ((inputTokens / 1_000_000) * (pricing.inputPer1M || 0)) +
        ((outputTokens / 1_000_000) * (pricing.outputPer1M || 0));
    const audioCost = audioSeconds > 0
        ? (Math.max(audioSeconds, 1) / 60) * (pricing.audioPerMinute || 0)
        : 0;

    return Number((tokenCost + audioCost).toFixed(6));
}

export async function logAiUsage(
    supabase: AiUsageClient,
    payload: {
        userId: string;
        leadId?: string | null;
        feature: AiUsageFeature;
        model: string;
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        audioSeconds?: number;
        estimatedCostUsd?: number;
        status?: 'success' | 'failed';
        metadata?: Record<string, unknown>;
        marketId?: string | null;
    }
) {
    const inputTokens = payload.inputTokens || 0;
    const outputTokens = payload.outputTokens || 0;
    const audioSeconds = payload.audioSeconds || 0;
    const estimatedCostUsd = payload.estimatedCostUsd ?? estimateAiCostUsd({
        model: payload.model,
        inputTokens,
        outputTokens,
        audioSeconds,
    });

    const result = await supabase.from('ai_usage_logs').insert({
        user_id: payload.userId,
        lead_id: payload.leadId || null,
        feature: payload.feature,
        model: payload.model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: payload.totalTokens ?? inputTokens + outputTokens,
        audio_seconds: audioSeconds,
        estimated_cost_usd: estimatedCostUsd,
        status: payload.status || 'success',
        metadata: payload.metadata || {},
        market_id: payload.marketId || null,
    });
    const error = (result as { error?: { message?: string; code?: string } | null }).error;

    if (error) {
        console.warn('AI usage log skipped:', error.message || error.code || 'unknown error');
    }
}
