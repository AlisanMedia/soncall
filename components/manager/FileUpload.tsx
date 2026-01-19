'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileUp, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { parseGoogleMapsCSV, validateCSVStructure } from '@/lib/parsers/csv-parser';
import type { Lead } from '@/types';

interface FileUploadProps {
    onUploadSuccess: (batchId: string, totalLeads: number) => void;
}

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
    const [file, setFile] = useState<File | null>(null);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState(false);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const uploadedFile = acceptedFiles[0];
        if (!uploadedFile) return;

        setError(null);
        setFile(uploadedFile);
        setPreviewMode(true);

        try {
            // Validate CSV structure
            const isValid = await validateCSVStructure(uploadedFile);
            if (!isValid) {
                setError('CSV dosyası geçerli değil. En az "Business Name" ve "Phone" kolonları gerekli.');
                setPreviewMode(false);
                return;
            }

            // Parse CSV
            const parsedLeads = await parseGoogleMapsCSV(uploadedFile);
            if (parsedLeads.length === 0) {
                setError('CSV dosyası boş veya hiçbir geçerli lead içermiyor.');
                setPreviewMode(false);
                return;
            }

            setLeads(parsedLeads);
        } catch (err: any) {
            setError(err.message || 'Dosya işlenirken bir hata oluştu');
            setPreviewMode(false);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.ms-excel': ['.csv'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
        },
        maxFiles: 1,
        disabled: uploading,
    });

    const handleConfirmUpload = async () => {
        if (!file || leads.length === 0) return;

        setUploading(true);
        setError(null);

        try {
            // Upload to API
            const formData = new FormData();
            formData.append('file', file);
            formData.append('leadsData', JSON.stringify(leads));

            const response = await fetch('/api/leads/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Upload failed');
            }

            // Success
            onUploadSuccess(data.batchId, data.totalLeads);
        } catch (err: any) {
            setError(err.message || 'Upload sırasında bir hata oluştu');
        } finally {
            setUploading(false);
        }
    };

    const handleReset = () => {
        setFile(null);
        setLeads([]);
        setPreviewMode(false);
        setError(null);
    };

    if (previewMode && leads.length > 0) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold text-white">Lead Önizleme</h2>
                        <p className="text-purple-200 mt-1">
                            {file?.name} - {leads.length} lead bulundu
                        </p>
                    </div>
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                    >
                        Yeni Dosya Yükle
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/20 border border-red-500/50 text-red-100 px-4 py-3 rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                    </div>
                )}

                {/* Preview Table */}
                <div className="bg-white/5 rounded-lg overflow-hidden border border-white/10">
                    <div className="overflow-x-auto max-h-96">
                        <table className="w-full">
                            <thead className="bg-white/10 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-purple-200">İşletme Adı</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-purple-200">Telefon</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-purple-200">Adres</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-purple-200">Kategori</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {leads.slice(0, 10).map((lead, idx) => (
                                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3 text-sm text-white">{lead.business_name}</td>
                                        <td className="px-4 py-3 text-sm text-purple-200">{lead.phone_number}</td>
                                        <td className="px-4 py-3 text-sm text-purple-300 truncate max-w-xs">{lead.address}</td>
                                        <td className="px-4 py-3 text-sm text-purple-300">{lead.category}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {leads.length > 10 && (
                        <div className="bg-white/5 px-4 py-2 text-sm text-purple-300 text-center">
                            ... ve {leads.length - 10} lead daha
                        </div>
                    )}
                </div>

                {/* Confirm Button */}
                <button
                    onClick={handleConfirmUpload}
                    disabled={uploading}
                    className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
                >
                    {uploading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Yükleniyor...
                        </>
                    ) : (
                        <>
                            <CheckCircle2 className="w-5 h-5" />
                            {leads.length} Lead'i Onayla ve Yükle
                        </>
                    )}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-semibold text-white">CSV Dosyası Yükle</h2>
                <p className="text-purple-200 mt-1">
                    Google Maps'ten çekilen lead verilerinizi yükleyin
                </p>
            </div>

            {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-100 px-4 py-3 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {/* Dropzone */}
            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${isDragActive
                        ? 'border-purple-400 bg-purple-500/20'
                        : 'border-white/30 hover:border-purple-400 hover:bg-white/5'
                    }`}
            >
                <input {...getInputProps()} />

                <div className="flex flex-col items-center gap-4">
                    {isDragActive ? (
                        <FileUp className="w-16 h-16 text-purple-300 animate-bounce" />
                    ) : (
                        <Upload className="w-16 h-16 text-purple-300" />
                    )}

                    <div>
                        <p className="text-lg font-medium text-white mb-1">
                            {isDragActive ? 'Dosyayı buraya bırakın...' : 'CSV dosyasını sürükleyip bırakın'}
                        </p>
                        <p className="text-sm text-purple-200">
                            veya tıklayarak dosya seçin
                        </p>
                    </div>

                    <div className="mt-4 text-xs text-purple-300 space-y-1">
                        <p>Kabul edilen formatlar: .csv, .xlsx</p>
                        <p>Gerekli kolonlar: Business Name, Phone Number</p>
                    </div>
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-purple-300 text-sm mb-1">Format</div>
                    <div className="text-white font-semibold">Google Maps CSV</div>
                </div>
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-purple-300 text-sm mb-1">Max Boyut</div>
                    <div className="text-white font-semibold">10 MB</div>
                </div>
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-purple-300 text-sm mb-1">Test Modu</div>
                    <div className="text-white font-semibold">Önizleme Aktif</div>
                </div>
            </div>
        </div>
    );
}
