
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const adminUpdateNoteSchema = z.object({
  noteId: z.string().uuid(),
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }),
  content: z.string().min(10, { message: 'Note content is required.' }),
  category: z.string(),
});

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    // This check will now reliably fail only if the .env file is truly missing,
    // as dotenv-cli in package.json ensures they are loaded.
    const message = 'Server environment for database access is not configured correctly. Ensure .env file with Supabase keys exists.';
    console.error(`update-note-admin: ${message}`);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const validation = adminUpdateNoteSchema.safeParse(body);
  if (!validation.success) {
    const errorMessages = validation.error.errors.map((e) => e.message).join(', ');
    return NextResponse.json({ success: false, message: `Invalid input: ${errorMessages}` }, { status: 400 });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { noteId, title, content, category } = validation.data;

    const { error } = await supabase
        .from('notes')
        .update({
        title,
        content,
        category,
        updated_at: new Date().toISOString(),
        })
        .eq('id', noteId);

    if (error) {
        console.error('Error updating note as admin via API:', error);
        return NextResponse.json({ success: false, message: `Database error: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Note updated successfully.' });

  } catch (e: any) {
    console.error('Unexpected error in API route /api/update-note-admin:', e);
    return NextResponse.json(
      { success: false, message: `An unexpected server error occurred: ${e.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
