import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdminAuth } from './_auth';
import { supabase } from '../../src/database/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdminAuth(req, res);
  if (!admin) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // We fetch aggregate statistics using direct select counts (or specialized RPC if needed in the future)
    
    const [
      { count: usersCount },
      { count: premiumUsersCount },
      { count: activeCampaignsCount },
      { count: completedCampaignsCount },
      { count: pendingOrdersCount },
      { count: completedOrdersCount },
      { count: pendingJobsCount },
      { count: failedJobsCount },
      { count: botEventsCount }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).not('membership_plan', 'is', null),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'scheduled'),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('scheduled_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('scheduled_jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('bot_events').select('*', { count: 'exact', head: true })
    ]);

    // Calculate gross revenue (paid payments)
    const { data: revenueData } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'paid');
      
    const revenue = revenueData ? revenueData.reduce((acc, curr) => acc + curr.amount, 0) : 0;

    res.status(200).json({
      totalUsers: usersCount || 0,
      premiumUsers: premiumUsersCount || 0,
      activeCampaigns: activeCampaignsCount || 0,
      completedCampaigns: completedCampaignsCount || 0,
      pendingOrders: pendingOrdersCount || 0,
      completedOrders: completedOrdersCount || 0,
      revenue,
      scheduler: {
        pending: pendingJobsCount || 0,
        failed: failedJobsCount || 0
      },
      botEvents: botEventsCount || 0
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
