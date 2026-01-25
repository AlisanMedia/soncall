
const note = `Günay gm
Yarın sabah aranacak
Yarın 10-11 gibi aranaca
📅 Randevu: 26 Ocak 2026 Pazartesi 09:20`;

const parseTurkishDate = (text: string) => {
    try {
        console.log("Parsing text:", text);
        const match = text.match(/📅 Randevu: (.*)/);
        if (!match) {
            console.log("No match found");
            return null;
        }

        const dateStr = match[1].trim();
        console.log("Captured string:", dateStr);

        // Format: "26 Ocak 2026 Pazartesi 13:19"
        // Split by space
        const parts = dateStr.split(' ');
        console.log("Parts:", parts);

        if (parts.length < 5) {
            console.log("Not enough parts");
            return null;
        }

        const day = parseInt(parts[0]);
        const monthName = parts[1].toLowerCase();
        const year = parseInt(parts[2]);
        const time = parts[4]; // Skip day name (parts[3])
        const [hour, minute] = time.split(':').map(Number);

        console.log(`Parsed: D=${day}, M=${monthName}, Y=${year}, T=${time}`);

        const months: Record<string, number> = {
            'ocak': 0, 'şubat': 1, 'mart': 2, 'nisan': 3, 'mayıs': 4, 'haziran': 5,
            'temmuz': 6, 'ağustos': 7, 'eylül': 8, 'ekim': 9, 'kasım': 10, 'aralık': 11
        };

        const month = months[monthName];
        if (month === undefined) {
            console.log("Invalid month");
            return null;
        }

        const date = new Date(year, month, day, hour, minute);
        return date.toISOString();
    } catch (e) {
        console.error("Error:", e);
        return null;
    }
};

const result = parseTurkishDate(note);
console.log("Result:", result);
