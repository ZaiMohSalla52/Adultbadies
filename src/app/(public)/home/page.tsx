import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PublicHomePage() {
  return (
    <Card className="max-w-2xl">
      <h1 className="my-0 text-3xl font-bold leading-tight">Adult Badies</h1>
      <p className="text-muted">Stage 0 foundation is ready for auth, app, and admin workflows.</p>
      <div className="flex gap-3">
        <Button>Get Started</Button>
        <Button variant="secondary">Read Docs</Button>
      </div>
    </Card>
  );
}
