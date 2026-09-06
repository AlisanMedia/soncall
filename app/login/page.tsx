'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Mail, Lock, LogIn, LayoutDashboard, User, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/elevenlabs/input';
import { Card } from '@/components/ui/elevenlabs/card';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { GlassButton } from '@/components/ui/glass-button';
import styles from './page.module.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [targetDashboard, setTargetDashboard] = useState<'manager' | 'agent' | null>(null);

    const router = useRouter();

    // Keep dashboard-selector accounts in deployment configuration instead of
    // shipping private addresses in the client bundle. Values are comma-separated.
    const specialSelectionEmails = (process.env.NEXT_PUBLIC_DASHBOARD_SELECTOR_EMAILS || '')
        .split(',')
        .map(value => value.trim().toLowerCase())
        .filter(Boolean);

    const showDashboardSelector = specialSelectionEmails.includes(email.trim().toLowerCase());

    const handleEmailChange = (nextEmail: string) => {
        setEmail(nextEmail);
        const isSpecialSelectionEmail = specialSelectionEmails.includes(nextEmail.trim().toLowerCase());
        setTargetDashboard((currentDashboard) => (
            isSpecialSelectionEmail ? currentDashboard || 'manager' : null
        ));
    };

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
                // If special email or admin/founder didn't select a dashboard up top, default to manager.
                if (['admin', 'founder'].includes(profile?.role) || specialSelectionEmails.includes(userEmail || '')) {
                    router.push('/manager');
                } else if (profile?.role === 'manager') {
                    router.push('/manager');
                } else {
                    router.push('/agent');
                }

                router.refresh();
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Giriş yapılırken bir hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`${styles.shell} min-h-[100dvh] flex items-start justify-center px-4 py-8 sm:items-center sm:py-12 animate-fade-in`} style={{ background: '#000000' }}>
            {/* Animated Background Grid */}
            <div className="fixed inset-0 -z-10 bg-black">
                {/* Subtle spotlight to make grid pop */}
                <div className="absolute inset-0" style={{
                    background: 'radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, transparent 70%)'
                }} />
                {/* Grid Pattern */}
                <div className="absolute inset-0" style={{
                    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.15) 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }} />
            </div>

            <div className="w-full max-w-md min-w-0 animate-fade-in-up">
                {/* Logo/Brand */}
                <div className="text-center mb-8 animate-scale-in">
                    {/* Logo Image */}
                    <div className="flex justify-center mb-3">
                        <Image
                            src="/logo-dark.png"
                            alt="ArtificAgent Logo"
                            width={96}
                            height={96}
                            className="h-20 w-auto object-contain brightness-0 invert sm:h-24"
                        />
                    </div>
                    <h1 className="mb-2 break-words text-3xl font-black tracking-tight text-white sm:text-4xl">
                        ArtificAgent
                    </h1>
                    <p className="break-words text-base text-zinc-400 sm:text-lg">Cold Calling Management System</p>
                </div>

                {/* Login Card */}
                <div className="relative">
                    <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} borderWidth={3} />
                    <Card className="relative !border-none !bg-transparent !shadow-none !backdrop-filter-none p-5 animate-scale-in sm:p-8">
                        <h2 className="mb-6 text-center text-2xl font-bold text-white sm:mb-8 sm:text-3xl">Giriş Yap</h2>

                        {error && (
                            <div role="alert" aria-live="assertive" className="mb-6 break-words rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 backdrop-blur-sm animate-fade-in">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} aria-busy={loading} className="space-y-6">
                            {/* Email Input */}
                            <div>
                                <label htmlFor="email" className="block text-sm font-semibold text-zinc-300 mb-2">
                                    Email
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
                                    <Input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => handleEmailChange(e.target.value)}
                                        required
                                        autoComplete="email"
                                        className="pl-12"
                                        placeholder="ornek@email.com"
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            {/* DASHBOARD SELECTOR - Appears only for specific emails */}
                            {showDashboardSelector && (
                                <div className="animate-fade-in">
                                    <label className="block text-sm font-semibold text-yellow-300 mb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                                        Hedef Panel Seçimi
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setTargetDashboard('manager')}
                                            className={`flex min-h-11 flex-col items-center justify-center rounded-xl border p-4 transition-smooth ${targetDashboard === 'manager'
                                                ? 'glass-card border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.4)] scale-105'
                                                : 'glass-card border-white/10 hover:border-white/20'
                                                }`}
                                        >
                                            <LayoutDashboard className={`w-7 h-7 mb-2 ${targetDashboard === 'manager' ? 'text-purple-400' : 'text-zinc-400'}`} />
                                            <span className={`text-sm font-semibold ${targetDashboard === 'manager' ? 'text-white' : 'text-zinc-400'}`}>
                                                Yönetici
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setTargetDashboard('agent')}
                                            className={`flex min-h-11 flex-col items-center justify-center rounded-xl border p-4 transition-smooth ${targetDashboard === 'agent'
                                                ? 'glass-card border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.4)] scale-105'
                                                : 'glass-card border-white/10 hover:border-white/20'
                                                }`}
                                        >
                                            <User className={`w-7 h-7 mb-2 ${targetDashboard === 'agent' ? 'text-cyan-400' : 'text-zinc-400'}`} />
                                            <span className={`text-sm font-semibold ${targetDashboard === 'agent' ? 'text-white' : 'text-zinc-400'}`}>
                                                Agent
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Password Input */}
                            <div>
                                <label htmlFor="password" className="block text-sm font-semibold text-zinc-300 mb-2">
                                    Şifre
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
                                    <Input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        autoComplete="current-password"
                                        className="pl-12"
                                        placeholder="••••••••"
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <GlassButton
                                type="submit"
                                disabled={loading}
                                aria-live="polite"
                                className="w-full min-h-12 py-2 text-base whitespace-normal leading-tight sm:text-lg sm:whitespace-nowrap"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Giriş Yapılıyor...
                                    </>
                                ) : (
                                    <>
                                        <LogIn className="w-5 h-5 mr-2" />
                                        {targetDashboard ? `${targetDashboard === 'manager' ? 'Yönetici' : 'Agent'} Paneline Gir` : 'Giriş Yap'}
                                    </>
                                )}
                            </GlassButton>
                        </form>
                    </Card>
                </div>

                {/* Footer */}
                <p className="text-center text-zinc-500 text-sm mt-8">
                    © 2026 ArtificAgent. Tüm hakları saklıdır.
                </p>
            </div>
        </div>
    );
}
