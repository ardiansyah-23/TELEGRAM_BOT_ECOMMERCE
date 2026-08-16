import { jobProcessor } from '../src/services/jobs/job.processor';
import { healthService } from '../src/services/health.service';
import { config } from '../src/config/env';

export default async function handler(req: any, res: any) {
  // Only allow GET or POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify CRON_SECRET if running in production (Vercel)
  const authHeader = req.headers['authorization'];
  if (process.env.NODE_ENV === 'production') {
    // Usually Vercel sends `Bearer <CRON_SECRET>`
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.warn('CRON_SECRET is not set in environment variables');
    } else {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
  }

  try {
    console.log('Starting cron job processor...');
    // Process up to 10 jobs per invocation to respect Vercel's limits
    const processedCount = await jobProcessor.processBatch(10);
    
    await healthService.recordCronRun(true);

    return res.status(200).json({ 
      success: true, 
      processed: processedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Cron job failed:', error);
    await healthService.recordCronRun(false);
    
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
