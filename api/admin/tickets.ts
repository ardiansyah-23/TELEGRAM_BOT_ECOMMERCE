import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../src/database/client';
import { requireAuth } from '../twa/_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = requireAuth(req, res);
    if (!user) return; // Response is already handled in requireAuth

    // Verify Admin
    const { data: adminUser } = await supabase
        .from('users')
        .select('is_admin')
        .eq('telegram_id', user.id)
        .single();

    if (!adminUser || !adminUser.is_admin) {
        return res.status(403).json({ error: 'Forbidden. Admin access required.' });
    }

    if (req.method === 'GET') {
        const { id } = req.query;

        if (id) {
            // Get ticket details and all messages (including internal)
            const { data: ticket, error: ticketError } = await supabase
                .from('tickets')
                .select('*, ticket_categories(name), users!tickets_telegram_id_fkey(full_name, username)')
                .eq('id', id)
                .single();

            if (ticketError || !ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            const { data: messages, error: messagesError } = await supabase
                .from('ticket_messages')
                .select('*, users(full_name)')
                .eq('ticket_id', id)
                .order('created_at', { ascending: true });

            if (messagesError) {
                return res.status(500).json({ error: 'Failed to fetch messages' });
            }

            return res.status(200).json({ ticket, messages });
        } else {
            // List all tickets
            const { data, error } = await supabase
                .from('tickets')
                .select('id, ticket_number, subject, status, priority, created_at, assigned_admin_id, users!tickets_telegram_id_fkey(full_name)')
                .order('created_at', { ascending: false });

            if (error) {
                return res.status(500).json({ error: error.message });
            }

            return res.status(200).json(data);
        }
    }

    if (req.method === 'PATCH') {
        const { id, action, message, is_internal, status, priority, assigned_admin_id } = req.body;
        
        if (!id) return res.status(400).json({ error: 'Ticket ID required' });

        if (action === 'reply') {
            if (!message) return res.status(400).json({ error: 'Message required' });

            // Create message
            const { error: msgError } = await supabase
                .from('ticket_messages')
                .insert({
                    ticket_id: id,
                    sender_type: 'admin',
                    sender_id: user.id,
                    message,
                    is_internal: is_internal || false
                });

            if (msgError) return res.status(500).json({ error: msgError.message });

            // Update ticket
            const updates: any = { 
                last_message_at: new Date().toISOString(),
                status: 'in_progress' 
            };

            // Set first_response_at if not set
            const { data: ticket } = await supabase.from('tickets').select('first_response_at').eq('id', id).single();
            if (ticket && !ticket.first_response_at && !is_internal) {
                updates.first_response_at = new Date().toISOString();
            }

            await supabase.from('tickets').update(updates).eq('id', id);

            // TODO: Send Telegram Notification to User if not internal

            return res.status(200).json({ success: true });
        }

        if (action === 'update_status') {
            const updates: any = {};
            if (status) updates.status = status;
            if (priority) updates.priority = priority;
            if (assigned_admin_id !== undefined) updates.assigned_admin_id = assigned_admin_id;

            if (status === 'resolved') updates.resolved_at = new Date().toISOString();
            if (status === 'closed') updates.closed_at = new Date().toISOString();

            const { error } = await supabase.from('tickets').update(updates).eq('id', id);
            if (error) return res.status(500).json({ error: error.message });

            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
