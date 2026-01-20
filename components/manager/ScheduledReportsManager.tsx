'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Mail, Clock, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ScheduledReportsManager({ managerId }: { managerId: string }) {
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [sendingTestId, setSendingTestId] = useState<string | null>(null);

    const [newReport, setNewReport] = useState({
        title: 'Günlük Özet Raporu',
        report_type: 'daily_digest',
        recipients: '',
        time: '18:00'
    });

    const supabase = createClient();

    useEffect(() => {
        loadReports();
    }, []);

    const loadReports = async () => {
        try {
            const { data } = await supabase
                .from('scheduled_reports')
                .select('*')
                .eq('manager_id', managerId)
                .order('created_at', { ascending: false });

            if (data) setReports(data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        try {
            const recipientList = newReport.recipients.split(',').map(e => ({ email: e.trim() })).filter(e => e.email);
            if (recipientList.length === 0) return alert('Alıcı giriniz');

            const { error } = await supabase.from('scheduled_reports').insert({
                manager_id: managerId,
                title: newReport.title,
                report_type: newReport.report_type,
                recipients: recipientList,
                schedule_config: { frequency: 'daily', time: newReport.time, timezone: 'Europe/Istanbul' },
                is_active: true
            });

            if (error) throw error;
            setIsCreating(false);
            loadReports();
        } catch (error: any) {
            alert('Hata: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Silmek istediğinize emin misiniz?')) return;
        await supabase.from('scheduled_reports').delete().eq('id', id);
        loadReports();
    };

    const handleSendTest = async (id: string) => {
        setSendingTestId(id);
        try {
            const res = await fetch('/api/reports/trigger', {
                method: 'POST',
                body: JSON.stringify({ reportId: id })
            });
            const data = await res.json();
            alert(data.success ? 'Test raporu gönderildi!' : 'Hata: ' + data.error);
        } catch (e) {
            alert('Hata oluştu');
        } finally {
            setSendingTestId(null);
        }
    };

    if (loading) return <div className="p-8 text-center text-purple-200">Yükleniyor...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-bold text-white">Otomatik Raporlar</h3>
                    <p className="text-purple-300 text-sm">Düzenli e-posta raporlarını yönetin</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" /> Yeni Rapor
                </button>
            </div>

            {isCreating && (
                <div className="bg-white/10 border border-white/20 rounded-xl p-6 mb-6">
                    <h4 className="text-lg font-semibold text-white mb-4">Yeni Rapor Planla</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-purple-200 text-sm mb-1">Başlık</label>
                            <input
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white"
                                value={newReport.title}
                                onChange={e => setNewReport({ ...newReport, title: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-purple-200 text-sm mb-1">Tip</label>
                            <select
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white"
                                value={newReport.report_type}
                                onChange={e => setNewReport({ ...newReport, report_type: e.target.value })}
                            >
                                <option value="daily_digest">Günlük Özet</option>
                                <option value="weekly_performance">Haftalık Performans</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-purple-200 text-sm mb-1">Alıcılar (Virgülle)</label>
                            <input
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white"
                                value={newReport.recipients}
                                onChange={e => setNewReport({ ...newReport, recipients: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-purple-200 text-sm mb-1">Saat</label>
                            <input
                                type="time"
                                className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white"
                                value={newReport.time}
                                onChange={e => setNewReport({ ...newReport, time: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setIsCreating(false)} className="text-purple-300">İptal</button>
                        <button onClick={handleCreate} className="bg-green-600 text-white px-6 py-2 rounded-lg">Kaydet</button>
                    </div>
                </div>
            )}

            <div className="grid gap-4">
                {reports.map((report: any) => (
                    <div key={report.id} className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-purple-500/20 text-purple-300 rounded-lg"><Clock className="w-6 h-6" /></div>
                            <div>
                                <h4 className="text-lg font-bold text-white">{report.title}</h4>
                                <div className="text-sm text-purple-300/80 mt-1">
                                    <Mail className="w-3 h-3 inline mr-1" />
                                    {report.recipients.map((r: any) => r.email).join(', ')}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleSendTest(report.id)}
                                disabled={sendingTestId === report.id}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center gap-2"
                            >
                                {sendingTestId === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Test Gönder
                            </button>
                            <button onClick={() => handleDelete(report.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
