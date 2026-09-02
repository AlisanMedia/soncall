'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
    BarChart3,
    Bot,
    Brain,
    BriefcaseBusiness,
    CheckCircle2,
    Hash,
    Loader2,
    Send,
    ShieldCheck,
    Sparkles,
    Target,
    X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Profile } from '@/types';

type ChatMessage = {
    role: 'user' | 'assistant';
    content: string;
};

type AssistantPanelProps = {
    profile: Profile;
};

type AssistantSpecialistId =
    | 'sdr_coach'
    | 'closer_strategist'
    | 'objection_coach'
    | 'lead_analyst'
    | 'quality_coach';

type AssistantSpecialist = {
    id: AssistantSpecialistId;
    label: string;
    title: string;
    description: string;
    icon: LucideIcon;
    prompts: string[];
};

const specialists: AssistantSpecialist[] = [
    {
        id: 'sdr_coach',
        label: 'SDR',
        title: 'SDR Operasyon Koçu',
        description: 'Soğuk arama, ihtiyaç çıkarma ve toplantıya çekme.',
        icon: Target,
        prompts: [
            'Bu lead için açılış cümlesi hazırla',
            'Toplantıya çekmek için en iyi CTA nedir?',
            '#0001 için SDR sonraki adımı söyle',
        ],
    },
    {
        id: 'closer_strategist',
        label: 'Closer',
        title: 'Closer Toplantı Stratejisti',
        description: 'Google Meet akışı, karar süreci ve kapanış planı.',
        icon: BriefcaseBusiness,
        prompts: [
            'Closer için toplantı notunu düzenle',
            'Bu müşteride kapanış riski ne?',
            '#0001 için toplantı stratejisi çıkar',
        ],
    },
    {
        id: 'objection_coach',
        label: 'İtiraz',
        title: 'İtiraz ve Fiyat Koçu',
        description: 'Fiyat, yetki, zamanlama ve güven itirazları.',
        icon: Brain,
        prompts: [
            'Fiyat itirazına cevap hazırla',
            'Patron yok itirazına nasıl döneyim?',
            'Şu an müsait değiliz diyen lead için script yaz',
        ],
    },
    {
        id: 'lead_analyst',
        label: 'Analiz',
        title: 'Lead İstihbarat Analisti',
        description: 'Lead geçmişi, potansiyel, not ve risk okuma.',
        icon: BarChart3,
        prompts: [
            '#0001 geçmişini kontrol et',
            'Bu lead daha önce işlenmiş mi?',
            'Lead notlarından aksiyon planı çıkar',
        ],
    },
    {
        id: 'quality_coach',
        label: 'Kalite',
        title: 'Kalite ve CRM Koçu',
        description: 'Not kalitesi, CRM disiplini ve operasyon hijyeni.',
        icon: ShieldCheck,
        prompts: [
            'Bu görüşme notunu kurumsal hale getir',
            'Eksik CRM bilgileri neler?',
            'Manager raporu için kısa özet yaz',
        ],
    },
];

function getCurrentLeadId(agentId: string) {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(`agent_${agentId}_current_lead`);
}

function extractLeadCodeFromTextClient(text: string) {
    const match = text.match(/(?:^|\s)#\s*(?:SC-?)?(\d{1,10})\b/i)
        || text.match(/\bSC-?(\d{1,10})\b/i);

    if (!match?.[1]) return null;

    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getWelcomeMessage(profile: Profile, specialist: AssistantSpecialist): ChatMessage {
    const roleLabel = profile.sales_role === 'closer' ? 'Closer' : 'SDR';

    return {
        role: 'assistant',
        content: `Hazırım. Şu an **${specialist.title}** modundayım ve seni **${roleLabel}** bağlamına göre yönlendireceğim. Lead koduyla sormak için örnek: **#0012 için geçmişi kontrol et.**`,
    };
}

function renderInlineMarkdown(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="font-bold text-white">{part.slice(2, -2)}</strong>;
        }

        if (part.startsWith('`') && part.endsWith('`')) {
            return (
                <code key={index} className="rounded bg-black/30 px-1.5 py-0.5 text-[0.9em] text-cyan-100">
                    {part.slice(1, -1)}
                </code>
            );
        }

        return <Fragment key={index}>{part}</Fragment>;
    });
}

function renderMessageContent(content: string): ReactNode {
    const lines = content.split('\n');
    const blocks: ReactNode[] = [];
    let listItems: string[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const flushList = () => {
        if (!listType || listItems.length === 0) return;

        const children = listItems.map((item, index) => (
            <li key={index}>{renderInlineMarkdown(item)}</li>
        ));

        blocks.push(listType === 'ol'
            ? <ol key={`ol-${blocks.length}`} className="ml-4 list-decimal space-y-1">{children}</ol>
            : <ul key={`ul-${blocks.length}`} className="ml-4 list-disc space-y-1">{children}</ul>);

        listItems = [];
        listType = null;
    };

    lines.forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line) {
            flushList();
            return;
        }

        const heading = line.match(/^#{1,3}\s+(.+)$/);
        if (heading?.[1]) {
            flushList();
            blocks.push(
                <p key={`h-${blocks.length}`} className="text-sm font-bold text-white">
                    {renderInlineMarkdown(heading[1])}
                </p>
            );
            return;
        }

        const unordered = line.match(/^[-*]\s+(.+)$/);
        if (unordered?.[1]) {
            if (listType !== 'ul') flushList();
            listType = 'ul';
            listItems.push(unordered[1]);
            return;
        }

        const ordered = line.match(/^\d+\.\s+(.+)$/);
        if (ordered?.[1]) {
            if (listType !== 'ol') flushList();
            listType = 'ol';
            listItems.push(ordered[1]);
            return;
        }

        flushList();
        blocks.push(
            <p key={`p-${blocks.length}`}>
                {renderInlineMarkdown(line)}
            </p>
        );
    });

    flushList();

    return <div className="space-y-2">{blocks}</div>;
}

