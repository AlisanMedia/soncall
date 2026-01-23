'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Mail, Lock, LogIn, LayoutDashboard, User } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [targetDashboard, setTargetDashboard] = useState<'manager' | 'agent' | null>(null);
    const [showDashboardSelector, setShowDashboardSelector] = useState(false);

    const router = useRouter();

    // Check email for special dashboard selection privileges
    useEffect(() => {
        const specialSelectionEmails = [
            'alisangul123@gmail.com',
            'efebusinessonlybusiness@gmail.com'
        ];
        if (specialSelectionEmails.includes(email.trim().toLowerCase())) {
            setShowDashboardSelector(true);
            // Default select manager if not selected
            if (!targetDashboard) setTargetDashboard('manager');
        } else {
            setShowDashboardSelector(false);
            setTargetDashboard(null);
        }
    }, [email, targetDashboard]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Create client only when needed (at runtime)
            const supabase = createClient();
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;

            if (data.user) {
                // Get user profile to determine role
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();

                const userEmail = data.user.email;

                // 2. PRE-LOGIN SELECTION: If user selected a dashboard explicitly (Highest Priority)
                if (targetDashboard) {
                    router.push('/' + targetDashboard);
                    return;
                }

                // 3. FALLBACK: Normal role based redirect
                if (profile?.role === 'manager') {
                    router.push('/manager');
                } else {
                    router.push('/agent');
                }

                router.refresh();
            }
        } catch (err: any) {
            setError(err.message || 'Giriş yapılırken bir hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4">
            <div className="w-full max-w-md">
                {/* Logo/Brand */}
                <div className="text-center mb-8">
                    <img
                        src="/artificagent-logo.png"
                        alt="ArtificAgent Logo"
                        className="h-16 mx-auto mb-4 opacity-90"
                    />
                    <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                        ArtificAgent
                    </h1>
                    <p className="text-purple-200">Cold Calling Management System</p>
                </div>

                {/* Login Card */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
                    <h2 className="text-2xl font-semibold text-white mb-6">Giriş Yap</h2>

                    {error && (
                        <div className="bg-red-500/20 border border-red-500/50 text-red-100 px-4 py-3 rounded-lg mb-6">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        {/* Email Input */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-purple-200 mb-2">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-300 w-5 h-5" />
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                    placeholder="ornek@email.com"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* DASHBOARD SELECTOR - Appears only for specific emails */}
                        {showDashboardSelector && (
                            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                                <label className="block text-sm font-medium text-yellow-300 mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                                    Hedef Panel Seçimi
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setTargetDashboard('manager')}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 ${targetDashboard === 'manager'
                                            ? 'bg-purple-600 border-purple-400 shadow-[0_0_15px_rgba(147,51,234,0.5)] scale-105'
                                            : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-400'
                                            }`}
                                    >
                                        <LayoutDashboard className={`w-6 h-6 mb-2 ${targetDashboard === 'manager' ? 'text-white' : 'text-gray-400'}`} />
                                        <span className={`text-xs font-semibold ${targetDashboard === 'manager' ? 'text-white' : 'text-gray-400'}`}>
                                            Yönetici
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setTargetDashboard('agent')}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 ${targetDashboard === 'agent'
                                            ? 'bg-blue-600 border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-105'
                                            : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-400'
                                            }`}
                                    >
                                        <User className={`w-6 h-6 mb-2 ${targetDashboard === 'agent' ? 'text-white' : 'text-gray-400'}`} />
                                        <span className={`text-xs font-semibold ${targetDashboard === 'agent' ? 'text-white' : 'text-gray-400'}`}>
                                            Agent
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Password Input */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-purple-200 mb-2">
                                Şifre
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-300 w-5 h-5" />
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                    placeholder="••••••••"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3 px-4 bg-gradient-to-r text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 ${targetDashboard === 'manager' ? 'from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700' :
                                targetDashboard === 'agent' ? 'from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700' :
                                    'from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
                                }`}
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Giriş yapılıyor...
                                </>
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    {targetDashboard ? `${targetDashboard === 'manager' ? 'Yönetici' : 'Agent'} Paneline Gir` : 'Giriş Yap'}
                                </>
                            )}
                        </button>
                    </form>


                </div>

                {/* Footer */}
                <p className="text-center text-purple-300/60 text-sm mt-6">
                    © 2026 ArtificAgent. All rights reserved.
                </p>
            </div>
        </div>
    );
}
