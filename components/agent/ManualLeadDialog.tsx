'use client';

import { useState } from 'react';
import { Loader2, X, Plus, UserPlus, Phone, Building2, StickyNote, ScanSearch, Wand2 } from 'lucide-react';

interface ManualLeadDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (leadId: string) => void;
    agentId: string;
}

export default function ManualLeadDialog({ isOpen, onClose, onSuccess, agentId }: ManualLeadDialogProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        business_name: '',
        phone_number: '',
        note: ''
    });
    const [magicActive, setMagicActive] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Simple validation
        if (!formData.business_name || !formData.phone_number) {
            setError('Lütfen zorunlu alanları doldurun.');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/leads/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    business_name: formData.business_name,
                    phone_number: formData.phone_number,
                    note: formData.note,
                    agent_id: agentId
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Lead oluşturulamadı');
            }

            // Success
            // Call onSuccess with the new lead ID
            onSuccess(data.lead.id);

            // Reset form and close handled by parent or useEffect, 
            // but we can reset form here too
            setFormData({ business_name: '', phone_number: '', note: '' });
            onClose();

        } catch (err: any) {
            setError(err.message || 'Bir hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    const handleSmartPaste = (e: React.ClipboardEvent<HTMLTextAreaElement> | React.FormEvent<HTMLTextAreaElement>) => {
        const text = (e.currentTarget as HTMLTextAreaElement).value;
        if (!text) return;

        // Try to extract phone number
        // Matches typical Turkish mobile patterns: 05xx, 5xx, or +905xx
        const phoneMatch = text.match(/(?:\+90|0)?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/);

        if (phoneMatch) {
            let phone = phoneMatch[0].replace(/[\s-]/g, '');
            // Normalize to 05...
            if (phone.startsWith('5')) phone = '0' + phone;
            if (phone.startsWith('+90')) phone = '0' + phone.substring(3);

            // Remaining text is potentially the name
            let name = text.replace(phoneMatch[0], '').trim();
            // Clean up common prefixes/suffixes if any (simple)
            name = name.replace(/^[-:,\s]+|[-:,\s]+$/g, '');

            if (phone) {
                // Determine potential category from name
                let categoryNote = '';
                const lowerName = name.toLowerCase();

                const keywords: Record<string, string> = {
                    'emlak': 'Emlak',
                    'gayrimenkul': 'Emlak',
                    'mobilya': 'Mobilya',
                    'dekorasyon': 'Mobilya',
                    'oto': 'Otomotiv',
                    'galeri': 'Otomotiv',
                    'inşaat': 'İnşaat',
                    'yapı': 'İnşaat',
                    'gıda': 'Gıda',
                    'market': 'Gıda',
                    'restoran': 'Yeme-İçme',
                    'kafe': 'Yeme-İçme',
                    'kuyumcu': 'Kuyumculuk',
                    'güzellik': 'Güzellik',
                    'kuaför': 'Güzellik'
                };

                for (const [key, cat] of Object.entries(keywords)) {
                    if (lowerName.includes(key)) {
                        categoryNote = ` [Kategori: ${cat}]`;
                        break;
                    }
                }

                setFormData(prev => ({
                    ...prev,
                    phone_number: phone,
                    business_name: name.length > 2 ? name : prev.business_name,
                    note: (prev.note + categoryNote).trim()
                }));

                // Trigger Magic Effect
                setMagicActive(true);
                setTimeout(() => setMagicActive(false), 1000);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                >
                    <X className="w-5 h-5" />
                </button>

                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <UserPlus className="w-6 h-6 text-purple-400" />
                    Manuel Lead Ekle
                </h3>

                {/* Smart Paste Area */}
                <div className="mb-6">
                    <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-purple-300 text-sm mb-2 font-medium">
                            <Wand2 className="w-4 h-4" />
                            Akıllı Yapıştır (Smart Paste)
                        </div>
                        <textarea
                            className="w-full bg-black/20 border border-white/10 rounded-md px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                            rows={2}
                            placeholder="Örn: Ahmet Yılmaz 0555 123 45 67 (Metni buraya yapıştırın, otomatik ayrıştıralım)"
                            onChange={handleSmartPaste}
                        />
                    </div>
                </div>

                {error && (
                    <div className="bg-red-500/20 text-red-100 p-3 rounded-lg mb-4 text-sm border border-red-500/30 flex items-center gap-2">
                        <span className="shrink-0">⚠️</span>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-purple-200 mb-1">
                            İşletme / Müşteri Adı <span className="text-red-400">*</span>
                        </label>
                        <div className={`relative group transition-all duration-300 ${magicActive ? 'scale-105 shadow-[0_0_15px_rgba(168,85,247,0.5)] rounded-lg' : ''}`}>
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors group-focus-within:text-purple-400">
                                <Building2 className="h-4 w-4 text-purple-400/50" />
                            </div>
                            <input
                                required
                                type="text"
                                value={formData.business_name}
                                onChange={(e) => setFormData(prev => ({ ...prev, business_name: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                placeholder="Örn: Yılmaz Ticaret"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-purple-200 mb-1">
                            Telefon Numarası <span className="text-red-400">*</span>
                        </label>
                        <div className={`relative group transition-all duration-300 ${magicActive ? 'scale-105 shadow-[0_0_15px_rgba(168,85,247,0.5)] rounded-lg delay-100' : ''}`}>
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors group-focus-within:text-purple-400">
                                <Phone className="h-4 w-4 text-purple-400/50" />
                            </div>
                            <input
                                required
                                type="tel"
                                value={formData.phone_number}
                                onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                placeholder="05xxxxxxxxx"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-purple-200 mb-1">
                            Not (İsteğe Bağlı)
                        </label>
                        <div className="relative group">
                            <div className="absolute top-3 left-3 pointer-events-none transition-colors group-focus-within:text-purple-400">
                                <StickyNote className="h-4 w-4 text-purple-400/50" />
                            </div>
                            <textarea
                                value={formData.note}
                                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all min-h-[80px] resize-none"
                                placeholder="Görüşme öncesi notlarınız..."
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium transition-colors border border-white/5"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 transform active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Plus className="w-5 h-5" />
                                    Ekle ve Başla
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