export default function SoncallAssistant({ profile }: AssistantPanelProps) {
    const [open, setOpen] = useState(false);
    const [selectedSpecialistId, setSelectedSpecialistId] = useState<AssistantSpecialistId>(
        profile.sales_role === 'closer' ? 'closer_strategist' : 'sdr_coach'
    );
    const selectedSpecialist = useMemo(
        () => specialists.find(item => item.id === selectedSpecialistId) || specialists[0],
        [selectedSpecialistId]
    );
    const [messages, setMessages] = useState<ChatMessage[]>(() => [getWelcomeMessage(profile, selectedSpecialist)]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const ActiveIcon = selectedSpecialist.icon;

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, open]);

    const changeSpecialist = (specialist: AssistantSpecialist) => {
        setSelectedSpecialistId(specialist.id);
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Uzmanlık değişti: **${specialist.title}**. ${specialist.description}`,
        }]);
    };

    const sendMessage = async (preset?: string) => {
        const content = (preset || input).trim();
        if (!content || loading) return;

        const nextMessages: ChatMessage[] = [...messages, { role: 'user', content }];
        const leadCode = extractLeadCodeFromTextClient(content);

        setMessages(nextMessages);
        setInput('');
        setLoading(true);
        setChatError(null);

        try {
            const response = await fetch('/api/assistant/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: nextMessages,
                    currentLeadId: getCurrentLeadId(profile.id),
                    leadCode,
                    specialist: selectedSpecialist.id,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.error || 'Yardımcı agent cevap veremedi');
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.answer || 'Net bir cevap üretilemedi.',
            }]);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Yardımcı agent hatası';
            setChatError(message);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '**Şu an cevap üretemedim.** Birazdan tekrar dene veya lead notlarını kontrol et.',
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-cyan-500 to-blue-700 text-white shadow-2xl shadow-cyan-500/20 transition-all hover:scale-110 active:scale-95 md:h-16 md:w-16"
                title="AI Yardımcı"
                aria-label="AI Yardımcı"
            >
                <Bot className="h-6 w-6 md:h-7 md:w-7" />
                <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-slate-950 bg-emerald-400" />
            </button>

            {open && (
                <div className="fixed inset-0 z-[70] pointer-events-none">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-auto" onClick={() => setOpen(false)} />

                    <section className="absolute bottom-3 left-3 right-3 flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/60 pointer-events-auto sm:bottom-24 sm:left-6 sm:right-auto sm:w-[470px]">
                        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/15">
                                    <Sparkles className="h-5 w-5 text-cyan-200" />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-sm font-bold text-white">SonCall Uzman Chat</h2>
                                    <p className="truncate text-xs text-slate-400">{selectedSpecialist.title}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                                aria-label="Kapat"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </header>

                        <div className="border-b border-white/10 p-3">
                            <div className="mb-3 rounded-lg border border-white/10 bg-white/5 p-3">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-200">
                                        <ActiveIcon className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-white">{selectedSpecialist.title}</p>
                                        <p className="mt-1 text-xs leading-relaxed text-slate-400">{selectedSpecialist.description}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-5 gap-2">
                                {specialists.map((specialist) => {
                                    const Icon = specialist.icon;
                                    const active = specialist.id === selectedSpecialist.id;
                                    return (
                                        <button
                                            key={specialist.id}
                                            onClick={() => changeSpecialist(specialist)}
                                            className={`flex h-12 flex-col items-center justify-center gap-1 rounded-lg border text-[10px] font-bold transition-colors ${active
                                                ? 'border-cyan-300/50 bg-cyan-500 text-slate-950'
                                                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                                                }`}
                                            title={specialist.title}
                                            aria-label={specialist.title}
                                        >
                                            <Icon className="h-4 w-4" />
                                            <span>{specialist.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div ref={scrollRef} className="h-[390px] space-y-3 overflow-y-auto px-4 py-4">
                            {messages.map((message, index) => (
                                <div
                                    key={`${message.role}-${index}`}
                                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${message.role === 'user'
                                        ? 'rounded-br-sm bg-cyan-500 text-slate-950'
                                        : 'rounded-bl-sm border border-white/10 bg-white/8 text-slate-100'
                                        }`}>
                                        {message.role === 'assistant'
                                            ? renderMessageContent(message.content)
                                            : <p>{message.content}</p>}
                                    </div>
                                </div>
                            ))}

                            {loading && (
                                <div className="flex justify-start">
                                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-white/10 bg-white/8 px-3 py-2 text-sm text-slate-300">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Analiz ediyor
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2 px-4 pb-3">
                            {selectedSpecialist.prompts.map((prompt) => (
                                <button
                                    key={prompt}
                                    onClick={() => sendMessage(prompt)}
                                    disabled={loading}
                                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>

                        {chatError && (
                            <p className="px-4 pb-2 text-xs text-rose-300">{chatError}</p>
                        )}

                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                sendMessage();
                            }}
                            className="flex gap-2 border-t border-white/10 p-3"
                        >
                            <div className="relative min-w-0 flex-1">
                                <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                <input
                                    value={input}
                                    onChange={(event) => setInput(event.target.value)}
                                    placeholder="#0012 için ne yapmalıyım?"
                                    className="h-11 w-full rounded-xl border border-white/10 bg-black/40 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading || !input.trim()}
                                className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500 text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-40"
                                aria-label="Gönder"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </button>
                        </form>

                        <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2 text-[11px] text-slate-500">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                            Lead kodu, aktif lead ve geçmiş kayıtlar cevapta otomatik değerlendirilir.
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}
