import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { canAccessMarket, isGlobalRole } from '@/lib/market-access';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('id, role, market_id')
            .eq('id', user.id)
            .maybeSingle();

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const leadId = searchParams.get('leadId');
        const messageType = searchParams.get('type'); // 'direct', 'broadcast', 'lead_comment'
        const limit = parseInt(searchParams.get('limit') || '50');

        let query = supabase
            .from('messages')
            .select(`
        *,
        sender:profiles!messages_sender_id_fkey(id, full_name, role, avatar_url, agent_progress(current_level)),
        receiver:profiles!messages_receiver_id_fkey(id, full_name, role, avatar_url)
      `)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (!isGlobalRole(profile?.role) && profile?.market_id) {
            query = query.eq('market_id', profile.market_id);
        }

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

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch messages';
        console.error('Messages fetch error:', error);
        return NextResponse.json(
            { message },
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

        const { data: profile } = await supabase
            .from('profiles')
            .select('id, role, market_id')
            .eq('id', user.id)
            .maybeSingle();

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

        let targetMarketId = profile?.market_id || null;

        if (leadId) {
            const { data: lead } = await supabase
                .from('leads')
                .select('market_id')
                .eq('id', leadId)
                .maybeSingle();

            if (!canAccessMarket(profile, lead?.market_id)) {
                return NextResponse.json({ message: 'Bu lead farklı markete ait' }, { status: 403 });
            }

            targetMarketId = lead?.market_id || targetMarketId;
        }

        if (messageType === 'direct' && receiverId) {
            const { data: receiver } = await supabase
                .from('profiles')
                .select('market_id')
                .eq('id', receiverId)
                .maybeSingle();

            if (!canAccessMarket(profile, receiver?.market_id)) {
                return NextResponse.json({ message: 'Farklı marketteki kullanıcıya mesaj gönderilemez' }, { status: 403 });
            }
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
                mentions: mentions || [],
                market_id: targetMarketId
            })
            .select(`
        *,
        sender:profiles!messages_sender_id_fkey(id, full_name, role, agent_progress(current_level))
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

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
        console.error('Message send error:', error);
        return NextResponse.json(
            { message: errorMessage },
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

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update messages';
        console.error('Bulk message update error:', error);
        return NextResponse.json(
            { message },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is manager, admin or founder
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, role, market_id')
            .eq('id', user.id)
            .single();

        if (!['manager', 'admin', 'founder'].includes(profile?.role || '')) {
            return NextResponse.json(
                { message: 'Bu işlem için yetkiniz yok' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const leadId = searchParams.get('leadId');
        const receiverId = searchParams.get('receiverId'); // For direct messages
        const messageType = searchParams.get('type'); // 'direct', 'broadcast', 'lead_comment'

        let query = supabase.from('messages').delete();
        if (!isGlobalRole(profile?.role) && profile?.market_id) {
            query = query.eq('market_id', profile.market_id);
        }

        if (messageType === 'broadcast') {
            // Delete all broadcasts sent by this user (or all if we want total clear?)
            // Usually clearing chat means clearing the current view.
            query = query.eq('message_type', 'broadcast');
        } else if (messageType === 'direct' && receiverId) {
            // Clear conversation between me and receiver
            query = query.or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`);
        } else if (messageType === 'lead_comment' && leadId) {
            query = query.eq('lead_id', leadId).eq('message_type', 'lead_comment');
        } else {
            return NextResponse.json(
                { message: 'Invalid parameters for deletion' },
                { status: 400 }
            );
        }

        const { error } = await query;

        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to delete messages';
        console.error('Delete messages error:', error);
        return NextResponse.json(
            { message },
            { status: 500 }
        );
    }
}
