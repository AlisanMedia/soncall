'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Upload, User, Save, Camera, Sparkles, Trophy, Mail, Hash, AlertCircle, Phone, Lock, Eye, EyeOff, Shield } from 'lucide-react';

interface Profile {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
    nickname?: string;
    theme_color?: string;
    bio?: string;
    phone_number?: string;
    role: string;
}

const THEME_COLORS = [
    { name: 'Purple', value: 'purple', from: 'from-purple-600', to: 'to-indigo-600', bg: 'bg-purple-500' },
    { name: 'Blue', value: 'blue', from: 'from-blue-600', to: 'to-cyan-600', bg: 'bg-blue-500' },
    { name: 'Emerald', value: 'emerald', from: 'from-emerald-600', to: 'to-teal-600', bg: 'bg-emerald-500' },
    { name: 'Amber', value: 'amber', from: 'from-amber-500', to: 'to-orange-600', bg: 'bg-amber-500' },
    { name: 'Rose', value: 'rose', from: 'from-rose-600', to: 'to-pink-600', bg: 'bg-rose-500' },
];

export default function AgentSettings({ userProfile }: { userProfile: any }) {
    const [profile, setProfile] = useState<Profile>(userProfile);
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(userProfile?.avatar_url || null);
    const [stats, setStats] = useState({ totalCalls: 0, successRate: 0 });

    // Password change state
    const [showPasswordSection, setShowPasswordSection] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();
    const router = useRouter();

    const currentTheme = THEME_COLORS.find(c => c.value === (profile.theme_color || 'purple')) || THEME_COLORS[0];

    useEffect(() => {
        // Sync local state if prop changes
        setProfile(userProfile);
        setPreviewUrl(userProfile?.avatar_url || null);
        fetchStats();
    }, [userProfile]);

    const fetchStats = async () => {
        try {
            // 1. Total Calls (Completed Activities)
            const { count: callsCount } = await supabase
                .from('lead_activity_log')
                .select('*', { count: 'exact', head: true })
                .eq('agent_id', userProfile.id)
                .eq('action', 'completed');

            // 2. Success (Appointments)
            // We count leads that resulted in appointment
            const { count: appointmentCount } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', userProfile.id)
                .eq('status', 'appointment');

            // 3. Sales
            const { count: salesCount } = await supabase
                .from('sales')
                .select('*', { count: 'exact', head: true })
                .eq('agent_id', userProfile.id)
                .eq('status', 'approved');

            const totalSuccess = (appointmentCount || 0) + (salesCount || 0);
            const total = callsCount || 0;
            const rate = total > 0 ? Math.round((totalSuccess / total) * 100) : 0;

            setStats({
                totalCalls: total,
                successRate: rate
            });

        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            let avatarPath = profile.avatar_url;
            let emailMessage = '';

            // 0. Email Request Check
            // We do NOT update auth directly. We will save intent to 'pending_email' column via the profile update.
            if (profile.email !== userProfile.email) {
                emailMessage = '\n⚠️ Email değişim talebiniz yöneticiye iletildi. Onaylandığında güncellenecektir.';
            }

            // 1. Upload Avatar if changed
            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(fileName);

                avatarPath = publicUrl;
            }

            // 2. Update Profile Table
            const updates: any = {
                full_name: profile.full_name,
                nickname: profile.nickname,
                avatar_url: avatarPath,
                theme_color: profile.theme_color,
                bio: profile.bio,
                phone_number: profile.phone_number,
                updated_at: new Date().toISOString(),
            };

            // If email changed, save it as pending_email, NOT as email
            // The API handles the actual switch from pending to real email.
            if (profile.email !== userProfile.email) {
                updates.pending_email = profile.email;
            }

            const { error: updateError } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', profile.id);

            if (updateError) {
                throw new Error(`Profil güncellenemedi: ${updateError.message} (Lütfen SQL scriptini çalıştırdığınızdan emin olun)`);
            }

            // Success handling
            setProfile(prev => ({
                ...prev,
                avatar_url: avatarPath,
                // Revert displayed email to original until approved
                email: userProfile.email
            }));

            // Critical: Force refresh server components
            router.refresh();

            toast.success(`Profil başarıyla güncellendi!${emailMessage}`);

        } catch (error: any) {
            console.error('Error saving profile:', error);
            toast.error('Hata: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async () => {
        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            toast.error('Lütfen tüm şifre alanlarını doldurun!');
            return;
        }

        if (newPassword.length < 8) {
            toast.error('Yeni şifre en az 8 karakter olmalıdır!');
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error('Yeni şifreler eşleşmiyor!');
            return;
        }

        setPasswordLoading(true);
        try {
            // Update password using Supabase auth API
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            // Clear password fields
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setShowPasswordSection(false);

            toast.success('Şifreniz başarıyla güncellendi!');
        } catch (error: any) {
            console.error('Password update error:', error);
            toast.error('Şifre güncellenemedi: ' + error.message);
        } finally {
            setPasswordLoading(false);
        }
    };

    const formatPhoneNumber = (value: string) => {
        // Remove all non-digits
        const digits = value.replace(/\D/g, '');

        // Format as 0XXX XXX XX XX
        if (digits.length <= 4) return digits;
        if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
        if (digits.length <= 9) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
        return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhoneNumber(e.target.value);
        setProfile({ ...profile, phone_number: formatted });
    };

    const getPasswordStrength = (password: string) => {
        if (password.length === 0) return { label: '', color: '' };
        if (password.length < 6) return { label: 'Zayıf', color: 'text-red-400' };
        if (password.length < 10) return { label: 'Orta', color: 'text-yellow-400' };
        return { label: 'Güçlü', color: 'text-green-400' };
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-4">
            {/* LEFT: Edit Form */}
            <div className="!bg-black/20 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <User className="w-5 h-5 text-purple-400" />
                    Profil Düzenle
                </h2>

                <div className="space-y-6">
                    {/* Avatar Upload */}
                    <div className="flex items-center gap-4">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <div className={`w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-white/30 group-hover:border-purple-400 transition-colors ${!previewUrl ? 'bg-white/10 flex items-center justify-center' : ''}`}>
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <Camera className="w-8 h-8 text-white/50" />
                                )}
                            </div>
                            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Upload className="w-6 h-6 text-white" />
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">Profil Fotoğrafı</p>
                            <p className="text-xs text-gray-400">Yüzünüzün net göründüğü bir fotoğraf yükleyin.</p>
                        </div>
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Email Adresi</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                                <input
                                    type="email"
                                    value={profile.email}
                                    onChange={e => setProfile({ ...profile, email: e.target.value })}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-white placeholder-gray-600 focus:ring-1 focus:ring-purple-500 transition-all"
                                />
                            </div>
                            <p className="text-[10px] text-yellow-500/80 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Email değişikliği yönetici onayı gerektirir.
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Kod Adı (Call Sign)</label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    value={profile.nickname || ''}
                                    onChange={e => setProfile({ ...profile, nickname: e.target.value })}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-white placeholder-gray-600 focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                                    placeholder="Örn: MAVERICK"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Ad Soyad</label>
                            <input
                                type="text"
                                value={profile.full_name}
                                onChange={e => setProfile({ ...profile, full_name: e.target.value })}
                                className="w-full bg-black/20 border border-white/10 rounded-lg py-2 px-4 text-white focus:ring-1 focus:ring-purple-500 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Hakkımda / Motto</label>
                            <textarea
                                value={profile.bio || ''}
                                onChange={e => setProfile({ ...profile, bio: e.target.value })}
                                className="w-full bg-black/20 border border-white/10 rounded-lg py-2 px-4 text-white focus:ring-1 focus:ring-purple-500 transition-all h-20 resize-none"
                                placeholder="Satış benim işim..."
                            />
                        </div>

                        {/* Phone Number */}
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Telefon Numarası</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                                <input
                                    type="tel"
                                    value={profile.phone_number || ''}
                                    onChange={handlePhoneChange}
                                    maxLength={15}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-white placeholder-gray-600 focus:ring-1 focus:ring-purple-500 transition-all"
                                    placeholder="0555 123 45 67"
                                />
                            </div>
                            <p className="text-[10px] text-blue-400/60 mt-1">SMS bildirimleri için kullanılacak (Verimor)</p>
                        </div>
                    </div>

                    {/* Theme Picker */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Tema Rengi</label>
                        <div className="flex gap-3">
                            {THEME_COLORS.map(color => (
                                <button
                                    key={color.value}
                                    onClick={() => setProfile({ ...profile, theme_color: color.value })}
                                    className={`w-8 h-8 rounded-full bg-gradient-to-br ${color.from} ${color.to} border-2 transition-transform hover:scale-110 ${profile.theme_color === color.value ? 'border-white scale-110 shadow-lg shadow-' + color.value + '/50' : 'border-transparent opacity-50 hover:opacity-100'}`}
                                    title={color.name}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Password Change Section - Collapsible */}
                    <div className="border-t border-white/10 pt-4">
                        <button
                            onClick={() => setShowPasswordSection(!showPasswordSection)}
                            className="w-full flex items-center justify-between text-white hover:text-purple-400 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                <span className="text-sm font-medium">Şifre Değiştir</span>
                            </div>
                            <Lock className={`w-4 h-4 transition-transform ${showPasswordSection ? 'rotate-180' : ''}`} />
                        </button>

                        {showPasswordSection && (
                            <div className="mt-4 space-y-3 bg-black/20 p-4 rounded-lg border border-white/5">
                                {/* Current Password */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Mevcut Şifre</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                                        <input
                                            type={showCurrentPassword ? 'text' : 'password'}
                                            value={currentPassword}
                                            onChange={e => setCurrentPassword(e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-9 pr-10 text-white focus:ring-1 focus:ring-purple-500 transition-all"
                                            placeholder="********"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                            className="absolute right-3 top-2.5 text-gray-500 hover:text-white"
                                        >
                                            {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* New Password */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Yeni Şifre</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-9 pr-10 text-white focus:ring-1 focus:ring-purple-500 transition-all"
                                            placeholder="Min. 8 karakter"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-3 top-2.5 text-gray-500 hover:text-white"
                                        >
                                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    {newPassword && (
                                        <p className={`text-xs mt-1 ${getPasswordStrength(newPassword).color}`}>
                                            Güvenlik: {getPasswordStrength(newPassword).label}
                                        </p>
                                    )}
                                </div>

                                {/* Confirm Password */}
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Şifre Tekrar</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-white focus:ring-1 focus:ring-purple-500 transition-all"
                                            placeholder="Yeni şifreyi tekrar girin"
                                        />
                                    </div>
                                    {confirmPassword && newPassword !== confirmPassword && (
                                        <p className="text-xs text-red-400 mt-1">Şifreler eşleşmiyor</p>
                                    )}
                                </div>

                                {/* Password Update Button */}
                                <button
                                    onClick={handlePasswordChange}
                                    disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all"
                                >
                                    {passwordLoading ? (
                                        <img src="/loading-logo.png" alt="Loading" className="w-6 h-3 animate-pulse object-contain" />
                                    ) : (
                                        <Shield className="w-4 h-4" />
                                    )}
                                    Şifreyi Güncelle
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className={`w-full py-3 rounded-lg font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
                        style={{ background: `linear-gradient(to right, var(--tw-gradient-stops))` }} // Fallback
                    >
                        <div className={`absolute inset-0 bg-gradient-to-r ${currentTheme.from} ${currentTheme.to} rounded-lg -z-10`} />
                        {loading ? <img src="/loading-logo.png" alt="Loading" className="w-6 h-3 animate-pulse object-contain" /> : <Save className="w-4 h-4" />}
                        Değişiklikleri Kaydet
                    </button>
                </div>
            </div>

            {/* RIGHT: Preview (The ID Card) */}
            <div className="flex flex-col items-center justify-center">
                <div className="relative group perspective-1000 w-full max-w-sm">
                    {/* Card Container */}
                    <div className={`relative bg-gradient-to-br ${currentTheme.from} ${currentTheme.to} p-[1px] rounded-2xl shadow-2xl transform transition-transform duration-500 hover:rotate-y-6 hover:rotate-x-6`}>
                        <div className="absolute inset-0 blur-xl bg-purple-500/30 -z-10 rounded-2xl"></div>

                        {/* Card Content (Glass) */}
                        <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-6 h-full border-t border-white/10 relative overflow-hidden">
                            {/* Decorative Elements */}
                            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${currentTheme.from} ${currentTheme.to} opacity-10 rounded-bl-full`}></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-tr-full"></div>

                            {/* Header: Logo & Rank */}
                            <div className="flex justify-between items-start mb-6 relative z-10">
                                <div className="flex items-center gap-2">
                                    <Sparkles className={`w-5 h-5 ${currentTheme.bg.replace('bg-', 'text-')}-400`} />
                                    <span className="text-xs font-bold tracking-widest text-white/80 uppercase">TEMSİLCİ ID</span>
                                </div>
                                <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded text-xs font-mono text-white">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                    ONLINE
                                </div>
                            </div>

                            {/* Main Identity Info */}
                            <div className="text-center relative z-10">
                                <div className={`relative w-24 h-24 mx-auto mb-4 rounded-full p-1 bg-gradient-to-br ${currentTheme.from} ${currentTheme.to}`}>
                                    <img
                                        src={previewUrl || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + profile.email}
                                        alt="Avatar"
                                        className="w-full h-full rounded-full object-cover border-2 border-slate-900 bg-slate-800"
                                    />
                                    <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-black text-xs font-bold p-1 px-2 rounded-lg shadow-lg flex items-center gap-1">
                                        <Trophy className="w-3 h-3" />
                                        LVL 1
                                    </div>
                                </div>

                                <h3 className={`text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 uppercase tracking-tight`}>
                                    {profile.nickname || 'NO CALL SIGN'}
                                </h3>
                                <p className="text-sm text-gray-400 font-medium mb-1">{profile.full_name}</p>
                                <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                                    <Mail className="w-3 h-3" /> {profile.email}
                                </p>

                                {/* Bio Quote */}
                                {profile.bio && (
                                    <div className="mt-4 relative">
                                        <span className={`absolute -top-2 left-0 text-4xl leading-3 opacity-20 font-serif ${currentTheme.bg.replace('bg-', 'text-')}-400`}>"</span>
                                        <p className="text-sm italic text-gray-300 px-4">
                                            {profile.bio}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Footer Stats Mockup */}
                            <div className="mt-8 grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
                                <div className="text-center p-2 bg-white/5 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Toplam Çağrı</p>
                                    <p className="text-lg font-bold text-white">{stats.totalCalls}</p>
                                </div>
                                <div className="text-center p-2 bg-white/5 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase">Başarı</p>
                                    <p className={`text-lg font-bold ${currentTheme.bg.replace('bg-', 'text-')}-400`}>%{stats.successRate}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Reflection/Shadow */}
                    <div className="absolute top-full left-0 right-0 h-4 bg-black/20 blur-xl rounded-full mt-4 mx-4"></div>
                </div>

                <p className="text-gray-500 text-sm mt-8 animate-pulse">
                    Kart önizlemesi
                </p>
            </div>
        </div>
    );
}
