// src/lib/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabaseInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      }, 
    });
    // This console log helps confirm client-side initialization
    if (typeof window !== 'undefined') {
        console.log("Supabase client initialized successfully on the client.");
    }
  } catch (error) {
    console.error("Error initializing Supabase client:", error);
    // supabaseInstance remains null
  }
} else {
  // This warning helps diagnose if the variables are missing
  const message = "Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) are not set. Supabase features will be disabled.";
  if (typeof window !== 'undefined') {
    // Only show this detailed warning on the client where it's most relevant for login issues
    console.warn(message);
    console.warn("Please ensure your .env.local file is in the root directory and the Next.js development server has been restarted.");
  }
}

export const supabase = supabaseInstance;
