
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizePhone } from '@/lib/utils';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Retrieve contacts ordered by name
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .order('full_name', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ contacts: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { full_name, phone_number, title, company, notes } = body;

        if (!full_name || !phone_number) {
            return NextResponse.json({ error: 'Name and Phone are required' }, { status: 400 });
        }

        // Robust Phone Normalization
        // Remove all non-digits
        let cleanPhone = phone_number.replace(/\D/g, '');

        // Handle various inputs for Turkey logic (defaulting to TR numbers if ambiguous)
        // 555 123 45 67 (10 digits) -> 905551234567
        if (cleanPhone.length === 10) {
            cleanPhone = '90' + cleanPhone;
        }
        // 0555 123 45 67 (11 digits, starts with 0) -> 905551234567
        else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
            cleanPhone = '90' + cleanPhone.substring(1);
        }
        // 90 555 123 45 67 (12 digits, starts with 90) -> Keep as is

        // Final check to ensure it at least approximates a valid length
        // We log a warning if it looks weird but still save it if the user insists (or maybe reject?)
        // For now, we trust the normalization for standard cases.

        const { data, error } = await supabase
            .from('contacts')
            .insert({
                full_name,
                phone_number: cleanPhone,
                title,
                company,
                notes,
                created_by: user.id
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ contact: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { id, full_name, phone_number, title, company, notes } = body;

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const updateData: any = {};
        if (full_name) updateData.full_name = full_name;
        if (phone_number) {
            let cleanPhone = phone_number.replace(/\D/g, '');
            if (cleanPhone.length === 10) {
                cleanPhone = '90' + cleanPhone;
            } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
                cleanPhone = '90' + cleanPhone.substring(1);
            }
            updateData.phone_number = cleanPhone;
        }
        if (title !== undefined) updateData.title = title;
        if (company !== undefined) updateData.company = company;
        if (notes !== undefined) updateData.notes = notes;

        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('contacts')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ contact: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const { error } = await supabase
            .from('contacts')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
