'use client';

import { useState } from 'react';
import { Profile } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { Save, Lock, User, Mail, Phone, MapPin, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface ProfileSettingsProps {
    profile: Profile;
}

export default function ProfileSettings({ profile }: ProfileSettingsProps) {
    const supabase = createClient();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Profile State
    const [formData, setFormData] = useState({
        full_name: profile.full_name || '',
        email: profile.email || '', // Read only usually
        phone_number: profile.phone_number || '',
        bio: profile.bio || '',
        city: profile.city || '',
        district: profile.district || ''
    });

    // Password State
    const [passwordData, setPasswordData] = useState({
        newPassword: '',
        confirmPassword: ''
    });

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: formData.full_name,
                    phone_number: formData.phone_number,
                    bio: formData.bio,
                    city: formData.city,
                    district: formData.district,
                    updated_at: new Date().toISOString()
                })
                .eq('id', profile.id);

            if (error) throw error;
            setMessage({ type: 'success', text: 'Profil bilgileri başarıyla güncellendi.' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Güncelleme hatası.' });
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ type: 'error', text: 'Şifreler eşleşmiyor.' });
            return;
        }
        if (passwordData.newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Şifre en az 6 karakter olmalıdır.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.updateUser({
                password: passwordData.newPassword
            });

            if (error) throw error;
            setMessage({ type: 'success', text: 'Şifreniz başarıyla değiştirildi.' });
            setPasswordData({ newPassword: '', confirmPassword: '' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Şifre değiştirme hatası.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <User className="w-6 h-6 text-purple-400" />
                Profil Ayarları
            </h2>

            {message && (
                <div className={`p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-500/10 text-green-200 border border-green-500/20' : 'bg-red-500/10 text-red-200 border border-red-500/20'}`}>
                    {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Personal Info Card */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                            <User className="w-5 h-5 text-purple-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">Kişisel Bilgiler</h3>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-purple-200 mb-1">Ad Soyad</label>
                            <input
                                type="text"
                                value={formData.full_name}
                                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-purple-200 mb-1">E-posta (Değiştirilemez)</label>
                            <div className="flex items-center gap-2 bg-black/20 border border-white/5 rounded-lg px-4 py-2 text-gray-400 cursor-not-allowed">
                                <Mail className="w-4 h-4" />
                                {formData.email}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-purple-200 mb-1">Telefon</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="tel"
                                    value={formData.phone_number}
                                    onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                    placeholder="+90 5XX XXX XX XX"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-purple-200 mb-1">İl</label>
                                <input
                                    type="text"
                                    value={formData.city}
                                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-purple-200 mb-1">İlçe</label>
                                <input
                                    type="text"
                                    value={formData.district}
                                    onChange={e => setFormData({ ...formData, district: e.target.value })}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-purple-200 mb-1">Biyografi / Notlar</label>
                            <textarea
                                value={formData.bio}
                                onChange={e => setFormData({ ...formData, bio: e.target.value })}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none h-24 resize-none"
                                placeholder="Kendiniz hakkında kısa bir not..."
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Bilgileri Kaydet
                        </button>
                    </form>
                </div>

                {/* Password Change Card */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm h-fit">
                    <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                        <div className="p-2 bg-orange-500/20 rounded-lg">
                            <Lock className="w-5 h-5 text-orange-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">Şifre Değiştir</h3>
                    </div>

                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-purple-200 mb-1">Yeni Şifre</label>
                            <input
                                type="password"
                                value={passwordData.newPassword}
                                onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="••••••••"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-purple-200 mb-1">Yeni Şifre (Tekrar)</label>
                            <input
                                type="password"
                                value={passwordData.confirmPassword}
                                onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="••••••••"
                            />
                        </div>

                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 text-xs text-orange-200/80">
                            Güvenliğiniz için şifrenizi kimseyle paylaşmayın. Şifre en az 6 karakter olmalıdır.
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !passwordData.newPassword}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                            Şifreyi Güncelle
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
