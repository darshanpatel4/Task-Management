
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect all attempts to access this page to the login page.
    router.replace('/auth/login');
  }, [router]);

  return (
    // Show a loading/redirecting state while the redirect happens.
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Redirecting...</CardTitle>
                <CardDescription>Public signup is disabled. Redirecting to login.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
                 <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
        </Card>
    </div>
  );
}
