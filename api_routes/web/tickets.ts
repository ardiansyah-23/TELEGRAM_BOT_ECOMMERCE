import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../src/database/client';
import { requireAuth } from '../twa/_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = requireAuth(req, res);
    if (!user) return;

    if (req.method === 'GET') {
        const { id } = req.query;

        if (id) {
            // Get ticket details and messages
            const { data: ticket, error: ticketError } = await supabase
                .from('tickets')
                .select('*, ticket_categories(name)')
                .eq('id', id)
                .eq('telegram_id', user.id)
                .single();

            if (ticketError || !ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            const { data: messages, error: messagesError } = await supabase
                .from('ticket_messages')
                .select('*')
                .eq('ticket_id', id)
                .eq('is_internal', false) // Protect internal notes
                .order('created_at', { ascending: true });

            if (messagesError) {
                return res.status(500).json({ error: 'Failed to fetch messages' });
            }

            return res.status(200).json({ ticket, messages });
        } else {
            // List user tickets
            const { data, error } = await supabase
                .from('tickets')
                .select('*, ticket_categories(name)')
                .eq('telegram_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                return res.status(500).json({ error: error.message });
            }

            return res.status(200).json(data);
        }
    }

    if (req.method === 'POST') {
        const { category_id, subject, message } = req.body;
        if (!category_id || !subject || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Create ticket
        const { data: ticket, error: ticketError } = await supabase
            .from('tickets')
            .insert({
                telegram_id: user.id,
                category_id,
                subject
            })
            .select()
            .single();

        if (ticketError) {
            return res.status(500).json({ error: ticketError.message });
        }

        // Create initial message
        const { error: msgError } = await supabase
            .from('ticket_messages')
            .insert({
                ticket_id: ticket.id,
                sender_type: 'user',
                sender_id: user.id,
                message
            });

        if (msgError) {
            return res.status(500).json({ error: msgError.message });
        }

        return res.status(201).json(ticket);
    }

    if (req.method === 'PATCH') {
        const { id, message } = req.body; // reply to ticket
        if (!id || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify ownership and status
        const { data: ticket, error: checkError } = await supabase
            .from('tickets')
            .select('status')
            .eq('id', id)
            .eq('telegram_id', user.id)
            .single();

        if (checkError || !ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        if (ticket.status === 'closed' || ticket.status === 'resolved') {
            return res.status(400).json({ error: 'Cannot reply to a closed ticket' });
        }

        const { error: msgError } = await supabase
            .from('ticket_messages')
            .insert({
                ticket_id: id,
                sender_type: 'user',
                sender_id: user.id,
                message
            });

        if (msgError) {
            return res.status(500).json({ error: msgError.message });
        }

        // Update last message time
        await supabase
            .from('tickets')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', id);

        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
