import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, User, LogOut } from 'lucide-react';

export default async function SelectDashboard() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    const specialEmails = ['alisangul123@gmail.com', 'efebusinessonlybusiness@gmail.com'];

    // Only admin/founder or special emails can access this page
    if (!['admin', 'founder'].includes(profile?.role || '') && !specialEmails.includes(user.email || '')) {
        redirect('/');
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4 py-8">
            <div className="max-w-5xl w-full">
                {/* Header */}
                <div className="text-center mb-8 sm:mb-12">
                    <img
                        src="/artificagent-logo.png"
                        alt="ArtificAgent Logo"
                        className="h-12 sm:h-16 mx-auto mb-4 opacity-90"
                    />
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
                        Hoş geldiniz, {profile.full_name}
                    </h1>
                    <p className="text-sm sm:text-base text-purple-200">
                        Hangi paneli kullanmak istersiniz?
                    </p>
                    {profile.role === 'founder' && (
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 rounded-full text-xs sm:text-sm">
                            👑 Founder
                        </div>
                    )}
                </div>

                {/* Dashboard Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    {/* Manager Dashboard Card */}
                    <Link
                        href="/manager"
                        className="group block"
                    >
                        <div className="bg-white/10 backdrop-blur-lg border-2 border-white/20 rounded-2xl p-6 sm:p-8 hover:bg-white/15 hover:border-purple-500 transition-all duration-300 hover:scale-105 hover:shadow-2xl min-h-[280px] flex flex-col justify-center">
                            <div className="text-center">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <LayoutDashboard className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                                </div>
                                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                                    Yönetici Paneli
                                </h2>
                                <p className="text-sm sm:text-base text-gray-300 mb-4">
                                    Takım yönetimi, analitik, raporlama ve daha fazlası
                                </p>
                                <div className="flex flex-wrap gap-2 justify-center text-xs">
                                    <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded">Takım Yönetimi</span>
                                    <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded">Analytics</span>
                                    <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded">Raporlar</span>
                                </div>
                            </div>
                        </div>
                    </Link>

                    {/* Agent Dashboard Card */}
                    <Link
                        href="/agent"
                        className="group block"
                    >
                        <div className="bg-white/10 backdrop-blur-lg border-2 border-white/20 rounded-2xl p-6 sm:p-8 hover:bg-white/15 hover:border-blue-500 transition-all duration-300 hover:scale-105 hover:shadow-2xl min-h-[280px] flex flex-col justify-center">
                            <div className="text-center">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <User className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                                </div>
                                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                                    Agent Paneli
                                </h2>
                                <p className="text-sm sm:text-base text-gray-300 mb-4">
                                    Lead işleme, arama yapma ve satış takibi
                                </p>
                                <div className="flex flex-wrap gap-2 justify-center text-xs">
                                    <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded">Lead Çağrıları</span>
                                    <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded">Satışlar</span>
                                    <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded">Hedefler</span>
                                </div>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Footer - Logout */}
                <div className="text-center mt-6 sm:mt-8">
                    <form action="/api/auth/logout" method="POST" className="inline-block">
                        <button
                            type="submit"
                            className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-2 mx-auto"
                        >
                            <LogOut className="w-4 h-4" />
                            Çıkış Yap
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
