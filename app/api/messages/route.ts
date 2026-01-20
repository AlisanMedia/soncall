import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const leadId = searchParams.get('leadId');
        const messageType = searchParams.get('type'); // 'direct', 'broadcast', 'lead_comment'
        const limit = parseInt(searchParams.get('limit') || '50');

        let query = supabase
            .from('messages')
            .select(`
        *,
        sender:profiles!messages_sender_id_fkey(id, full_name, role),
        receiver:profiles!messages_receiver_id_fkey(id, full_name, role)
      `)
            .order('created_at', { ascending: false })
            .limit(limit);

        // Filter by lead if specified
        if (leadId) {
            query = query.eq('lead_id', leadId);
        }

        // Filter by message type
        if (messageType) {
            query = query.eq('message_type', messageType);
        } else {
            // Default: get direct messages and broadcasts for this user
            query = query.or(`receiver_id.eq.${user.id},sender_id.eq.${user.id},message_type.eq.broadcast`);
        }

        const { data: messages, error } = await query;

        if (error) throw error;

        return NextResponse.json({ messages: messages || [] });

    } catch (error: any) {
        console.error('Messages fetch error:', error);
        return NextResponse.json(
            { message: error.message || 'Failed to fetch messages' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { message, receiverId, leadId, messageType, mentions } = body;

        if (!message || !messageType) {
            return NextResponse.json(
                { message: 'Message and type are required' },
                { status: 400 }
            );
        }

        // Validate message type
        if (!['direct', 'broadcast', 'lead_comment'].includes(messageType)) {
            return NextResponse.json(
                { message: 'Invalid message type' },
                { status: 400 }
            );
        }

        // For direct messages, receiver is required
        if (messageType === 'direct' && !receiverId) {
            return NextResponse.json(
                { message: 'Receiver ID required for direct messages' },
                { status: 400 }
            );
        }

        // For lead comments, lead ID is required
        if (messageType === 'lead_comment' && !leadId) {
            return NextResponse.json(
                { message: 'Lead ID required for lead comments' },
                { status: 400 }
            );
        }

        // Insert message
        const { data: newMessage, error } = await supabase
            .from('messages')
            .insert({
                sender_id: user.id,
                receiver_id: messageType === 'direct' ? receiverId : null,
                lead_id: leadId || null,
                message,
                message_type: messageType,
                mentions: mentions || []
            })
            .select(`
        *,
        sender:profiles!messages_sender_id_fkey(id, full_name, role)
      `)
            .single();

        if (error) throw error;

        // For direct messages, create participant for receiver
        if (messageType === 'direct' && receiverId) {
            await supabase
                .from('message_participants')
                .insert({
                    message_id: newMessage.id,
                    user_id: receiverId
                });
        }

        // Note: Broadcast participants are created automatically via trigger

        return NextResponse.json({
            success: true,
            message: newMessage
        });

    } catch (error: any) {
        console.error('Message send error:', error);
        return NextResponse.json(
            { message: error.message || 'Failed to send message' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { action } = body;

        if (action === 'mark_all_read') {
            const now = new Date().toISOString();

            // 1. Mark direct messages as read
            const { error: dmError } = await supabase
                .from('messages')
                .update({ read_at: now })
                .eq('receiver_id', user.id)
                .is('read_at', null);

            if (dmError) throw dmError;

            // 2. Mark broadcast participants as read
            const { error: broadcastError } = await supabase
                .from('message_participants')
                .update({ read_at: now })
                .eq('user_id', user.id)
                .is('read_at', null);

            if (broadcastError) throw broadcastError;

            return NextResponse.json({ success: true });
        }

        return NextResponse.json(
            { message: 'Invalid action' },
            { status: 400 }
        );

    } catch (error: any) {
        console.error('Bulk message update error:', error);
        return NextResponse.json(
            { message: error.message || 'Failed to update messages' },
            { status: 500 }
        );
    }
}
