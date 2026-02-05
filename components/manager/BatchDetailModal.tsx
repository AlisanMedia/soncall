import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Filter, ArrowUpDown, Download, Loader2, User, Phone, Briefcase, RotateCcw, CheckSquare, Square } from 'lucide-react';

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
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
    const [showResetDialog, setShowResetDialog] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

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
            setSelectedLeads([]);
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

    const handleResetToPool = async () => {
        if (!batchId) return;
        setIsResetting(true);
        try {
            const res = await fetch(`/api/manager/batches/${batchId}/reset-to-pool`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lead_ids: selectedLeads,
                    reset_potential: false
                })
            });

            if (res.ok) {
                const data = await res.json();
                alert(data.message); // Simple alert, can be replaced with toast
                setSelectedLeads([]);
                setShowResetDialog(false);
                loadBatchData(); // Refresh data
            } else {
                alert('Havuza aktarma başarısız');
            }
        } catch (error) {
            console.error('Reset error:', error);
            alert('Bir hata oluştu');
        } finally {
            setIsResetting(false);
        }
    };

    const toggleLeadSelection = (leadId: string) => {
        setSelectedLeads(prev =>
            prev.includes(leadId)
                ? prev.filter(id => id !== leadId)
                : [...prev, leadId]
        );
    };

    const handleSelectAll = () => {
        if (selectedLeads.length === leads.length) {
            setSelectedLeads([]);
        } else {
            setSelectedLeads(leads.map(l => l.id));
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
            <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#0f172a] border-0 sm:border border-slate-700 rounded-none sm:rounded-xl w-full h-full sm:h-[85vh] sm:max-w-5xl flex flex-col shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-6 border-b border-slate-700/50 bg-slate-900/50 gap-3">
                        <div className="flex-1 min-w-0">
                            <h2 className="text-base sm:text-xl font-bold text-white flex items-center gap-2 truncate">
                                <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 flex-shrink-0" />
                                <span className="truncate">{batchInfo?.filename || 'Batch Detayları'}</span>
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-400 mt-1">
                                {batchInfo?.created_at && new Date(batchInfo.created_at).toLocaleDateString()} • {totalRecords} kayıt
                            </p>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                            {selectedLeads.length > 0 && (
                                <button
                                    onClick={() => setShowResetDialog(true)}
                                    className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white rounded-lg text-xs sm:text-sm font-medium transition-all touch-target"
                                >
                                    <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    Havuza Aktar ({selectedLeads.length})
                                </button>
                            )}
                            <button
                                onClick={handleExport}
                                disabled={isExporting}
                                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 active:scale-95 text-white rounded-lg text-xs sm:text-sm font-medium transition-all disabled:opacity-50 touch-target"
                            >
                                {isExporting ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                                <span className="hidden sm:inline">Excel/CSV</span> İndir
                            </button>
                            <button
                                onClick={onClose}
                                className="p-1.5 sm:p-2 hover:bg-slate-800 active:scale-95 rounded-lg text-slate-400 hover:text-white transition-all touch-target"
                            >
                                <X className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Filters & Toolbar */}
                    <div className="p-3 sm:p-4 border-b border-slate-700/50 flex flex-col sm:flex-row gap-2 sm:gap-4 bg-slate-900/30">
                        <form onSubmit={handleSearch} className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500 touch-target"
                            />
                        </form>

                        <div className="w-full sm:w-48">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500 touch-target"
                            >
                                <option value="all">Tüm Durumlar</option>
                                <option value="pending">Bekleyen</option>
                                <option value="appointment">Randevu</option>
                                <option value="contacted">Ulaşıldı</option>
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
                                        <th className="p-2 sm:p-3 w-12">
                                            <button
                                                onClick={handleSelectAll}
                                                className="text-slate-400 hover:text-white transition-colors"
                                                title={selectedLeads.length === leads.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
                                            >
                                                {selectedLeads.length === leads.length && leads.length > 0 ? (
                                                    <CheckSquare className="w-4 h-4" />
                                                ) : (
                                                    <Square className="w-4 h-4" />
                                                )}
                                            </button>
                                        </th>
                                        <th className="p-2 sm:p-3 text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider text-left">Müşteri</th>
                                        <th className="p-2 sm:p-3 text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">Telefon</th>
                                        <th className="p-2 sm:p-3 text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider text-left">Durum</th>
                                        <th className="p-2 sm:p-3 text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider hidden lg:table-cell">Temsilci</th>
                                        <th className="p-2 sm:p-3 text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {leads.map((lead) => (
                                        <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors text-xs sm:text-sm">
                                            <td className="p-2 sm:p-3">
                                                <button
                                                    onClick={() => toggleLeadSelection(lead.id)}
                                                    className="text-slate-400 hover:text-white transition-colors"
                                                >
                                                    {selectedLeads.includes(lead.id) ? (
                                                        <CheckSquare className="w-4 h-4 text-orange-400" />
                                                    ) : (
                                                        <Square className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </td>
                                            <td className="p-2 sm:p-3">
                                                <div className="font-medium text-white text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">{lead.business_name || 'İsimsiz'}</div>
                                                <div className="text-[10px] sm:text-xs text-slate-500 md:hidden font-mono">{lead.phone_number}</div>
                                            </td>
                                            <td className="p-2 sm:p-3 text-xs sm:text-sm text-slate-300 font-mono hidden md:table-cell">
                                                {lead.phone_number}
                                            </td>
                                            <td className="p-2 sm:p-3">
                                                <span className={`inline-flex items-center px-1.5 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium border ${getStatusColor(lead.status)} truncate max-w-[80px] sm:max-w-none`}>
                                                    {lead.status.slice(0, 3)}<span className="hidden sm:inline">{lead.status.slice(3)}</span>
                                                </span>
                                            </td>
                                            <td className="p-2 sm:p-3 hidden lg:table-cell">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white flex-shrink-0">
                                                        <User className="w-3 h-3" />
                                                    </div>
                                                    <span className="text-xs sm:text-sm text-slate-300 truncate">
                                                        {lead.profiles_assigned?.full_name || <span className="text-slate-500 italic">Atanmamış</span>}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-2 sm:p-3 text-[10px] sm:text-sm text-slate-400 hidden sm:table-cell">
                                                <div className="hidden lg:block">{new Date(lead.updated_at).toLocaleString('tr-TR')}</div>
                                                <div className="lg:hidden">{new Date(lead.updated_at).toLocaleDateString('tr-TR')}</div>
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
                    <div className="p-3 sm:p-4 border-t border-slate-700/50 bg-slate-900/50 flex items-center justify-between gap-2">
                        <div className="text-xs sm:text-sm text-slate-400">
                            <span className="hidden sm:inline">Sayfa </span><span className="font-medium text-white">{currentPage}</span> / {totalPages}
                        </div>
                        <div className="flex gap-1.5 sm:gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1 || loading}
                                className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-600 rounded text-xs sm:text-sm text-white disabled:opacity-50 transition-all touch-target"
                            >
                                <span className="hidden sm:inline">Önceki</span><span className="sm:hidden">←</span>
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || loading}
                                className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-600 rounded text-xs sm:text-sm text-white disabled:opacity-50 transition-all touch-target"
                            >
                                <span className="hidden sm:inline">Sonraki</span><span className="sm:hidden">→</span>
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Reset Confirmation Dialog */}
                {showResetDialog && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md mx-4 shadow-2xl"
                        >
                            <h3 className="text-xl font-bold text-white mb-4">Havuza Aktarma Onayı</h3>
                            <p className="text-slate-300 mb-6">
                                Seçili <span className="text-orange-400 font-bold">{selectedLeads.length} lead</span> havuza aktarılacak:
                            </p>
                            <ul className="space-y-2 mb-6 text-sm text-slate-400">
                                <li className="flex items-center gap-2">
                                    <span className="text-green-400">✓</span> Status: <span className="text-yellow-300">pending</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-green-400">✓</span> Assignment kaldırılacak
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-green-400">✓</span> Lock kaldırılacak
                                </li>
                            </ul>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleResetToPool}
                                    disabled={isResetting}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                                >
                                    {isResetting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            İşleniyor...
                                        </>
                                    ) : (
                                        <>
                                            <RotateCcw className="w-4 h-4" />
                                            Onayla
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => setShowResetDialog(false)}
                                    disabled={isResetting}
                                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                                >
                                    İptal
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </div>
        </AnimatePresence>
    );
}
