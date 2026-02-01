import { useState, useEffect } from 'react';
import { Plus, Search, User, MoreHorizontal, Shield, BadgePercent, Pencil, Trophy, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import AddMemberModal from './AddMemberModal';
import { Profile } from '@/types';

export default function TeamList() {
    const [team, setTeam] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [memberToEdit, setMemberToEdit] = useState<Profile | null>(null);

    useEffect(() => {
        loadTeam();
    }, []);

    const loadTeam = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/manager/team');
            const data = await res.json();
            if (data.team) {
                setTeam(data.team);
            }
        } catch (error) {
            console.error('Failed to load team', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredTeam = team.filter(member =>
        member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.tc_number?.includes(searchTerm)
    );

    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('tr-TR');
    };

    return (
        <div className="space-y-6">
            {/* Header / Tools */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">ArtificAgent – Marketing Ekip</h1>
                    <p className="text-gray-400">Takım üyelerini yönet, rol ve komisyon oranlarını belirle.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="İsim, email veya TC ile ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                        />
                    </div>
                    <button
                        onClick={() => { setMemberToEdit(null); setIsAddModalOpen(true); }}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" />
                        Üye Ekle
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-black/40 text-gray-400 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Ad Soyad</th>
                                <th className="px-6 py-4">T.C. Kimlik No</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Şifre</th>
                                <th className="px-6 py-4">Doğum Tarihi</th>
                                <th className="px-6 py-4">İl</th>
                                <th className="px-6 py-4">İlçe</th>
                                <th className="px-6 py-4">Rol</th>
                                <th className="px-6 py-4">Komisyon</th>
                                <th className="px-6 py-4 text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr><td colSpan={9} className="p-8 text-center text-gray-400">Yükleniyor...</td></tr>
                            ) : filteredTeam.length === 0 ? (
                                <tr><td colSpan={9} className="p-8 text-center text-gray-400">Kayıt bulunamadı.</td></tr>
                            ) : (
                                filteredTeam.map(member => (
                                    <tr key={member.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {member.avatar_url ? (
                                                    <img src={member.avatar_url} alt={member.full_name} className="w-8 h-8 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                                                        {member.full_name.charAt(0)}
                                                    </div>
                                                )}
                                                <div className="font-medium text-white">{member.full_name}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-300 font-mono text-sm">{member.tc_number || '-'}</td>
                                        <td className="px-6 py-4 text-gray-300 text-sm">{member.email}</td>
                                        <td className="px-6 py-4 text-gray-300 text-sm">
                                            <PasswordCell password={member.raw_password} />
                                        </td>
                                        <td className="px-6 py-4 text-gray-300 text-sm">{formatDate(member.birth_date)}</td>
                                        <td className="px-6 py-4 text-gray-300 text-sm">{member.city || '-'}</td>
                                        <td className="px-6 py-4 text-gray-300 text-sm">{member.district || '-'}</td>
                                        <td className="px-6 py-4">
                                            {member.role === 'founder' ? (
                                                <span className="flex items-center gap-1 text-yellow-300 text-xs font-bold uppercase bg-yellow-500/10 px-2 py-1 rounded w-fit border border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.2)]">
                                                    <Trophy className="w-3 h-3" /> FOUNDER
                                                </span>
                                            ) : member.role === 'admin' ? (
                                                <span className="flex items-center gap-1 text-red-300 text-xs font-bold uppercase bg-red-500/10 px-2 py-1 rounded w-fit border border-red-500/20">
                                                    <Shield className="w-3 h-3" /> SÜPER ADMIN
                                                </span>
                                            ) : member.role === 'manager' ? (
                                                <span className="flex items-center gap-1 text-purple-300 text-xs font-bold uppercase bg-purple-500/10 px-2 py-1 rounded w-fit border border-purple-500/20">
                                                    <Shield className="w-3 h-3" /> YÖNETİCİ
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-blue-300 text-xs font-bold uppercase bg-blue-500/10 px-2 py-1 rounded w-fit border border-blue-500/20">
                                                    <User className="w-3 h-3" /> PERSONEL
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 font-bold text-green-400">
                                                {member.commission_rate || 0}%
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => { setMemberToEdit(member); setIsAddModalOpen(true); }}
                                                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (window.confirm(`${member.full_name} isimli kullanıcıyı silmek istediğinize emin misiniz?`)) {
                                                        try {
                                                            const res = await fetch(`/api/manager/team/delete?id=${member.id}`, { method: 'DELETE' });
                                                            if (!res.ok) {
                                                                const data = await res.json();
                                                                throw new Error(data.error || 'Silme işlemi başarısız');
                                                            }
                                                            toast.success('Kullanıcı başarıyla silindi');
                                                            loadTeam();
                                                        } catch (error: any) {
                                                            toast.error(error.message);
                                                        }
                                                    }
                                                }}
                                                className="p-2 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-colors ml-1"
                                                title="Sil"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <AddMemberModal
                isOpen={isAddModalOpen}
                onClose={() => { setIsAddModalOpen(false); setMemberToEdit(null); }}
                onSuccess={loadTeam}
                memberToEdit={memberToEdit}
            />
        </div>
    );
}

function PasswordCell({ password }: { password?: string }) {
    const [isVisible, setIsVisible] = useState(false);

    if (!password) return <span className="text-gray-500 italic">Yok</span>;

    return (
        <div className="flex items-center gap-2">
            <span className="font-mono text-xs">
                {isVisible ? password : '••••••••'}
            </span>
            <button
                onClick={() => setIsVisible(!isVisible)}
                className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                title={isVisible ? "Gizle" : "Göster"}
            >
                {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
        </div>
    );
}
