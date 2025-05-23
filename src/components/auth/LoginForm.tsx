
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
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useState } from 'react';

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export function LoginForm() {
  const { mockLogin } = useAuth(); // Get mockLogin from context for fallback
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    if (supabase) {
      // Attempt Supabase login
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        toast({
          title: 'Login Failed',
          description: error.message || 'Invalid Supabase credentials. Please try again.',
          variant: 'destructive',
        });
      } else if (data.user) {
        // AuthContext's onAuthStateChange will handle profile fetching and setting currentUser
        toast({
          title: 'Login Successful',
          description: `Welcome back!`, // Name will be updated by AuthContext
        });
        router.push('/dashboard'); // onAuthStateChange in AuthContext will also manage redirection if needed
      }
    } else {
      // Fallback to mock login if Supabase client is not initialized
      toast({
        title: "Supabase Not Configured",
        description: "Using mock login. Please configure Supabase environment variables for full functionality.",
        variant: "default",
        duration: 5000,
      });
      const user = mockLogin(values.email, undefined); // Use mockLogin from context
      if (user) {
        toast({
          title: 'Mock Login Successful',
          description: `Welcome back, ${user.name}!`,
        });
        router.push('/dashboard');
      } else {
        toast({
          title: 'Mock Login Failed',
          description: 'Invalid mock credentials. Please try again.',
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
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </Form>
  );
}
