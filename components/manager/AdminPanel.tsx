'use client';

import { useState } from 'react';
import { Settings, Shield, Mail } from 'lucide-react';
import EmailRequestsView from './EmailRequestsView';
import SystemMaintenance from './SystemMaintenance';

export default function AdminPanel() {
    const [subTab, setSubTab] = useState<'requests' | 'system'>('requests');

    return (
        <div className="space-y-6">
            {/* Admin Header */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-1 flex p-1 inline-flex">
                <button
                    onClick={() => setSubTab('requests')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${subTab === 'requests'
                            ? 'bg-purple-600 text-white shadow'
                            : 'text-gray-400 hover:text-white'
                        }`}
                >
                    <Mail className="w-4 h-4" />
                    E-Posta Onayları
                </button>
                <button
                    onClick={() => setSubTab('system')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${subTab === 'system'
                            ? 'bg-red-600 text-white shadow'
                            : 'text-gray-400 hover:text-white'
                        }`}
                >
                    <Shield className="w-4 h-4" />
                    Sistem Bakımı
                </button>
            </div>

            {/* Content Content */}
            <div className="bg-black/20 rounded-2xl">
                {subTab === 'requests' && <EmailRequestsView />}
                {subTab === 'system' && <SystemMaintenance />}
            </div>
        </div>
    );
}
