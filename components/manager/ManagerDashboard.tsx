'use client';

import { useState } from 'react';
import { Profile } from '@/types';
import { LogOut, Upload, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import FileUpload from './FileUpload';
import LeadDistribution from './LeadDistribution';

interface ManagerDashboardProps {
    profile: Profile;
}

type Step = 'upload' | 'distribute';

export default function ManagerDashboard({ profile }: ManagerDashboardProps) {
    const [currentStep, setCurrentStep] = useState<Step>('upload');
    const [batchId, setBatchId] = useState<string | null>(null);
    const [totalLeads, setTotalLeads] = useState(0);
    const supabase = createClient();
    const router = useRouter();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const handleUploadSuccess = (newBatchId: string, count: number) => {
        setBatchId(newBatchId);
        setTotalLeads(count);
        setCurrentStep('distribute');
    };

    const handleDistributionComplete = () => {
        // Reset to upload step for next batch
        setCurrentStep('upload');
        setBatchId(null);
        setTotalLeads(0);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Header */}
            <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-white">ArtificAgent</h1>
                            <p className="text-sm text-purple-200">Manager Dashboard</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-sm text-purple-200">Hoş geldiniz,</p>
                                <p className="font-semibold text-white">{profile.full_name}</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                                title="Çıkış Yap"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Step Indicator */}
                <div className="mb-8">
                    <div className="flex items-center justify-center gap-4">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${currentStep === 'upload'
                                ? 'bg-purple-600 text-white'
                                : 'bg-white/10 text-purple-200'
                            }`}>
                            <Upload className="w-5 h-5" />
                            <span className="font-medium">1. CSV Yükle</span>
                        </div>
                        <div className="w-12 h-0.5 bg-white/20"></div>
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${currentStep === 'distribute'
                                ? 'bg-purple-600 text-white'
                                : 'bg-white/10 text-purple-200'
                            }`}>
                            <Users className="w-5 h-5" />
                            <span className="font-medium">2. Lead Dağıt</span>
                        </div>
                    </div>
                </div>

                {/* Step Content */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
                    {currentStep === 'upload' && (
                        <FileUpload onUploadSuccess={handleUploadSuccess} />
                    )}

                    {currentStep === 'distribute' && batchId && (
                        <LeadDistribution
                            batchId={batchId}
                            totalLeads={totalLeads}
                            onComplete={handleDistributionComplete}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}
