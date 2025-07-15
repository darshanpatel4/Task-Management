
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { NextResponse } from 'next/server';

// Schema for input validation
const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  role: z.enum(['Admin', 'User']),
  position: z.string().optional(),
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
  
  try {
    const body = await request.json();
    const validation = CreateUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, message: `Invalid input: ${validation.error.errors.map((e) => e.message).join(', ')}` },
        { status: 400 }
      );
    }

    const { email, password, fullName, role, position } = validation.data;

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: role,
          position: position,
        },
      });

    if (authError) {
      if (authError.message.includes('User already registered')) {
        return NextResponse.json({ success: false, message: 'User with this email already exists.' }, { status: 409 });
      }
      return NextResponse.json({ success: false, message: `Failed to create user: ${authError.message}` }, { status: 500 });
    }

    if (!authData.user) {
      return NextResponse.json({ success: false, message: 'User created in auth, but no user data returned.' }, { status: 500 });
    }
    
    // The handle_new_user trigger should automatically create the profile.
    
    return NextResponse.json(
      { success: true, message: `User ${fullName} created successfully. Profile should be created by trigger.`, userId: authData.user.id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Unexpected error creating user:', error);
    return NextResponse.json(
      { success: false, message: `An unexpected error occurred: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
