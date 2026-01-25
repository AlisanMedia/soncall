
import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        keyLength: process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.length : 0,
        nodeEnv: process.env.NODE_ENV
    });
}
