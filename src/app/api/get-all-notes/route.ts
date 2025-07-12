
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Ensures the route is not cached

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("API Error: Server environment for database admin access is not configured correctly.");
    return NextResponse.json(
      { success: false, message: 'Server environment for database admin access is not configured correctly.' },
      { status: 500 }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { data: notesData, error: notesError } = await supabaseAdmin
      .from('notes')
      .select('id, title, content, admin_id, recipient_user_ids, created_at, updated_at, category, visibility')
      .order('created_at', { ascending: false });

    if (notesError) throw notesError;

    const allUserIds = new Set<string>();
    (notesData || []).forEach(note => {
      allUserIds.add(note.admin_id);
      if (note.recipient_user_ids) {
        note.recipient_user_ids.forEach((id: string) => allUserIds.add(id));
      }
    });

    let profilesData: any[] = [];
    if (allUserIds.size > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', Array.from(allUserIds));

      if (profilesError) {
        console.warn('API Warning: Could not fetch some profiles for notes admin page:', profilesError.message);
        // Continue without profile data if it fails, but don't fail the whole request
      } else {
        profilesData = profiles || [];
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Success', 
      notesData: notesData || [], 
      profilesData: profilesData 
    });

  } catch (error: any) {
    console.error('API Error in /api/get-all-notes:', { message: error.message, details: error.details, code: error.code });
    return NextResponse.json(
      { success: false, message: error.message || 'An unknown server error occurred' },
      { status: 500 }
    );
  }
}
