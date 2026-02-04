
// Mock types
type Lead = { id: string, potential_level: string, status: string, appointment_date?: string | null };
type Note = { lead_id: string, note: string, created_at: string };
type Sale = { lead_id: string, status: string };

// Logic to Test (extracted from route.ts)
function calculateOracleScore(leads: Lead[], sales: Sale[]) {
    const soldLeadIds = new Set(sales.map(s => s.lead_id));
    let score = 0;
    let max = 0;

    leads.forEach(lead => {
        const isSold = soldLeadIds.has(lead.id);
        const isAppointment = !!lead.appointment_date;
        const isRejected = lead.status === 'uncallable' || lead.status === 'not_interested';
        const isHigh = lead.potential_level === 'high' || lead.potential_level === 'medium';
        const isLow = lead.potential_level === 'low';

        if (isHigh) {
            if (isSold) { score += 100; max += 100; }
            else if (isAppointment) { score += 50; max += 100; }
            else if (isRejected) { score -= 20; max += 20; }
            else { max += 50; }
        } else if (isLow) {
            if (isSold || isAppointment) { score -= 100; max += 100; } // Penalty
            else if (isRejected) { score += 20; max += 20; }
        }
    });
    return max > 0 ? Math.round((score / max) * 100) : 0;
}

function verifyAppointment(lead: Lead, notes: Note[]) {
    // Current Logic in route.ts
    // const relevantAiNote = notes.find(n => 
    //     (n.note.toLowerCase().includes('randevu') || n.note.toLowerCase().includes('yarın') || n.note.toLowerCase().includes('haftaya'))
    // );

    // Improved Logic we want to test
    const relevantAiNote = notes.find(n => {
        const text = n.note.toLowerCase();
        // Positive keywords
        const hasKeyword = text.includes('randevu') || text.includes('yarın') || text.includes('haftaya') || text.includes('tarih');

        // Negative keywords to exclude
        const isNegative = text.includes('alamadım') || text.includes('istemedi') || text.includes('yok') || text.includes('kapattı');

        return hasKeyword && !isNegative;
    });

    return !!relevantAiNote;
}

// TEST CASES
const testLeads: Lead[] = [
    { id: '1', potential_level: 'high', status: 'won', appointment_date: null }, // Sold (+100)
    { id: '2', potential_level: 'low', status: 'won', appointment_date: null }, // Missed Opp (-100)
    { id: '3', potential_level: 'high', status: 'uncallable', appointment_date: null }, // False Confirm (-20)
    { id: '4', potential_level: 'low', status: 'uncallable', appointment_date: null }, // True Neg (+20)
];

const testSales: Sale[] = [
    { lead_id: '1', status: 'approved' },
    { lead_id: '2', status: 'approved' }
];

console.log("--- Oracle Score Test ---");
const oracleScore = calculateOracleScore(testLeads, testSales);
console.log(`Score: ${oracleScore}`);
console.log(`Expected: ~${Math.round(((100 - 100 - 20 + 20) / (100 + 100 + 20 + 20)) * 100)} (0/240 = 0) wait... calculation:`);
console.log(`Points: 100 (Case1) - 100 (Case2) - 20 (Case3) + 20 (Case4) = 0`);
console.log(`Max: 100 + 100 + 20 + 20 = 240`);
console.log(`Result: 0%`);


console.log("\n--- Appointment Logic Stress Test ---");
const leadAppt: Lead = { id: '99', potential_level: 'medium', status: 'appointment', appointment_date: '2024-01-01' };

const badNotes: Note[] = [{ lead_id: '99', note: "AI: Randevu alamadım, müşteri kapattı.", created_at: '2024-01-01' }];
const goodNotes: Note[] = [{ lead_id: '99', note: "AI: Yarın için randevu oluşturuldu.", created_at: '2024-01-01' }];

console.log(`Negatif Not ("Randevu alamadım"): ${verifyAppointment(leadAppt, badNotes) ? 'FAIL (Counted as success)' : 'PASS (Ignored)'}`);
console.log(`Pozitif Not ("Yarın randevu"): ${verifyAppointment(leadAppt, goodNotes) ? 'PASS (Detected)' : 'FAIL (Ignored)'}`);
