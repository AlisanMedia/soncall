'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, User, MapPin, BadgePercent, Building, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Profile } from '@/types';

interface AddMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    memberToEdit?: Profile | null;
}

export default function AddMemberModal({ isOpen, onClose, onSuccess, memberToEdit }: AddMemberModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: '',
        tcNumber: '',
        birthDate: '',
        city: '',
        district: '',
        role: 'agent',
        commissionRate: '0'
    });

    // Reset or Populate form on open
    useEffect(() => {
        if (isOpen) {
            if (memberToEdit) {
                setFormData({
                    email: memberToEdit.email || '',
                    password: '', // Password not editable here
                    fullName: memberToEdit.full_name || '',
                    tcNumber: memberToEdit.tc_number || '',
                    birthDate: memberToEdit.birth_date ? new Date(memberToEdit.birth_date).toISOString().split('T')[0] : '',
                    city: memberToEdit.city || '',
                    district: memberToEdit.district || '',
                    role: memberToEdit.role || 'agent',
                    commissionRate: memberToEdit.commission_rate?.toString() || '0'
                });
            } else {
                setFormData({
                    email: '',
                    password: '',
                    fullName: '',
                    tcNumber: '',
                    birthDate: '',
                    city: '',
                    district: '',
                    role: 'agent',
                    commissionRate: '0'
                });
            }
        }
    }, [isOpen, memberToEdit]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const isEdit = !!memberToEdit;
            const url = isEdit ? '/api/manager/team/update' : '/api/manager/team/create';
            const method = isEdit ? 'PUT' : 'POST';

            const body = isEdit ? { ...formData, id: memberToEdit.id } : formData;

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'İşlem başarısız');

            toast.success(isEdit ? 'Bilgiler güncellendi ✅' : 'Takım üyesi başarıyla eklendi 🎉');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a2e] border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <h2 className="text-xl font-bold text-white">{memberToEdit ? 'Üye Düzenle' : 'Yeni Takım Üyesi Ekle'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                    {/* Account Info - ONLY FOR NEW MEMBERS */}
                    {!memberToEdit && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wider">Hesap Bilgileri</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">E-posta</label>
                                    <input
                                        required
                                        type="email"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Şifre</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Personal Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wider">Kişisel Bilgiler</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs text-gray-400 mb-1">Ad Soyad</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                    value={formData.fullName}
                                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">T.C. Kimlik No</label>
                                <input
                                    required
                                    type="text"
                                    maxLength={11}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                    value={formData.tcNumber}
                                    onChange={e => setFormData({ ...formData, tcNumber: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Doğum Tarihi</label>
                                <input
                                    required
                                    type="date"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                    value={formData.birthDate}
                                    onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">İl</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                    value={formData.city}
                                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">İlçe</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                    value={formData.district}
                                    onChange={e => setFormData({ ...formData, district: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Role & Commission */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wider">Rol & Prim</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Rol</label>
                                <select
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="agent">Personel (Satış Temsilcisi)</option>
                                    <option value="manager">Yönetici / Partner</option>
                                    <option value="admin">Süper Admin</option>
                                    <option value="founder">Kurucu (Founder)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Komisyon Oranı (%)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                    value={formData.commissionRate}
                                    onChange={e => setFormData({ ...formData, commissionRate: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Kaydet
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
