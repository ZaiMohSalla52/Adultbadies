import Link from 'next/link';
import { Card } from '@/components/ui/card';

export default function PublicHomePage() {
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card className="pulse-border" style={{ padding: '1.4rem' }}>
        <p style={{ margin: 0, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.75rem' }}>
          Futuristic dating experience
        </p>
        <h1 className="hero-gradient-text" style={{ margin: '0.6rem 0', fontSize: 'clamp(2rem, 8vw, 3.6rem)', lineHeight: 1.05 }}>
          Adult Badies
        </h1>
        <p style={{ marginTop: 0, color: 'var(--text-muted)', maxWidth: '50ch' }}>
          Swipe with cinematic motion, connect instantly, and chat inside a premium neon universe designed for mobile-first romance.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link className="ui-button ui-button-primary" href="/sign-up">
            Create account
          </Link>
          <Link className="ui-button ui-button-secondary" href="/sign-in">
            Sign in
          </Link>
        </div>
      </Card>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {[
          'Photo-first discovery cards with gesture-ready controls',
          'Animated onboarding flow and premium glassmorphism surfaces',
          'Modern messaging with high-contrast readable bubbles',
        ].map((item) => (
          <Card key={item} style={{ padding: '1rem' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>{item}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
