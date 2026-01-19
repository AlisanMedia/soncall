'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';
import { Users, Shuffle, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface LeadDistributionProps {
    batchId: string;
    totalLeads: number;
    onComplete: () => void;
}

interface AgentAssignment {
    agent: Profile;
    count: number;
}

export default function LeadDistribution({ batchId, totalLeads, onComplete }: LeadDistributionProps) {
    const [agents, setAgents] = useState<Profile[]>([]);
    const [assignments, setAssignments] = useState<AgentAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [distributing, setDistributing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        loadAgents();
    }, []);

    const loadAgents = async () => {
        try {
            const { data, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'agent')
                .order('full_name');

            if (fetchError) throw fetchError;

            setAgents(data || []);
            setAssignments((data || []).map(agent => ({ agent, count: 0 })));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAutoDistribute = () => {
        const perAgent = Math.floor(totalLeads / agents.length);
        const remainder = totalLeads % agents.length;

        const newAssignments = agents.map((agent, index) => ({
            agent,
            count: perAgent + (index < remainder ? 1 : 0),
        }));

        setAssignments(newAssignments);
    };

    const handleCountChange = (agentId: string, value: string) => {
        const count = parseInt(value) || 0;
        setAssignments(prev =>
            prev.map(a => (a.agent.id === agentId ? { ...a, count } : a))
        );
    };

    const getTotalAssigned = () => {
        return assignments.reduce((sum, a) => sum + a.count, 0);
    };

    const isValidDistribution = () => {
        const total = getTotalAssigned();
        return total === totalLeads && assignments.every(a => a.count >= 0);
    };

    const handleConfirmDistribution = async () => {
        if (!isValidDistribution()) {
            setError('Toplam atanan lead sayısı dosyadaki lead sayısına eşit olmalı!');
            return;
        }

        setDistributing(true);
        setError(null);

        try {
            const response = await fetch('/api/leads/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    batchId,
                    assignments: assignments
                        .filter(a => a.count > 0)
                        .map(a => ({
                            agentId: a.agent.id,
                            agentName: a.agent.full_name,
                            count: a.count,
                        })),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Distribution failed');
            }

            // Success - show success message and reset
            alert(`✅ ${totalLeads} lead başarıyla ${assignments.filter(a => a.count > 0).length} agent'a dağıtıldı!`);
            onComplete();
        } catch (err: any) {
            setError(err.message || 'Dağıtım sırasında bir hata oluştu');
        } finally {
            setDistributing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            </div>
        );
    }

    if (agents.length === 0) {
        return (
            <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Henüz Agent Yok</h3>
                <p className="text-purple-200">
                    Lead dağıtmak için önce sisteme agent eklemeniz gerekiyor.
                </p>
            </div>
        );
    }

    const totalAssigned = getTotalAssigned();
    const remaining = totalLeads - totalAssigned;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold text-white">Lead Dağıtımı</h2>
                    <p className="text-purple-200 mt-1">
                        {totalLeads} lead'i {agents.length} agent arasında dağıtın
                    </p>
                </div>
                <button
                    onClick={handleAutoDistribute}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                    <Shuffle className="w-4 h-4" />
                    Otomatik Dağıt
                </button>
            </div>

            {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-100 px-4 py-3 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-purple-300 text-sm mb-1">Toplam Lead</div>
                    <div className="text-2xl font-bold text-white">{totalLeads}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-purple-300 text-sm mb-1">Atanan</div>
                    <div className={`text-2xl font-bold ${totalAssigned > totalLeads ? 'text-red-400' : 'text-white'}`}>
                        {totalAssigned}
                    </div>
                </div>
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-purple-300 text-sm mb-1">Kalan</div>
                    <div className={`text-2xl font-bold ${remaining < 0 ? 'text-red-400' : remaining === 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {remaining}
                    </div>
                </div>
            </div>

            {/* Agent List */}
            <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Agent Listesi
                </h3>

                <div className="space-y-2">
                    {assignments.map(({ agent, count }) => (
                        <div
                            key={agent.id}
                            className="bg-white/5 rounded-lg p-4 border border-white/10 flex items-center justify-between hover:bg-white/10 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-semibold">
                                    {agent.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-semibold text-white">{agent.full_name}</div>
                                    <div className="text-sm text-purple-300">{agent.email}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="0"
                                    max={totalLeads}
                                    value={count}
                                    onChange={(e) => handleCountChange(agent.id, e.target.value)}
                                    className="w-24 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    disabled={distributing}
                                />
                                <span className="text-purple-200 text-sm">lead</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Confirm Button */}
            <button
                onClick={handleConfirmDistribution}
                disabled={!isValidDistribution() || distributing}
                className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
            >
                {distributing ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Dağıtılıyor...
                    </>
                ) : (
                    <>
                        <CheckCircle2 className="w-5 h-5" />
                        Dağıtımı Onayla
                    </>
                )}
            </button>
        </div>
    );
}
