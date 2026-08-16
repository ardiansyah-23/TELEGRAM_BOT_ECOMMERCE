import { supabase } from '../../database/client';
import type { Segment } from '../../database/types';

export class SegmentService {
  async getSegment(id: string): Promise<Segment | null> {
    const { data, error } = await supabase
      .from('segments')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();
      
    if (error) return null;
    return data as Segment;
  }
  
  // Convert JSON rules to Supabase Query
  buildQuery(rules: any) {
    let query: any = supabase.from('users').select('telegram_id', { count: 'exact' });
    
    // Example rules: [ { field: 'is_active', operator: 'eq', value: true } ]
    if (Array.isArray(rules)) {
      for (const rule of rules) {
        if (rule.operator === 'eq') {
          query = query.eq(rule.field, rule.value);
        } else if (rule.operator === 'neq') {
          query = query.neq(rule.field, rule.value);
        } else if (rule.operator === 'gt') {
          query = query.gt(rule.field, rule.value);
        } else if (rule.operator === 'lt') {
          query = query.lt(rule.field, rule.value);
        }
      }
    }
    
    return query;
  }

  async getTargetCount(segment_id: string): Promise<number> {
    const segment = await this.getSegment(segment_id);
    if (!segment) return 0;
    
    const query = this.buildQuery(segment.rules);
    const { count, error } = await query;
    
    if (error) {
      console.error('Error counting segment', error);
      return 0;
    }
    return count || 0;
  }
  
  async getTargetUsers(segment_id: string, limit: number = 1000, offset: number = 0): Promise<number[]> {
    const segment = await this.getSegment(segment_id);
    if (!segment) return [];
    
    const query = this.buildQuery(segment.rules);
    const { data, error } = await query.range(offset, offset + limit - 1);
    
    if (error || !data) return [];
    return data.map((u: any) => u.telegram_id);
  }
}

export const segmentService = new SegmentService();
