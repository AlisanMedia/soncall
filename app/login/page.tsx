'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Mail, Lock, LogIn, LayoutDashboard, User, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/elevenlabs/button';
import { Input } from '@/components/ui/elevenlabs/input';
import { Card } from '@/components/ui/elevenlabs/card';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { GlassButton } from '@/components/ui/glass-button';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [targetDashboard, setTargetDashboard] = useState<'manager' | 'agent' | null>(null);
    const [showDashboardSelector, setShowDashboardSelector] = useState(false);

    const router = useRouter();

    const specialSelectionEmails = [
        'alisangul123@gmail.com',
        'efebusinessonlybusiness@gmail.com'
    ];

    // Check email for special dashboard selection privileges
    useEffect(() => {
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
        } catch (err: any) {
            setError(err.message || 'Giriş yapılırken bir hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 animate-fade-in">
            {/* Animated Background Grid */}
            <div className="fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(168,85,247,0.15)_0%,_transparent_50%)]" />
                <div className="absolute inset-0" style={{
                    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
                    backgroundSize: '50px 50px'
                }} />
            </div>

            <div className="w-full max-w-md animate-fade-in-up">
                {/* Logo/Brand */}
                <div className="text-center mb-8 animate-scale-in">
                    {/* Logo Image */}
                    <div className="flex justify-center mb-3">
                        <img
                            src="/logo-dark.png"
                            alt="ArtificAgent Logo"
                            className="h-24 w-auto object-contain brightness-0 invert"
                        />
                    </div>
                    <h1 className="text-4xl font-black text-white mb-2 tracking-tight">
                        ArtificAgent
                    </h1>
                    <p className="text-zinc-400 text-lg">Cold Calling Management System</p>
                </div>

                {/* Login Card */}
                <div className="relative">
                    <GlowingEffect spread={40} glow={true} disabled={false} proximity={64} borderWidth={3} />
                    <Card className="p-8 animate-scale-in relative">
                        <h2 className="text-3xl font-bold text-white mb-8 text-center">Giriş Yap</h2>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm animate-fade-in">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-6">
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
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
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
                                            className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-smooth ${targetDashboard === 'manager'
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
                                            className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-smooth ${targetDashboard === 'agent'
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
                                className="w-full py-6 text-lg"
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
