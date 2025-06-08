
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
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, Save, User as UserIcon, Briefcase, Award } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import type { User, UserRole } from '@/types';
import { supabase } from '@/lib/supabaseClient';

const userEditFormSchema = z.object({
  fullName: z.string().min(2, { message: 'Full name must be at least 2 characters.' }),
  role: z.enum(['Admin', 'User'] as [UserRole, ...UserRole[]], { required_error: 'Role is required.' }),
  position: z.string().max(100, { message: 'Position must be 100 characters or less.' }).optional(),
});

type UserEditFormValues = z.infer<typeof userEditFormSchema>;

export default function AdminEditUserPage() {
  const { isAdmin, currentUser: adminUser } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const userIdToEdit = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<UserEditFormValues>({
    resolver: zodResolver(userEditFormSchema),
    defaultValues: {
      fullName: '',
      role: 'User',
      position: '',
    },
  });

  const fetchUserDetails = useCallback(async () => {
    if (!userIdToEdit || !supabase) {
      setError(supabase ? 'User ID is missing.' : 'Supabase client not available.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url, position')
        .eq('id', userIdToEdit)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') setError('User not found.');
        else throw fetchError;
        setUser(null);
      } else if (data) {
        const fetchedUser: User = {
            id: data.id,
            name: data.full_name || '',
            email: data.email || '',
            role: data.role as UserRole,
            avatar: data.avatar_url || undefined,
            position: data.position || '',
        }
        setUser(fetchedUser);
        form.reset({
          fullName: fetchedUser.name,
          role: fetchedUser.role,
          position: fetchedUser.position || '',
        });
      } else {
         setError('User not found.');
         setUser(null);
      }
    } catch (e: any) {
      console.error('Error fetching user details:', e);
      const displayMessage = e.message || e.details || 'Failed to load user details.';
      setError(displayMessage);
      toast({ title: 'Error Fetching User', description: displayMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [userIdToEdit, toast, form]);

  useEffect(() => {
    if (isAdmin) {
      fetchUserDetails();
    } else {
      setIsLoading(false);
      setError("Access Denied. You must be an admin to edit users.");
    }
  }, [isAdmin, fetchUserDetails]);


  if (!isAdmin && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>{error || "You do not have permission to edit users."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading user details...</p>
      </div>
    );
  }

  if (error && !user) {
     return (
      <div className="flex flex-col items-center justify-center h-full text-destructive">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading User</h2>
        <p>{error}</p>
        <Button onClick={() => router.push('/admin/users')} variant="outline" className="mt-4">
          Back to User Management
        </Button>
      </div>
    );
  }

  if (!supabase || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">{!supabase ? "Supabase Client Not Available" : "User data unavailable."}</h2>
         <Button onClick={() => router.push('/admin/users')} variant="outline" className="mt-4">
          Back to User Management
        </Button>
      </div>
    );
  }


  async function onSubmit(values: UserEditFormValues) {
    if (!user || !supabase || !adminUser) {
      toast({ title: 'Error', description: 'User data, Supabase client, or admin session unavailable.', variant: 'destructive' });
      return;
    }
     if (adminUser.id === userIdToEdit && values.role !== 'Admin') {
      toast({
        title: 'Action Denied',
        description: 'Admins cannot change their own role to non-Admin.',
        variant: 'destructive',
      });
      form.setValue('role', 'Admin'); // Reset role back to Admin in the form
      return;
    }

    setIsSubmitting(true);
    console.log(`AdminEditUserPage: Attempting update for user ID: ${user.id} by admin: ${adminUser.id} (${adminUser.email})`);
    console.log('AdminEditUserPage: Values being submitted:', values);

    try {
      const { data: updateData, error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: values.fullName,
          role: values.role,
          position: values.position || null, // Ensure empty string becomes null
        })
        .eq('id', user.id)
        .select(); // Important: Add .select() to get the result of the update

      console.log('AdminEditUserPage: Supabase update response - Data:', updateData, 'Error:', updateError);

      if (updateError) {
        // This will catch explicit errors from Supabase (like network issues, malformed query if any)
        throw updateError;
      }

      if (updateData && updateData.length > 0) {
        toast({
          title: 'User Updated',
          description: `User "${values.fullName}" has been successfully updated.`,
        });
        router.push('/admin/users');
      } else if (updateData && updateData.length === 0 && !updateError) {
        // This case means the query ran successfully but no rows were updated.
        // This is often an RLS issue where the `USING` clause filtered out all rows.
        console.warn('AdminEditUserPage: Update query ran, but no rows were affected. This might indicate an RLS policy issue or incorrect user ID.');
        toast({
          title: 'Update Not Applied',
          description: 'The user data was not changed. This might be due to permissions (RLS) or if the data was already up-to-date. Please check console for details.',
          variant: 'default',
          duration: 7000,
        });
      } else {
        // Fallback for unexpected scenarios
         toast({
          title: 'Update Status Unknown',
          description: 'The update operation completed, but its status could not be confirmed. Please verify the changes.',
          variant: 'default',
        });
      }

    } catch (error: any) {
      const displayMessage = error.message || error.details || 'An unexpected error occurred. Please try again.';
      console.error(`Error updating user. Supabase Code: ${error.code}, Message: ${error.message}, Details: ${error.details}, Hint: ${error.hint}. Full error:`, error);
      toast({
        title: 'Error Updating User',
        description: displayMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Edit User: {user?.name || 'Loading...'}</CardTitle>
        <CardDescription>Modify the details for this user. Email cannot be changed here.</CardDescription>
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
                    <UserIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    Full Name
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Enter full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <Award className="mr-2 h-4 w-4 text-muted-foreground" />
                    Position
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Sr. Developer" {...field} value={field.value || ''} />
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
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={field.value}
                    disabled={adminUser?.id === userIdToEdit}
                  >
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
                  {adminUser?.id === userIdToEdit && (
                    <p className="text-xs text-muted-foreground pt-1">Admins cannot change their own role.</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => router.push('/admin/users')} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || isLoading}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

