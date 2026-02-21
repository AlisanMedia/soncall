import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatPhoneNumber(phone: string): string {
    // Format Turkish phone numbers
    if (phone.startsWith('+90')) {
        const clean = phone.replace(/\D/g, '');
        if (clean.length === 12) {
            return `+90 ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 10)} ${clean.slice(10)}`;
        }
    }
    return phone;
}

export function getWhatsAppUrl(phone: string): string {
    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    return `https://wa.me/${cleaned}`;
}

export function formatTimeAgo(date: string): string {
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Az önce';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} dakika önce`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} saat önce`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} gün önce`;

    return past.toLocaleDateString('tr-TR');
}

export function normalizePhone(phone: string): string {
    const clean = standardizePhone(phone);
    return '+' + clean;
}

/**
 * Standardizes phone numbers to the format used by the SMS provider and DB (905XXXXXXXXX).
 * Removes all non-digit characters and ensures 90 prefix.
 */
export function standardizePhone(phone: string): string {
    if (!phone) return '';

    // Remove all non-digit characters
    let clean = phone.replace(/\D/g, '');

    // Skip special cases or short numbers (not valid TR mobile anyway)
    if (clean.length < 10) return clean;

    // Get last 10 digits
    const last10 = clean.slice(-10);

    // Return in 90XXXXXXXXXX format
    return '90' + last10;
}

export function generatePhoneVariants(phone: string): string[] {
    // We want to generate variants to catch duplicates in DB that might be saved differently
    const variants = new Set<string>();
    const clean = phone.replace(/\D/g, '');

    // 1. Raw input
    variants.add(phone);

    // 2. Clean version
    variants.add(clean);

    // 3. With +
    variants.add('+' + clean);

    // 4. Turkish specific formats if applicable
    // Get the last 10 digits (significant part)
    if (clean.length >= 10) {
        const last10 = clean.slice(-10);

        // 5551234567
        variants.add(last10);

        // 05551234567
        variants.add('0' + last10);

        // 905551234567
        variants.add('90' + last10);

        // +905551234567
        variants.add('+90' + last10);

        // Formatted: +90 555 123 45 67
        variants.add(`+90 ${last10.slice(0, 3)} ${last10.slice(3, 6)} ${last10.slice(6, 8)} ${last10.slice(8, 10)}`);
    }

    return Array.from(variants);
}
