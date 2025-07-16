
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
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { success: false, message: 'Server environment for database access is not configured correctly.' },
      { status: 500 }
    );
  }

  // Use the public client for signup
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
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

    // Use the standard signUp method. The database trigger 'on_auth_user_created' will handle profile creation.
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        // This data is passed to the database trigger
        data: {
          full_name: fullName,
          role: role,
          position: position,
        },
        // We can auto-confirm the email since an admin is creating the account
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      },
    });

    if (authError) {
      if (authError.message.includes('User already registered')) {
        return NextResponse.json({ success: false, message: 'User with this email already exists.' }, { status: 409 });
      }
      return NextResponse.json({ success: false, message: `Failed to create user: ${authError.message}` }, { status: 500 });
    }
    
    // With signUp, if successful, the user is created. The trigger will handle the profile.
    // If email confirmation is required on your project, this user will need to confirm.
    // However, since an admin is creating them, it's common to have this auto-confirmed or handled.
    if (!authData.user) {
         return NextResponse.json({ success: false, message: 'Auth call succeeded but no user data was returned. This may happen if email confirmation is required.' }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, message: `User ${fullName} created successfully.`, userId: authData.user.id },
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
