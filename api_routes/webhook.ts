import { webhookCallback } from 'grammy';
import { bot } from '../src/bot';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handle(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const secretToken = req.headers['x-telegram-bot-api-secret-token'];
  const expectedToken = process.env.WEBHOOK_SECRET;

  if (process.env.NODE_ENV === 'production') {
    if (!expectedToken || secretToken !== expectedToken) {
      console.error('Unauthorized webhook request');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  
  try {
    const handleWebhook = webhookCallback(bot, 'http');
    await handleWebhook(req as any, res as any);
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
