import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LayoutDashboard, User, LogOut } from 'lucide-react';
import styles from './page.module.css';

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
        <div className={`${styles.shell} min-h-[100dvh] flex items-start sm:items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4 py-8 sm:py-12`}>
            <div className="w-full max-w-5xl min-w-0">
                {/* Header */}
                <div className="text-center mb-8 sm:mb-12">
                    <Image
                        src="/artificagent-logo.png"
                        alt="ArtificAgent Logo"
                        width={64}
                        height={64}
                        className="h-12 sm:h-16 mx-auto mb-4 opacity-90"
                    />
                    <h1 className="mx-auto mb-2 max-w-3xl break-words text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                    {/* Manager Dashboard Card */}
                    <Link
                        href="/manager"
                        className="group block min-w-0"
                    >
                        <div className="flex min-h-[240px] flex-col justify-center rounded-2xl border-2 border-white/20 bg-white/10 p-5 backdrop-blur-lg transition-all duration-300 hover:border-purple-500 hover:bg-white/15 hover:shadow-2xl sm:min-h-[280px] sm:p-8 sm:hover:scale-105">
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
                        className="group block min-w-0"
                    >
                        <div className="flex min-h-[240px] flex-col justify-center rounded-2xl border-2 border-white/20 bg-white/10 p-5 backdrop-blur-lg transition-all duration-300 hover:border-blue-500 hover:bg-white/15 hover:shadow-2xl sm:min-h-[280px] sm:p-8 sm:hover:scale-105">
                            <div className="text-center">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <User className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                                </div>
                                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                                    SDR / Closer Paneli
                                </h2>
                                <p className="text-sm sm:text-base text-gray-300 mb-4">
                                    Randevu organizasyonu, toplantı takibi ve satış kapama
                                </p>
                                <div className="flex flex-wrap gap-2 justify-center text-xs">
                                    <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded">SDR Pipeline</span>
                                    <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded">Closer Takibi</span>
                                    <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded">Satışlar</span>
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
                            className="mx-auto flex min-h-11 min-w-[44px] items-center gap-2 px-4 py-2 text-sm text-gray-400 transition-colors hover:text-white"
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
