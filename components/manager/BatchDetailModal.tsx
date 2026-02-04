import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Filter, ArrowUpDown, Download, Loader2, User, Phone, Briefcase } from 'lucide-react';

interface BatchDetailModalProps {
    batchId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

interface Lead {
    id: string;
    business_name: string;
    phone_number: string;
    status: string;
    potential_level: string;
    updated_at: string;
    profiles_assigned?: {
        full_name: string;
    } | null;
}

interface BatchInfo {
    filename: string;
    created_at: string;
}

export default function BatchDetailModal({ batchId, isOpen, onClose }: BatchDetailModalProps) {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [batchInfo, setBatchInfo] = useState<BatchInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        if (isOpen && batchId) {
            loadBatchData();
        } else {
            // Reset state on close
            setLeads([]);
            setBatchInfo(null);
            setSearchTerm('');
            setStatusFilter('all');
            setCurrentPage(1);
        }
    }, [isOpen, batchId, currentPage, statusFilter]);

    // Construct URL based on state
    const loadBatchData = async () => {
        if (!batchId) return;
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                page: String(currentPage),
                limit: '20', // Table page size
                status: statusFilter,
                search: searchTerm
            });

            const res = await fetch(`/api/manager/batches/${batchId}?${queryParams.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setLeads(data.data || []);
                setBatchInfo(data.meta.batch_info);
                setTotalPages(data.meta.total_pages);
                setTotalRecords(data.meta.total_records);
            }
        } catch (error) {
            console.error('Failed to load batch detail:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setCurrentPage(1); // Reset to first page on new search
        loadBatchData();
    };

    const handleExport = async () => {
        if (!batchId) return;
        setIsExporting(true);
        try {
            // Trigger download via window.location or fetch+blob
            // Fetch/Blob is better to handle Auth headers if needed, but since it's same-origin cookie based:
            // Direct link usage:
            const exportUrl = `/api/manager/batches/${batchId}/export?status=${statusFilter}`;

            // Create a temporary link to force download
            const link = document.createElement('a');
            link.href = exportUrl;
            link.setAttribute('download', 'batch_export.csv'); // Filename is usually set by header but this helps fallback
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);

        } catch (error) {
            console.error('Export failed:', error);
            alert('İndirme başlatılamadı.');
        } finally {
            setIsExporting(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'appointment': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
            case 'completed': return 'text-green-400 bg-green-500/10 border-green-500/20';
            case 'pending': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
            case 'not_interested': return 'text-red-400 bg-red-500/10 border-red-500/20';
            default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#0f172a] border border-slate-700 rounded-xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-slate-900/50">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Briefcase className="w-5 h-5 text-purple-400" />
                                {batchInfo?.filename || 'Batch Detayları'}
                            </h2>
                            <p className="text-sm text-slate-400 mt-1">
                                {batchInfo?.created_at && new Date(batchInfo.created_at).toLocaleDateString()} • {totalRecords} kayıt
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleExport}
                                disabled={isExporting}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                Excel/CSV İndir
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Filters & Toolbar */}
                    <div className="p-4 border-b border-slate-700/50 flex gap-4 bg-slate-900/30">
                        <form onSubmit={handleSearch} className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="İsim, Telefon veya Firma ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                            />
                        </form>

                        <div className="w-48">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                            >
                                <option value="all">Tüm Durumlar</option>
                                <option value="pending">Bekleyen (Pending)</option>
                                <option value="appointment">Randevu (Appointment)</option>
                                <option value="contacted">Ulaşıldı (Contacted)</option>
                                <option value="not_interested">İlgilenmiyor</option>
                            </select>
                        </div>
                    </div>

                    {/* Table Content */}
                    <div className="flex-1 overflow-auto p-4 max-h-screen">
                        {loading && leads.length === 0 ? (
                            <div className="flex h-full items-center justify-center">
                                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-800/50 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Müşteri / İşletme</th>
                                        <th className="p-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Telefon</th>
                                        <th className="p-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Durum</th>
                                        <th className="p-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Temsilci</th>
                                        <th className="p-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Son İşlem</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {leads.map((lead) => (
                                        <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="p-3">
                                                <div className="font-medium text-white">{lead.business_name || 'İsimsiz'}</div>
                                                <div className="text-xs text-slate-500">ID: {lead.id.slice(0, 8)}</div>
                                            </td>
                                            <td className="p-3 text-sm text-slate-300 font-mono">
                                                {lead.phone_number}
                                            </td>
                                            <td className="p-3">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(lead.status)}`}>
                                                    {lead.status}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white">
                                                        <User className="w-3 h-3" />
                                                    </div>
                                                    <span className="text-sm text-slate-300">
                                                        {lead.profiles_assigned?.full_name || <span className="text-slate-500 italic">Atanmamış</span>}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-sm text-slate-400">
                                                {new Date(lead.updated_at).toLocaleString('tr-TR')}
                                            </td>
                                        </tr>
                                    ))}

                                    {leads.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-slate-500">
                                                Kayıt bulunamadı.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination Footer */}
                    <div className="p-4 border-t border-slate-700/50 bg-slate-900/50 flex items-center justify-between">
                        <div className="text-sm text-slate-400">
                            Sayfa <span className="font-medium text-white">{currentPage}</span> / {totalPages}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1 || loading}
                                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-sm text-white disabled:opacity-50 transition-colors"
                            >
                                Önceki
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || loading}
                                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-sm text-white disabled:opacity-50 transition-colors"
                            >
                                Sonraki
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
