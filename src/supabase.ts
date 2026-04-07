import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://kdwxnsvjgxspnhrldwlr.supabase.co';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtkd3huc3ZqZ3hzcG5ocmxkd2xyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MTIzMjAsImV4cCI6MjA5MTA4ODMyMH0.x4bxFew4G3BOxDhYLiKDiIV6qxduAE8Gbjw-KOANsRU';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials missing. Please check your environment variables.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
