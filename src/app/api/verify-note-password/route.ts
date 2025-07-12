
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const verifyPasswordSchema = z.object({
  noteId: z.string().uuid(),
  password: z.string(),
  isToken: z.boolean().optional(),
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

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const validation = verifyPasswordSchema.safeParse(body);
  if (!validation.success) {
    const errorMessages = validation.error.errors.map((e) => e.message).join(', ');
    return NextResponse.json({ success: false, message: `Invalid input: ${errorMessages}` }, { status: 400 });
  }

  const { noteId, password, isToken } = validation.data;

  try {
    const { data: note, error } = await supabaseAdmin
      .from('notes')
      .select('security_key')
      .eq('id', noteId)
      .single();

    if (error || !note) {
      return NextResponse.json({ success: false, message: 'Note not found.' }, { status: 404 });
    }

    if (note.security_key === null) {
      const tempToken = `public_session_${Math.random().toString(36).substring(2)}`;
      return NextResponse.json({ success: true, message: 'Access granted.', token: tempToken });
    }

    const keyToCompare = isToken ? note.security_key : password;

    if (note.security_key === keyToCompare) {
      return NextResponse.json({ success: true, message: 'Access granted.', token: note.security_key });
    } else {
      return NextResponse.json({ success: false, message: 'Incorrect password.' }, { status: 401 });
    }
  } catch (e: any) {
    console.error('Unexpected error in API route /api/verify-note-password:', e);
    return NextResponse.json(
      { success: false, message: `An unexpected server error occurred: ${e.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
