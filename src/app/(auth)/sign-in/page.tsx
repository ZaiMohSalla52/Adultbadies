import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function SignInPage() {
  return (
    <Card className="max-w-md">
      <h1 className="mt-0 mb-2 text-lg font-semibold">Sign in</h1>
      <p className="mb-6 text-sm text-muted">Supabase Auth will be connected in Stage 1.</p>
      <form className="flex flex-col gap-4">
        <Input type="email" placeholder="Email" />
        <Input type="password" placeholder="Password" />
        <Button type="submit">Continue</Button>
      </form>
    </Card>
  );
}
