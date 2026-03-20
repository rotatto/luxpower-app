import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sgxczxfhzthwlrhxmhmw.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneGN6eGZoenRod2xyaHhtaG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzODIwMTIsImV4cCI6MjA4Mzk1ODAxMn0.Sw7ddcfQ8OoE5FSRb7hQlHhCCtMF0WSGQiHih6gQvCk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
