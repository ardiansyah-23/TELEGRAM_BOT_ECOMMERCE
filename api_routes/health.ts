import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Public basic endpoint. Detailed internal health is at /api/admin/health
  res.status(200).json({ status: 'ok' });
}
