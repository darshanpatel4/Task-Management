
'use server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { UserRole } from '@/types';

// Schema for input validation
const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  role: z.enum(['Admin', 'User'] as [UserRole, ...UserRole[]]),
});

interface CreateUserResult {
  success: boolean;
  message: string;
  userId?: string;
}

export async function adminCreateUser(formData: {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
}): Promise<CreateUserResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      success: false,
      message:
        'Server environment for database access is not configured correctly.',
    };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

  const validation = CreateUserSchema.safeParse(formData);
  if (!validation.success) {
    return {
      success: false,
      message: `Invalid input: ${validation.error.errors.map((e) => e.message).join(', ')}`,
    };
  }

  const { email, password, fullName, role } = validation.data;

  try {
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, // You can set this to false if you don't want email confirmation for admin-created users
        user_metadata: {
          full_name: fullName,
          role: role,
          // avatar_url could be added here if you have a default or collect it
        },
      });

    if (authError) {
      console.error('Error creating user in auth:', authError);
      // Check for common errors
      if (authError.message.includes('User already registered')) {
        return { success: false, message: 'User with this email already exists.' };
      }
      return { success: false, message: `Failed to create user: ${authError.message}` };
    }

    if (!authData.user) {
      return { success: false, message: 'User created in auth, but no user data returned.' };
    }
    
    // The handle_new_user trigger should automatically create the profile.
    // We can optionally verify profile creation here if needed, but it's usually handled by the trigger.
    // For instance, a small delay and then a select from profiles:
    // await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for trigger
    // const { data: profileData, error: profileError } = await supabaseAdmin
    //   .from('profiles')
    //   .select('id')
    //   .eq('id', authData.user.id)
    //   .single();

    // if (profileError || !profileData) {
    //   console.error('Error verifying profile creation or profile not found for user:', authData.user.id, profileError);
    //   // Optionally, attempt to delete the auth user if profile creation failed critically
    //   // await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    //   return { success: false, message: `User created in auth, but profile creation failed or could not be verified. User ID: ${authData.user.id}` };
    // }


    return {
      success: true,
      message: `User ${fullName} created successfully. Profile should be created by trigger.`,
      userId: authData.user.id,
    };
  } catch (error: any) {
    console.error('Unexpected error creating user:', error);
    return {
      success: false,
      message: `An unexpected error occurred: ${error.message || 'Unknown error'}`,
    };
  }
}
