import * as dotenv from 'dotenv';

// Load environment variables from .env file (for local development)
dotenv.config();

export const config = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  WEBHOOK_URL: process.env.WEBHOOK_URL,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  ADMIN_TELEGRAM_ID: process.env.ADMIN_TELEGRAM_ID,
};

// Validate required environment variables
if (!config.BOT_TOKEN) {
  throw new Error('BOT_TOKEN is not defined in environment variables');
}
if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
  throw new Error('Supabase credentials are not defined in environment variables');
}
