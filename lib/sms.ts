export async function sendSMS(phone: string, message: string) {
    // Standardize phone number
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    // Log for now (Mock Mode)
    console.log(`[SMS MOCK] To: ${cleanPhone} | Message: ${message}`);

    // TODO: Integrate Real Provider (e.g. Netgsm)
    /*
    try {
        const response = await fetch('https://api.netgsm.com.tr/sms/send/get', {
            method: 'POST',
            body: JSON.stringify({
                usercode: process.env.NETGSM_USER,
                password: process.env.NETGSM_PASSWORD,
                gsmno: cleanPhone,
                message: message,
                msgheader: process.env.NETGSM_HEADER
            })
        });
        return response.ok;
    } catch (e) {
        console.error('SMS Send Error:', e);
        return false;
    }
    */

    return true;
}
