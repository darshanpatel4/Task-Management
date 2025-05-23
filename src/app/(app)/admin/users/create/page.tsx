
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient'; // We'll use this for admin actions
import { Loader2, UserPlus, AlertTriangle, Briefcase, Lock, Mail, User } from 'lucide-react';
import { useState } from 'react';
import type { UserRole } from '@/types';

const userCreateFormSchema = z.object({
  fullName: z.string().min(2, { message: 'Full name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  role: z.enum(['Admin', 'User'] as [UserRole, ...UserRole[]], { required_error: 'Role is required.' }),
});

type UserCreateFormValues = z.infer<typeof userCreateFormSchema>;

export default function AdminCreateUserPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<UserCreateFormValues>({
    resolver: zodResolver(userCreateFormSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      role: 'User',
    },
  });

  if (!isAdmin) {
    // Should be caught by layout, but good to have a fallback.
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You do not have permission to create users.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Supabase Client Not Available</h2>
        <p className="text-center mb-4">
          The Supabase client is not configured. Please check your environment variables and Supabase setup.
        </p>
        <Button onClick={() => router.push('/admin/users')} variant="outline">
          Back to User Management
        </Button>
      </div>
    );
  }

  async function onSubmit(values: UserCreateFormValues) {
    setIsSubmitting(true);
    toast({
      title: 'User Creation In Progress (Mock)',
      description: "Actual user creation with Supabase Admin API (via Server Action) needs to be implemented.",
    });
    console.log("Form submitted for user creation (mock):", values);

    // TODO: Implement actual user creation using a Server Action with Supabase Admin Client.
    // This would involve:
    // 1. Creating a Server Action.
    // 2. In the Server Action, initializing a Supabase client with the service_role key.
    // 3. Calling `supabase.auth.admin.createUser({ email, password, user_metadata: { full_name, role } })`.
    // 4. The existing `handle_new_user` trigger in your DB should then populate the `profiles` table.
    //    If the trigger also handles `full_name` and `role` from `user_metadata`, you might not need to pass it separately
    //    to the `profiles` table insertion if the trigger is robust.

    try {
      // --- Placeholder for Server Action call ---
      // const result = await callCreateUserServerAction(values);
      // if (result.error) throw new Error(result.error.message);
      // toast({
      //   title: 'User Created Successfully',
      //   description: `User ${values.fullName} has been created.`,
      // });
      // router.push('/admin/users');
      // --- End Placeholder ---

      // For now, simulate success and redirect after a delay
      await new Promise(resolve => setTimeout(resolve, 1500));
       toast({
        title: 'Mock User Creation Successful',
        description: `User ${values.fullName} would have been created.`,
      });
      router.push('/admin/users');


    } catch (error: any) {
      console.error('Error creating user (mock):', error);
      toast({
        title: 'Error Creating User (Mock)',
        description: error.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <UserPlus className="mr-2 h-6 w-6 text-primary" />
          Add New User
        </CardTitle>
        <CardDescription>
          Fill in the details below to create a new user account and profile.
          The new user will be created in Supabase authentication and their profile will be added.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <User className="mr-2 h-4 w-4 text-muted-foreground" />
                    Full Name
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Jane Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                    Email Address
                  </FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="e.g., jane.doe@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <Lock className="mr-2 h-4 w-4 text-muted-foreground" />
                    Password
                  </FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Must be at least 6 characters" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
                    Role
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="User">User</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create User Account
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
