
'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Plus, Search, User, Building, Phone, MoreVertical, Edit2, Trash2, Save, X } from 'lucide-react';
import { GlassButton } from '@/components/ui/glass-button';
import { SectionInfo } from '@/components/ui/section-info';
import { toast } from 'sonner';

interface Contact {
    id: string;
    full_name: string;
    phone_number: string;
    title?: string;
    company?: string;
    notes?: string;
    created_at: string;
}

export default function Contacts() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentContact, setCurrentContact] = useState<Partial<Contact>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchContacts();
    }, []);

    const fetchContacts = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/manager/contacts');
            const data = await res.json();
            if (data.contacts) {
                setContacts(data.contacts);
            }
        } catch (error) {
            console.error('Error fetching contacts:', error);
            toast.error('Rehber yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!currentContact.full_name || !currentContact.phone_number) {
            toast.warning('Ad Soyad ve Telefon zorunludur');
            return;
        }

        setIsSaving(true);
        try {
            const method = isEditing ? 'PUT' : 'POST';
            const res = await fetch('/api/manager/contacts', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentContact)
            });
            const data = await res.json();

            if (data.contact) {
                toast.success(isEditing ? 'Kişi güncellendi' : 'Kişi eklendi');
                setIsModalOpen(false);
                fetchContacts();
            } else {
                toast.error(data.error || 'Hata oluştu');
            }
        } catch (error) {
            console.error(error);
            toast.error('Kaydedilemedi');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bu kişiyi silmek istediğinize emin misiniz?')) return;

        try {
            const res = await fetch(`/api/manager/contacts?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Kişi silindi');
                setContacts(prev => prev.filter(c => c.id !== id));
            } else {
                toast.error('Silinemedi');
            }
        } catch (error) {
            toast.error('Silme hatası');
        }
    };

    const openAddModal = () => {
        setCurrentContact({});
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const openEditModal = (contact: Contact) => {
        setCurrentContact(contact);
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const filteredContacts = contacts.filter(c =>
        c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone_number.includes(searchTerm) ||
        (c.company && c.company.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6 relative">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-2">
                        <User className="w-6 h-6 text-blue-400" />
                        <h2 className="text-xl font-bold text-white">VIP Kişiler</h2>
                        <SectionInfo text="Genel Müdürler ve özel kontaklarınızı yönetin." />
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative hidden md:block">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Kişi Ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-black/20 border border-white/10 rounded-full pl-9 pr-4 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50 w-64 transition-all"
                            />
                        </div>

                        <GlassButton onClick={openAddModal} className="flex items-center gap-2 px-4 py-2 bg-blue-600/50 hover:bg-blue-600/70 text-white">
                            <Plus className="w-4 h-4" />
                            Kişi Ekle
                        </GlassButton>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {loading ? (
                        <div className="col-span-full py-12 text-center text-gray-400">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                            Yükleniyor...
                        </div>
                    ) : filteredContacts.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-gray-500 bg-white/5 rounded-xl border border-white/5 border-dashed">
                            Kayıtlı kişi bulunamadı.
                        </div>
                    ) : (
                        filteredContacts.map(contact => (
                            <div key={contact.id} className="bg-black/20 border border-white/10 rounded-xl p-4 hover:bg-black/30 transition-all group relative">
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEditModal(contact)} className="p-1.5 bg-white/10 rounded-full hover:bg-white/20 text-blue-300">
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDelete(contact.id)} className="p-1.5 bg-white/10 rounded-full hover:bg-red-500/20 text-red-400">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white font-bold">
                                        {contact.full_name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-white">{contact.full_name}</div>
                                        <div className="text-xs text-blue-300">{contact.title || 'Ünvan Yok'}</div>
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm text-gray-400">
                                    <div className="flex items-center gap-2">
                                        <Building className="w-3.5 h-3.5 text-gray-500" />
                                        <span>{contact.company || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-3.5 h-3.5 text-gray-500" />
                                        <span className="font-mono text-gray-300">{contact.phone_number}</span>
                                    </div>
                                </div>

                                {contact.notes && (
                                    <div className="mt-3 pt-3 border-t border-white/5 text-xs text-gray-500 italic">
                                        "{contact.notes}"
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ADD/EDIT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6 relative animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-xl font-bold text-white mb-6">
                            {isEditing ? 'Kişiyi Düzenle' : 'Yeni Kişi Ekle'}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Ad Soyad *</label>
                                <input
                                    type="text"
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:border-blue-500/50 outline-none"
                                    value={currentContact.full_name || ''}
                                    onChange={e => setCurrentContact({ ...currentContact, full_name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Telefon *</label>
                                <input
                                    type="text"
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:border-blue-500/50 outline-none"
                                    value={currentContact.phone_number || ''}
                                    onChange={e => setCurrentContact({ ...currentContact, phone_number: e.target.value })}
                                    placeholder="05..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Şirket</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:border-blue-500/50 outline-none"
                                        value={currentContact.company || ''}
                                        onChange={e => setCurrentContact({ ...currentContact, company: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Ünvan</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:border-blue-500/50 outline-none"
                                        value={currentContact.title || ''}
                                        onChange={e => setCurrentContact({ ...currentContact, title: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Notlar</label>
                                <textarea
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:border-blue-500/50 outline-none resize-none h-20"
                                    value={currentContact.notes || ''}
                                    onChange={e => setCurrentContact({ ...currentContact, notes: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
