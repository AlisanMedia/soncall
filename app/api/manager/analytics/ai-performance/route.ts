import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    try {
        const supabase = await createClient();

        // Auth check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is manager
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 1. ORACLE ACCURACY: AI Prediction vs Real Outcome
        // Get all leads that have AI analysis (potential_level set)
        const { data: analyzedLeads } = await supabase
            .from('leads')
            .select('id, potential_level, status')
            .neq('potential_level', 'not_assessed');

        // Get sales data
        const { data: salesData } = await supabase
            .from('sales')
            .select('lead_id, status')
            .eq('status', 'approved');

        const soldLeadIds = new Set(salesData?.map(s => s.lead_id) || []);

        // Calculate Oracle Metrics
        let truePositives = 0; // AI said high/medium -> Sale
        let falsePositives = 0; // AI said high/medium -> No sale
        let hiddenGems = 0; // AI said low -> Sale (missed opportunities)
        let trueNegatives = 0; // AI said low -> No sale

        analyzedLeads?.forEach(lead => {
            const isSold = soldLeadIds.has(lead.id);
            const isHighPotential = lead.potential_level === 'high' || lead.potential_level === 'medium';

            if (isHighPotential && isSold) truePositives++;
            else if (isHighPotential && !isSold) falsePositives++;
            else if (!isHighPotential && isSold) hiddenGems++;
            else if (!isHighPotential && !isSold) trueNegatives++;
        });

        const totalPredictions = analyzedLeads?.length || 0;
        const accuracy = totalPredictions > 0
            ? Math.round(((truePositives + trueNegatives) / totalPredictions) * 100)
            : 0;

        const precision = (truePositives + falsePositives) > 0
            ? Math.round((truePositives / (truePositives + falsePositives)) * 100)
            : 0;

        // 2. APPOINTMENT DETECTION: How many appointments did AI catch?
        const { data: appointmentLeads } = await supabase
            .from('leads')
            .select('id, appointment_date')
            .not('appointment_date', 'is', null);

        const appointmentDetectionRate = (analyzedLeads?.length || 0) > 0
            ? Math.round(((appointmentLeads?.length || 0) / (analyzedLeads?.length || 1)) * 100)
            : 0;

        // 3. LEARNING CURVE: Weekly trend of accuracy
        // Get leads created in last 30 days, group by week
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: recentLeads } = await supabase
            .from('leads')
            .select('id, potential_level, created_at')
            .gte('created_at', thirtyDaysAgo.toISOString())
            .neq('potential_level', 'not_assessed');

        // Group by week and calculate accuracy trend
        const weeklyStats = [];
        for (let i = 0; i < 4; i++) {
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - (7 * (i + 1)));
            const weekEnd = new Date();
            weekEnd.setDate(weekEnd.getDate() - (7 * i));

            const weekLeads = recentLeads?.filter(l => {
                const createdAt = new Date(l.created_at);
                return createdAt >= weekStart && createdAt < weekEnd;
            }) || [];

            let weekCorrect = 0;
            weekLeads.forEach(lead => {
                const isSold = soldLeadIds.has(lead.id);
                const isHighPotential = lead.potential_level === 'high' || lead.potential_level === 'medium';
                if ((isHighPotential && isSold) || (!isHighPotential && !isSold)) {
                    weekCorrect++;
                }
            });

            const weekAccuracy = weekLeads.length > 0
                ? Math.round((weekCorrect / weekLeads.length) * 100)
                : 0;

            weeklyStats.push({
                week: `Hafta ${4 - i}`,
                accuracy: weekAccuracy,
                predictions: weekLeads.length
            });
        }

        // 4. SYNERGY INDEX: Agent follow-up on AI notes
        // Check how quickly agents act after AI analysis
        const { data: notesWithAnalysis } = await supabase
            .from('lead_notes')
            .select('lead_id, created_at, note')
            .ilike('note', '%AI:%')
            .order('created_at', { ascending: false })
            .limit(100);

        let quickFollowUps = 0;
        const notesByLead = new Map();
        notesWithAnalysis?.forEach(note => {
            if (!notesByLead.has(note.lead_id)) {
                notesByLead.set(note.lead_id, []);
            }
            notesByLead.get(note.lead_id).push(note);
        });

        // Count leads where agent added a note within 24h of AI note
        notesByLead.forEach((notes: any[]) => {
            if (notes.length >= 2) {
                const aiNote = notes.find((n: any) => n.note.includes('AI:'));
                const agentNote = notes.find((n: any) => !n.note.includes('AI:'));
                if (aiNote && agentNote) {
                    const timeDiff = new Date(agentNote.created_at).getTime() - new Date(aiNote.created_at).getTime();
                    if (timeDiff > 0 && timeDiff < 24 * 60 * 60 * 1000) {
                        quickFollowUps++;
                    }
                }
            }
        });

        const synergyScore = notesByLead.size > 0
            ? Math.round((quickFollowUps / notesByLead.size) * 100)
            : 0;

        return NextResponse.json({
            success: true,
            data: {
                oracle: {
                    accuracy,
                    precision,
                    totalPredictions,
                    breakdown: {
                        truePositives,
                        falsePositives,
                        hiddenGems,
                        trueNegatives
                    }
                },
                appointmentDetection: {
                    rate: appointmentDetectionRate,
                    total: appointmentLeads?.length || 0
                },
                learningCurve: weeklyStats.reverse(),
                synergy: {
                    score: synergyScore,
                    quickFollowUps,
                    totalOpportunities: notesByLead.size
                },
                // Overall AI Health Score (weighted average)
                healthScore: Math.round((accuracy * 0.5) + (precision * 0.3) + (synergyScore * 0.2))
            }
        });

    } catch (error: any) {
        console.error('AI Performance API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
