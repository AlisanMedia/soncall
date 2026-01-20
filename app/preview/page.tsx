'use client';

import { useState } from 'react';
import { Upload, Users, Phone, MessageCircle, Trophy, LogOut } from 'lucide-react';

// Mock Data
const mockProfile = {
    id: '1',
    email: 'demo@artificagent.com',
    full_name: 'Demo User',
    role: 'manager' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
};

const mockLead = {
    id: '1',
    business_name: 'Cafe Istanbul',
    phone_number: '+90 212 555 0101',
    address: 'İstiklal Cad. No:123, Beyoğlu, İstanbul',
    category: 'Coffee Shop',
    website: 'https://cafeistanbul.com',
    rating: 4.5,
    raw_data: {},
    status: 'pending' as const,
    potential_level: 'not_assessed' as const,
    assigned_to: '1',
    current_agent_id: null,
    locked_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    processed_at: null,
    batch_id: '1',
};

const mockLeaderboard = [
    { agent_id: '1', agent_name: 'Ahmet Yılmaz', processed_count: 45, rank: 1 },
    { agent_id: '2', agent_name: 'Mehmet Demir', processed_count: 38, rank: 2 },
    { agent_id: '3', agent_name: 'Ayşe Kaya', processed_count: 32, rank: 3 },
    { agent_id: '4', agent_name: 'Fatma Öz', processed_count: 28, rank: 4 },
];

