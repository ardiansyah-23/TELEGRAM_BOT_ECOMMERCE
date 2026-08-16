import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from './_auth';
import { notificationService } from '../../src/services/notification/notification.service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    if (req.method === 'GET') {
      const prefs = await notificationService.getPreferences(user.id);
      return res.status(200).json(prefs);
    }
    
    if (req.method === 'PATCH') {
      const updates = req.body;
      // Filter out non-preference keys for safety
      const allowedKeys = ['order_notifications', 'payment_notifications', 'membership_notifications', 'reward_notifications', 'campaign_notifications', 'system_notifications'];
      
      const safeUpdates: any = {};
      for (const key of Object.keys(updates)) {
        if (allowedKeys.includes(key)) {
          safeUpdates[key] = Boolean(updates[key]);
        }
      }
      
      const success = await notificationService.updatePreferences(user.id, safeUpdates);
      if (success) {
        const newPrefs = await notificationService.getPreferences(user.id);
        return res.status(200).json(newPrefs);
      } else {
        return res.status(400).json({ error: 'Gagal memperbarui preferensi' });
      }
    }
    
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in /api/twa/settings', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
