import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const supabase = await createClient();

        // Verify authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Count unread direct messages
        const { count: directCount, error: directError } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', user.id)
            .is('read_at', null);

        if (directError) throw directError;

        // Count unread broadcasts (via participants table)
        const { count: broadcastCount, error: broadcastError } = await supabase
            .from('message_participants')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .is('read_at', null);

        if (broadcastError) throw broadcastError;

        const totalUnread = (directCount || 0) + (broadcastCount || 0);

        return NextResponse.json({
            unread: totalUnread,
            direct: directCount || 0,
            broadcast: broadcastCount || 0
        });

    } catch (error: any) {
        console.error('Unread count error:', error);
        return NextResponse.json(
            { message: error.message || 'Failed to get unread count' },
            { status: 500 }
        );
    }
}
