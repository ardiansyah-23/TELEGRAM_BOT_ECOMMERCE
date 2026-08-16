import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdminAuth } from './_auth';
import { healthService } from '../../src/services/health.service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authUser = await requireAdminAuth(req, res);
  if (!authUser) return; // Response is already handled

  try {
    const results = await healthService.checkAll();
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      components: results
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve system health' });
  }
}
