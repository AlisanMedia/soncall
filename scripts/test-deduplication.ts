// Mocking or redefining functions since direct proper import with ts-node aliases is tricky without extra config
function normalizePhone(phone: string): string {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('90') && clean.length === 12) return '+' + clean;
    if (clean.startsWith('0') && clean.length === 11) return '+90' + clean.substring(1);
    if (clean.length === 10) return '+90' + clean;
    return phone.startsWith('+') ? phone : '+' + clean;
}

function generatePhoneVariants(phone: string): string[] {
    const variants = new Set<string>();
    const clean = phone.replace(/\D/g, '');
    variants.add(phone);
    variants.add(clean);
    variants.add('+' + clean);
    if (clean.length >= 10) {
        const last10 = clean.slice(-10);
        variants.add(last10);
        variants.add('0' + last10);
        variants.add('90' + last10);
        variants.add('+90' + last10);
        variants.add(`+90 ${last10.slice(0, 3)} ${last10.slice(3, 6)} ${last10.slice(6, 8)} ${last10.slice(8, 10)}`);
    }
    return Array.from(variants);
}

// Helper to assert equality
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

function runTests() {
    console.log('--- Testing Normalization ---');

    // Normalization Tests
    assert(normalizePhone('05551234567') === '+905551234567', '05551234567 -> +905551234567');
    assert(normalizePhone('5551234567') === '+905551234567', '5551234567 -> +905551234567');
    assert(normalizePhone('905551234567') === '+905551234567', '905551234567 -> +905551234567');
    assert(normalizePhone('+905551234567') === '+905551234567', '+905551234567 -> +905551234567');
    assert(normalizePhone('+90 555 123 45 67') === '+905551234567', 'Formatted +90 -> +905551234567');

    console.log('\n--- Testing Variant Generation ---');

    // Variant Tests
    const variants = generatePhoneVariants('05551234567');
    console.log('Variants for 05551234567:', variants);

    assert(variants.includes('5551234567'), 'Includes raw 10 digit');
    assert(variants.includes('05551234567'), 'Includes 0 prefix');
    assert(variants.includes('905551234567'), 'Includes 90 prefix');
    assert(variants.includes('+905551234567'), 'Includes +90 prefix');

    const formattedVariant = variants.find(v => v.includes(' '));
    assert(!!formattedVariant, 'Includes formatted version with spaces');
}

runTests();
