
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const updateNotePublicSchema = z.object({
  noteId: z.string().uuid(),
  content: z.string().min(10, 'Note content must be at least 10 characters.'),
  editToken: z.string().uuid('Invalid edit token format.'),
});

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { success: false, message: 'Server environment for database access is not configured correctly.' },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const validation = updateNotePublicSchema.safeParse(body);
  if (!validation.success) {
    const errorMessages = validation.error.errors.map((e) => e.message).join(', ');
    return NextResponse.json({ success: false, message: `Invalid input: ${errorMessages}` }, { status: 400 });
  }

  const { noteId, content, editToken } = validation.data;

  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // First, verify the edit token is valid for this note
    const { data: note, error: fetchError } = await supabaseAdmin
        .from('note_edit_requests')
        .select('id')
        .eq('note_id', noteId)
        .eq('edit_token', editToken)
        .eq('status', 'approved')
        .single();
    
    if (fetchError || !note) {
        return NextResponse.json({ success: false, message: 'Invalid or expired edit token.' }, { status: 403 });
    }

    // Token is valid, proceed with update
    const { error: updateError } = await supabaseAdmin
        .from('notes')
        .update({ content, updated_at: new Date().toISOString() })
        .eq('id', noteId);

    if (updateError) {
        console.error('API Error updating note content:', updateError);
        return NextResponse.json({ success: false, message: `Database error: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Note updated successfully.' });
  } catch (e: any) {
    console.error('Unexpected error in API route /api/update-note-public:', e);
    return NextResponse.json(
      { success: false, message: `An unexpected server error occurred: ${e.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
