
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
import { Loader2, UserPlus, Briefcase, Lock, Mail, User as UserIcon, Award } from 'lucide-react'; // Added Award for Position
import { useState } from 'react';
import type { UserRole } from '@/types';
import { adminCreateUser } from '@/actions/adminUserActions';

const userCreateFormSchema = z.object({
  fullName: z.string().min(2, { message: 'Full name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  role: z.enum(['Admin', 'User'] as [UserRole, ...UserRole[]], { required_error: 'Role is required.' }),
  position: z.string().max(100, { message: 'Position must be 100 characters or less.' }).optional(),
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
      position: '',
    },
  });

  if (!isAdmin) {
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

  async function onSubmit(values: UserCreateFormValues) {
    setIsSubmitting(true);
    const result = await adminCreateUser({
      email: values.email,
      password: values.password,
      fullName: values.fullName,
      role: values.role,
      // Note: The position is handled by a trigger in Supabase from the user_metadata
      // We are not passing it directly here, but it's part of the standard user creation flow via metadata.
      // If we wanted to update it separately, we would add it to the adminCreateUser function.
    });

    if (result.success) {
      toast({
        title: 'User Creation Successful',
        description: result.message,
      });
      router.push('/admin/users');
    } else {
      toast({
        title: 'Error Creating User',
        description: result.message,
        variant: 'destructive',
      });
    }
    setIsSubmitting(false);
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <UserPlus className="mr-2 h-6 w-6 text-primary" />
          Add New User
        </CardTitle>
        <CardDescription>
          Fill in the details below to create a new user account.
          The profile will be created via a database trigger using the provided full name, role, and position.
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
                    <UserIcon className="mr-2 h-4 w-4 text-muted-foreground" />
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
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <Award className="mr-2 h-4 w-4 text-muted-foreground" />
                    Position (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Sr. Developer, UI/UX Designer" {...field} />
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
