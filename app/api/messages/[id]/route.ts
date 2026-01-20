import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const { id } = await params;

        // Verify authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { action } = body; // 'mark_read'

        if (action === 'mark_read') {
            // Mark message as read
            const { error } = await supabase
                .from('messages')
                .update({ read_at: new Date().toISOString() })
                .eq('id', id)
                .eq('receiver_id', user.id); // Only receiver can mark as read

            if (error) throw error;

            // Also mark participant as read if exists
            await supabase
                .from('message_participants')
                .update({ read_at: new Date().toISOString() })
                .eq('message_id', id)
                .eq('user_id', user.id);

            return NextResponse.json({ success: true });
        }

        return NextResponse.json(
            { message: 'Invalid action' },
            { status: 400 }
        );

    } catch (error: any) {
        console.error('Message update error:', error);
        return NextResponse.json(
            { message: error.message || 'Failed to update message' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const { id } = await params;

        // Verify authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Delete message (only if sender)
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', id)
            .eq('sender_id', user.id);

        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Message delete error:', error);
        return NextResponse.json(
            { message: error.message || 'Failed to delete message' },
            { status: 500 }
        );
    }
}
