import { SignupForm } from '@/components/auth/SignupForm';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function SignupPage() {
  return (
    <>
      <CardHeader className="text-center p-0 mb-6">
        <CardTitle className="text-2xl font-bold tracking-tight">Create an Account</CardTitle>
        <CardDescription>Join TaskFlow AI to streamline your project management.</CardDescription>
      </CardHeader>
      <SignupForm />
    </>
  );
}