export default function UIPreviewPage() {
    const [view, setView] = useState<'login' | 'manager' | 'agent'>('login');

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Navigation */}
            <div className="fixed top-4 right-4 z-50 flex gap-2">
                <button
                    onClick={() => setView('login')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${view === 'login' ? 'bg-purple-600 text-white' : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                >
                    Login
                </button>
                <button
                    onClick={() => setView('manager')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${view === 'manager' ? 'bg-purple-600 text-white' : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                >
                    Manager
                </button>
                <button
                    onClick={() => setView('agent')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${view === 'agent' ? 'bg-purple-600 text-white' : 'bg-white/10 text-purple-200 hover:bg-white/20'
                        }`}
                >
                    Agent
                </button>
            </div>

            {/* Login View */}
            {view === 'login' && (
                <div className="min-h-screen flex items-center justify-center px-4">
                    <div className="w-full max-w-md">
                        <div className="text-center mb-8">
                            <img
                                src="/artificagent-logo.png"
                                alt="ArtificAgent Logo"
                                className="h-16 mx-auto mb-4 opacity-90"
                            />
                            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">ArtificAgent</h1>
                            <p className="text-purple-200">Cold Calling Management System</p>
                        </div>

                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
                            <h2 className="text-2xl font-semibold text-white mb-6">Giriş Yap</h2>

                            <form className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">Email</label>
                                    <div className="relative">
                                        <input
                                            type="email"
                                            placeholder="ornek@email.com"
                                            className="w-full pl-4 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-purple-200 mb-2">Şifre</label>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                                <button
                                    type="button"
                                    className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                                >
                                    Giriş Yap
                                </button>
                            </form>

                            <div className="mt-6 pt-6 border-t border-white/20">
                                <p className="text-xs text-purple-200 mb-2">UI Preview Mode - Gerçek Supabase bağlantısı yok</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Manager View */}
            {view === 'manager' && (
                <>
                    <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <img
                                        src="/artificagent-logo.png"
                                        alt="ArtificAgent"
                                        className="h-8 opacity-90"
                                    />
                                    <div>
                                        <h1 className="text-2xl font-bold text-white">ArtificAgent</h1>
                                        <p className="text-sm text-purple-200">Manager Dashboard</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="text-sm text-purple-200">Hoş geldiniz,</p>
                                        <p className="font-semibold text-white">{mockProfile.full_name}</p>
                                    </div>
                                    <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                                        <LogOut className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </header>

                    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="mb-8">
                            <div className="flex items-center justify-center gap-4">
                                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white">
                                    <Upload className="w-5 h-5" />
                                    <span className="font-medium">1. CSV Yükle</span>
                                </div>
                                <div className="w-12 h-0.5 bg-white/20"></div>
                                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-purple-200">
                                    <Users className="w-5 h-5" />
                                    <span className="font-medium">2. Lead Dağıt</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20 space-y-6">
                            <div>
                                <h2 className="text-2xl font-semibold text-white">CSV Dosyası Yükle</h2>
                                <p className="text-purple-200 mt-1">Google Maps'ten çekilen lead verilerinizi yükleyin</p>
                            </div>

                            <div className="border-2 border-dashed border-white/30 hover:border-purple-400 rounded-xl p-12 text-center cursor-pointer transition-all hover:bg-white/5">
                                <Upload className="w-16 h-16 text-purple-300 mx-auto mb-4" />
                                <p className="text-lg font-medium text-white mb-1">CSV dosyasını sürükleyip bırakın</p>
                                <p className="text-sm text-purple-200">veya tıklayarak dosya seçin</p>
                                <div className="mt-4 text-xs text-purple-300 space-y-1">
                                    <p>Kabul edilen formatlar: .csv, .xlsx</p>
                                    <p>Gerekli kolonlar: Business Name, Phone Number</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                    <div className="text-purple-300 text-sm mb-1">Format</div>
                                    <div className="text-white font-semibold">Google Maps CSV</div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                    <div className="text-purple-300 text-sm mb-1">Max Boyut</div>
                                    <div className="text-white font-semibold">10 MB</div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                    <div className="text-purple-300 text-sm mb-1">UI Preview</div>
                                    <div className="text-white font-semibold">Demo Mode</div>
                                </div>
                            </div>
                        </div>
                    </main>
                </>
            )}

            {/* Agent View */}
            {view === 'agent' && (
                <>
                    <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <img
                                        src="/artificagent-logo.png"
                                        alt="ArtificAgent"
                                        className="h-8 opacity-90"
                                    />
                                    <div>
                                        <h1 className="text-2xl font-bold text-white">ArtificAgent</h1>
                                        <p className="text-sm text-purple-200">Agent Panel</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="text-sm text-purple-200">Hoş geldiniz,</p>
                                        <p className="font-semibold text-white">Demo Agent</p>
                                    </div>
                                    <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                                        <LogOut className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </header>

                    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            {/* Leaderboard */}
                            <div className="lg:col-span-1">
                                <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20 space-y-6">
                                    <div className="flex items-center gap-2 border-b border-white/20 pb-4">
                                        <Trophy className="w-6 h-6 text-yellow-400" />
                                        <h3 className="text-xl font-bold text-white">Liderlik Tablosu</h3>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="bg-purple-500/20 rounded-lg p-3 border border-purple-500/30">
                                            <div className="text-purple-200 text-xs mb-1">Bugün İşlenen</div>
                                            <div className="text-2xl font-bold text-white">32</div>
                                        </div>
                                        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                                            <div className="text-purple-300 text-xs mb-1">Toplam Atanan</div>
                                            <div className="text-lg font-semibold text-white">50</div>
                                        </div>
                                        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                                            <div className="text-purple-300 text-xs mb-1">Kalan</div>
                                            <div className="text-lg font-semibold text-yellow-300">18</div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {mockLeaderboard.map((entry, idx) => (
                                            <div
                                                key={entry.agent_id}
                                                className={`flex items-center gap-3 p-3 rounded-lg ${idx === 2 ? 'bg-purple-500/30 border-2 border-purple-400' : 'bg-white/5 border border-white/10'
                                                    }`}
                                            >
                                                <div className={`font-bold text-lg w-6 ${['text-yellow-400', 'text-gray-300', 'text-amber-600'][idx] || 'text-purple-300'}`}>
                                                    #{entry.rank}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-semibold text-purple-100 truncate">
                                                        {entry.agent_name}
                                                        {idx === 2 && <span className="ml-2 text-xs bg-purple-600 px-2 py-0.5 rounded-full">Siz</span>}
                                                    </div>
                                                    <div className="text-xs text-purple-300">{entry.processed_count} lead</div>
                                                </div>
                                                {idx < 3 && <Trophy className={`w-5 h-5 ${['text-yellow-400', 'text-gray-300', 'text-amber-600'][idx]}`} />}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Lead Card */}
                            <div className="lg:col-span-3">
                                <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20 space-y-6">
                                    <div>
                                        <h2 className="text-3xl font-bold text-white mb-2">{mockLead.business_name}</h2>
                                        <div className="flex items-center gap-2 text-purple-200">
                                            <span className="px-3 py-1 bg-purple-500/30 rounded-full text-sm">{mockLead.category}</span>
                                            <span className="flex items-center gap-1 px-3 py-1 bg-yellow-500/30 rounded-full text-sm">
                                                ⭐ {mockLead.rating}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                            <div className="flex items-center gap-2 text-purple-300 mb-2">
                                                <Phone className="w-4 h-4" />
                                                <span className="text-sm font-medium">Telefon</span>
                                            </div>
                                            <p className="text-lg font-semibold text-white">{mockLead.phone_number}</p>
                                        </div>
                                        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                            <div className="flex items-center gap-2 text-purple-300 mb-2">
                                                <span className="text-sm font-medium">Adres</span>
                                            </div>
                                            <p className="text-lg font-semibold text-white truncate">{mockLead.address}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-purple-200 mb-3">
                                            Potansiyel Seviyesi <span className="text-red-400">*</span>
                                        </label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {['Yüksek', 'Orta', 'Düşük'].map((level) => (
                                                <button
                                                    key={level}
                                                    className="p-4 rounded-lg border-2 border-white/20 bg-white/5 text-purple-200 hover:border-green-400/50 transition-all"
                                                >
                                                    <div className="font-semibold">{level}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-purple-200 mb-2">
                                            Not <span className="text-red-400">* (Min. 10 karakter)</span>
                                        </label>
                                        <textarea
                                            placeholder="Görüşme notlarınızı buraya yazın..."
                                            rows={4}
                                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <button className="py-3 px-4 rounded-lg font-semibold bg-green-500/20 border-2 border-green-500 text-green-100 hover:bg-green-500/30 transition-all flex items-center justify-center gap-2">
                                            <MessageCircle className="w-5 h-5" />
                                            WhatsApp'a Yönlendir
                                        </button>
                                        <button className="py-3 px-4 rounded-lg font-semibold bg-purple-500/20 border-2 border-purple-500 text-purple-100 hover:bg-purple-500/30 transition-all flex items-center justify-center gap-2">
                                            📅 Randevuya Çevir
                                        </button>
                                    </div>

                                    <button className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-lg rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200">
                                        Sonraki Lead →
                                    </button>
                                </div>
                            </div>
                        </div>
                    </main>
                </>
            )}

            {/* Preview Notice */}
            <div className="fixed bottom-4 left-4 bg-yellow-500/20 border border-yellow-500/50 text-yellow-100 px-4 py-2 rounded-lg text-sm">
                🎨 UI Preview Mode - Gerçek veri bağlantısı yok
            </div>
        </div>
    );
}
