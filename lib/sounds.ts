// Sound effects utility using Web Audio API
class SoundPlayer {
    private audioContext: AudioContext | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
    }

    // Helper to create oscillator
    private createTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    // New lead transition - Whoosh sound
    playLeadTransition() {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.3);
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.3);
    }

    // Appointment/Money sound - Cash register effect
    playAppointment() {
        if (!this.audioContext) return;

        // Cash register "cha-ching" sound
        const times = [0, 0.1, 0.15];
        const frequencies = [800, 1200, 1000];

        times.forEach((time, index) => {
            const oscillator = this.audioContext!.createOscillator();
            const gainNode = this.audioContext!.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext!.destination);

            oscillator.frequency.value = frequencies[index];
            oscillator.type = 'triangle';

            const startTime = this.audioContext!.currentTime + time;
            gainNode.gain.setValueAtTime(0.3, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

            oscillator.start(startTime);
            oscillator.stop(startTime + 0.2);
        });

        // Add a little "ding" at the end
        setTimeout(() => {
            this.createTone(1500, 0.15, 'sine');
        }, 200);
    }

    // All leads completed - Victory fanfare
    playVictory() {
        if (!this.audioContext) return;

        // Victory melody: C - E - G - C (higher)
        const melody = [
            { freq: 523.25, time: 0 },      // C5
            { freq: 659.25, time: 0.15 },   // E5
            { freq: 783.99, time: 0.3 },    // G5
            { freq: 1046.50, time: 0.45 },  // C6
        ];

        melody.forEach(note => {
            const oscillator = this.audioContext!.createOscillator();
            const gainNode = this.audioContext!.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext!.destination);

            oscillator.frequency.value = note.freq;
            oscillator.type = 'triangle';

            const startTime = this.audioContext!.currentTime + note.time;
            gainNode.gain.setValueAtTime(0.4, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

            oscillator.start(startTime);
            oscillator.stop(startTime + 0.3);
        });
    }

    // WhatsApp redirect - Click sound
    playWhatsApp() {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = 1200;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }

    // Manager activity notification - Subtle ping
    playActivityNotification() {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = 1000;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.2);
    }

    // Streak milestone - Encouraging sound
    playStreak() {
        if (!this.audioContext) return;

        // Quick upward arpeggio
        const notes = [440, 554.37, 659.25]; // A4, C#5, E5

        notes.forEach((freq, index) => {
            const oscillator = this.audioContext!.createOscillator();
            const gainNode = this.audioContext!.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext!.destination);

            oscillator.frequency.value = freq;
            oscillator.type = 'sine';

            const startTime = this.audioContext!.currentTime + (index * 0.08);
            gainNode.gain.setValueAtTime(0.2, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

            oscillator.start(startTime);
            oscillator.stop(startTime + 0.15);
        });
    }

    // Achievement - Grand celebration
    playAchievement() {
        if (!this.audioContext) return;

        // Triumphant fanfare: C - E - G - C
        const melody = [
            { freq: 523.25, time: 0 },      // C5
            { freq: 659.25, time: 0.12 },   // E5
            { freq: 783.99, time: 0.24 },   // G5
            { freq: 1046.50, time: 0.36 },  // C6 (high)
        ];

        melody.forEach(note => {
            const oscillator = this.audioContext!.createOscillator();
            const gainNode = this.audioContext!.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext!.destination);

            oscillator.frequency.value = note.freq;
            oscillator.type = 'triangle';

            const startTime = this.audioContext!.currentTime + note.time;
            gainNode.gain.setValueAtTime(0.35, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);

            oscillator.start(startTime);
            oscillator.stop(startTime + 0.25);
        });
    }

    // Encouragement - Uplifting positive sound
    playEncouragement() {
        if (!this.audioContext) return;

        // Happy upbeat notes
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

        notes.forEach((freq, index) => {
            const oscillator = this.audioContext!.createOscillator();
            const gainNode = this.audioContext!.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext!.destination);

            oscillator.frequency.value = freq;
            oscillator.type = 'sine';

            const startTime = this.audioContext!.currentTime + (index * 0.1);
            gainNode.gain.setValueAtTime(0.25, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

            oscillator.start(startTime);
            oscillator.stop(startTime + 0.2);
        });
    }

    // Warning - Gentle alert for manager
    playWarning() {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(500, this.audioContext.currentTime + 0.15);
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.15);
    }

    // Error/validation failed - Gentle error sound
    playError() {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.2);
        oscillator.type = 'sawtooth';

        gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.2);
    }
}

// Singleton instance
let soundPlayerInstance: SoundPlayer | null = null;

export function getSoundPlayer(): SoundPlayer {
    if (!soundPlayerInstance) {
        soundPlayerInstance = new SoundPlayer();
    }
    return soundPlayerInstance;
}

// Convenience exports
export const playLeadTransition = () => getSoundPlayer().playLeadTransition();
export const playAppointment = () => getSoundPlayer().playAppointment();
export const playVictory = () => getSoundPlayer().playVictory();
export const playWhatsApp = () => getSoundPlayer().playWhatsApp();
export const playActivityNotification = () => getSoundPlayer().playActivityNotification();
export const playStreak = () => getSoundPlayer().playStreak();
export const playAchievement = () => getSoundPlayer().playAchievement();
export const playEncouragement = () => getSoundPlayer().playEncouragement();
export const playWarning = () => getSoundPlayer().playWarning();
export const playError = () => getSoundPlayer().playError();
