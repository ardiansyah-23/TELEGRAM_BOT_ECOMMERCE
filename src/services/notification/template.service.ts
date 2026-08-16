import { supabase } from '../../database/client';
import type { MessageTemplate } from '../../database/types';

export class TemplateService {
  async getTemplate(id: string): Promise<MessageTemplate | null> {
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();
      
    if (error) return null;
    return data as MessageTemplate;
  }
  
  renderTemplate(content: string, variables: Record<string, any>): string {
    return content.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      return variables.hasOwnProperty(trimmedKey) ? variables[trimmedKey] : match;
    });
  }
}

export const templateService = new TemplateService();
