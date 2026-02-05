'use client';

import { useState } from 'react';
import { X, Building2, MapPin, Globe, Phone, Mail, Instagram, Linkedin, Facebook, Sparkles, ExternalLink, Search, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LeadDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: {
        business_name: string;
        phone_number: string;
        lead_number?: number;
        [key: string]: any;
    };
}

export default function LeadDetailModal({ isOpen, onClose, lead }: LeadDetailModalProps) {
    const [isEnriching, setIsEnriching] = useState(false);
    const [enrichedData, setEnrichedData] = useState<any>(null);

    const handleEnrichment = async () => {
        setIsEnriching(true);
        setEnrichedData(null);

        try {
            const response = await fetch('/api/ai/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessName: lead.business_name,
                    location: lead.city || lead.district || ''
                })
            });

            const result = await response.json();

            if (!result.success) throw new Error(result.error);

            const aiData = result.data;

            setEnrichedData({
                website: aiData.website || `https://www.google.com/search?q=${encodeURIComponent(lead.business_name)}`,
                address: aiData.address, // Capture the address
                socials: aiData.socials?.length > 0 ? aiData.socials : [
                    { platform: 'instagram', url: `https://www.instagram.com/explore/tags/${encodeURIComponent(lead.business_name.replace(/\s+/g, ''))}/` },
                    { platform: 'facebook', url: `https://www.facebook.com/search/top?q=${encodeURIComponent(lead.business_name)}` },
                    { platform: 'linkedin', url: `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(lead.business_name)}` }
                ],
                summary: aiData.summary || "AI analizi tamamlandı.",
                source: result.meta?.source || 'unknown'
            });

        } catch (error) {
            console.error('Enrichment failed:', error);
            setEnrichedData({
                website: `https://www.google.com/search?q=${encodeURIComponent(lead.business_name)}`,
                socials: [
                    { platform: 'instagram', url: `https://www.instagram.com/explore/tags/${encodeURIComponent(lead.business_name.replace(/\s+/g, ''))}/` },
                    { platform: 'facebook', url: `https://www.facebook.com/search/top?q=${encodeURIComponent(lead.business_name)}` },
                    { platform: 'linkedin', url: `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(lead.business_name)}` }
                ],
                summary: "Bağlantı hatası oluştu. Manuel arama linkleri gösteriliyor.",
                source: 'error'
            });
        } finally {
            setIsEnriching(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
                <motion.div
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    className="bg-[#1e1e2d] w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                >
                    {/* Header */}
                    <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-900 to-slate-800 p-4 sm:p-6 border-b border-white/10 flex justify-between items-start backdrop-blur-sm">
                        <div className="flex gap-3 sm:gap-4 flex-1 min-w-0">
                            <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                                <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 flex-wrap">
                                    {lead.lead_number && (
                                        <span className="text-sm sm:text-lg text-purple-400 font-mono bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 shrink-0">
                                            #{lead.lead_number}
                                        </span>
                                    )}
                                    <span className="truncate">{lead.business_name}</span>
                                </h2>
                                <div className="flex items-center gap-2 text-purple-200 mt-1">
                                    <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-xs">
                                        Potansiyel Müşteri
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors touch-target shrink-0">
                            <X className="w-6 h-6 sm:w-5 sm:h-5" />
                        </button>
                    </div>

                    <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 overflow-y-auto">
                        {/* Left Column: Contact Info */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">İletişim Bilgileri</h3>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-gray-300">
                                    <Phone className="w-4 h-4 text-purple-400" />
                                    <span>{lead.phone_number}</span>
                                </div>
                                <div className="flex items-center gap-3 text-gray-300">
                                    <MapPin className="w-4 h-4 text-purple-400 shrink-0" />
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enrichedData?.address || `${lead.business_name} ${lead.city || ''} ${lead.district || ''}`)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:text-white hover:underline truncate"
                                    >
                                        {enrichedData?.address || `${lead.city || ''} ${lead.district || ''} (Haritada Gör)`}
                                    </a>
                                </div>
                                <div className="flex items-center gap-3 text-gray-300">
                                    <Globe className="w-4 h-4 text-purple-400 shrink-0" />
                                    {enrichedData?.website ? (
                                        <a
                                            href={enrichedData.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:text-white hover:underline truncate text-blue-400"
                                        >
                                            {enrichedData.website}
                                        </a>
                                    ) : (
                                        <span className="text-gray-500 italic">Web sitesi bekleniyor... (AI Analizi Yapın)</span>
                                    )}
                                </div>
                            </div>

                            <div className="pt-6 border-t border-white/10">
                                {/* Mevcut Veriler section removed as requested */}
                            </div>
                        </div>

                        {/* Right Column: AI Enrichment */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <BrainCircuit className="w-4 h-4 text-blue-400" />
                                    AI Dijital Varlık Analizi
                                </h3>
                            </div>

                            {!enrichedData ? (
                                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6 text-center">
                                    <Sparkles className="w-12 h-12 text-blue-400 mx-auto mb-4 opacity-50" />
                                    <p className="text-blue-200 mb-6 text-sm">
                                        İşletmenin sosyal medya hesaplarını, web sitesini ve dijital puanını yapay zeka ile analiz etmek için tıklayın.
                                    </p>
                                    <button
                                        onClick={handleEnrichment}
                                        disabled={isEnriching}
                                        className="w-full py-4 sm:py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 touch-target-large active:scale-95"
                                    >
                                        {isEnriching ? (
                                            <>
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Analiz Ediliyor...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4" />
                                                AI ile Verileri Zenginleştir
                                            </>
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-green-500/5 border border-green-500/20 rounded-xl p-5 space-y-4"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="bg-green-500/20 p-2 rounded-lg">
                                            <CheckCircle className="w-5 h-5 text-green-400" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-green-400">Analiz Tamamlandı</h4>
                                            <p className="text-xs text-green-200/70 mt-1">{enrichedData.summary}</p>
                                            <div className="flex gap-2 mt-2">
                                                {enrichedData.source === 'google_api' && (
                                                    <span className="inline-block text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                                                        Google Araması
                                                    </span>
                                                )}
                                                {enrichedData.source === 'website_scrape' && (
                                                    <span className="inline-block text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 flex items-center gap-1">
                                                        <Globe className="w-3 h-3" />
                                                        Web Sitesinden Alındı
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mt-4">
                                        {enrichedData.socials.map((social: any, idx: number) => (
                                            <a
                                                key={idx}
                                                href={social.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {social.platform === 'instagram' && <Instagram className="w-4 h-4 text-pink-500" />}
                                                    {social.platform === 'facebook' && <Facebook className="w-4 h-4 text-blue-500" />}
                                                    {social.platform === 'linkedin' && <Linkedin className="w-4 h-4 text-blue-400" />}
                                                    <span className="capitalize text-gray-300 text-sm">{social.platform} Araması</span>
                                                </div>
                                                <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-white" />
                                            </a>
                                        ))}

                                        <a
                                            href={enrichedData.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Search className="w-4 h-4 text-orange-400" />
                                                <span className="text-gray-300 text-sm">Google'da Ara</span>
                                            </div>
                                            <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-white" />
                                        </a>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

function CheckCircle({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    )
}
