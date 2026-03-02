
export const CONFIG = {
  GEMINI_API_KEY: (import.meta as any).env.VITE_GEMINI_API_KEY || (import.meta as any).env.VITE_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY,
  SUPABASE_URL: (import.meta as any).env.VITE_SUPABASE_URL || "https://cmaxutqmblvvghftouqx.supabase.co",
  SUPABASE_ANON_KEY: (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtYXh1dHFtYmx2dmdoZnRvdXF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NTkyNDksImV4cCI6MjA4MTEzNTI0OX0.a8VbYwNY6mYkCBMiSSwUVU-zThSQnvIBEeH4GT_i-Xk",
  IS_PROD: true
};
