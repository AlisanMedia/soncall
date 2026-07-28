
import { NextResponse } from 'next/server';
import { requireManagerAccess } from '@/lib/api/auth';

export async function GET() {
    const auth = await requireManagerAccess();
    if (!auth.ok) return auth.response;

    return NextResponse.json({
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        nodeEnv: process.env.NODE_ENV,
        checkedBy: auth.profile.role,
    });
}
