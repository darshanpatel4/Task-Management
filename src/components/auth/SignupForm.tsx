
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
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/types';
import { User, Mail, Lock, Briefcase, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useState } from 'react';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  role: z.enum(['Admin', 'User'], { required_error: 'Role is required.' }),
});

export function SignupForm() {
  const { mockLogin } = useAuth(); // For mock signup fallback
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'User',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    if (supabase) {
      // Attempt Supabase signup
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      });

      if (signUpError) {
        toast({
          title: 'Signup Failed',
          description: signUpError.message || 'Could not create account with Supabase.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      if (signUpData.user) {
        // User signed up in Supabase auth. Now create a profile in 'profiles' table.
        // Ensure you have a 'profiles' table with columns: id (matches auth.users.id), full_name, role, avatar_url
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({ 
            id: signUpData.user.id, 
            full_name: values.name, 
            role: values.role,
            // avatar_url: can be set later or a default
          });

        if (profileError) {
          toast({
            title: 'Profile Creation Failed',
            description: profileError.message || 'User signed up, but profile creation failed. Please contact support.',
            variant: 'destructive',
          });
          // Potentially clean up the auth user if profile creation is critical
        } else {
          toast({
            title: 'Signup Successful!',
            description: 'Your account has been created. Please check your email to confirm if required by settings, then log in.',
          });
          // If email confirmation is off, user might be logged in.
          // AuthContext's onAuthStateChange will handle setting the user.
          // Redirect to login page, or dashboard if auto-login happens.
           router.push('/auth/login'); 
        }
      } else {
         // Should not happen if signUpError is null, but good to handle
         toast({
          title: 'Signup Issue',
          description: 'An unexpected issue occurred during signup.',
          variant: 'destructive',
        });
      }

    } else {
      // Fallback to mock signup if Supabase client is not initialized
      toast({
        title: "Supabase Not Configured",
        description: "Using mock signup. Please configure Supabase environment variables for full functionality.",
        variant: "default",
        duration: 5000,
      });
      const user = mockLogin(values.email, values.name); // mockLogin can create a user
      if (user) {
        // Mock update role - in a real app, role comes from DB
        user.role = values.role as UserRole; 
        localStorage.setItem('currentUser', JSON.stringify(user)); 

        toast({
          title: 'Mock Signup Successful',
          description: `Welcome, ${user.name}! Your mock account has been created.`,
        });
        router.push('/dashboard');
      } else {
        toast({
          title: 'Mock Signup Failed',
          description: 'Could not create mock account. Please try again.',
          variant: 'destructive',
        });
      }
    }
    setIsLoading(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center">
                <User className="mr-2 h-4 w-4 text-muted-foreground" />
                Full Name
              </FormLabel>
              <FormControl>
                <Input placeholder="e.g. John Doe" {...field} />
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
                <Input placeholder="e.g. user@taskflow.ai" {...field} />
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
                <Input type="password" placeholder="••••••••" {...field} />
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
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Account
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </Form>
  );
}
