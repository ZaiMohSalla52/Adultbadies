import Link from 'next/link';
import { Card } from '@/components/ui/card';

const linkStyles =
  'inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors';

export default function PublicHomePage() {
  return (
    <Card className="max-w-2xl">
      <h1 className="my-0 text-3xl font-bold leading-tight">Adult Badies</h1>
      <p className="text-muted">Stage 2 auth foundation is in place for secure account access.</p>
      <div className="flex gap-3">
        <Link className={`${linkStyles} bg-brand text-white hover:bg-brand-strong`} href="/sign-up">
          Create Account
        </Link>
        <Link className={`${linkStyles} bg-surface-2 text-foreground hover:bg-surface-3`} href="/sign-in">
          Sign In
        </Link>
      </div>
    </Card>
  );
}
