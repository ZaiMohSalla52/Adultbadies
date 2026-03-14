import Link from 'next/link';
import { Card } from '@/components/ui/card';

const features = [
  {
    title: 'Swipe discovery',
    description: 'Smart profile surfacing keeps every swipe fresh with cinematic card motion and intent-focused matching.',
    accent: 'linear-gradient(130deg, rgba(255, 46, 99, 0.35), rgba(236, 72, 153, 0.1))',
  },
  {
    title: 'Instant chat',
    description: 'Move from match to conversation in seconds with clean message threads and high-contrast readability.',
    accent: 'linear-gradient(130deg, rgba(139, 92, 246, 0.35), rgba(56, 189, 248, 0.08))',
  },
  {
    title: 'Safety controls',
    description: 'Built-in report and block tools with profile signals to help you connect confidently every day.',
    accent: 'linear-gradient(130deg, rgba(16, 185, 129, 0.3), rgba(34, 197, 94, 0.08))',
  },
  {
    title: 'Premium mode',
    description: 'Elevated visibility, advanced filters, and next-level personalization for power users.',
    accent: 'linear-gradient(130deg, rgba(251, 191, 36, 0.3), rgba(245, 158, 11, 0.08))',
  },
];

const testimonials = [
  {
    quote: 'The app feels like a future dating experience. Matches finally feel intentional.',
    person: 'Maya, 27',
  },
  {
    quote: 'Smooth swipes, gorgeous visuals, and the cleanest chat UI I\'ve used in a dating app.',
    person: 'Andre, 31',
  },
  {
    quote: 'Safety tools are actually easy to use, and that makes a huge difference.',
    person: 'Riley, 25',
  },
];

const trustPoints = [
  'Profile moderation + reporting flow',
  'Fast block controls in every core touchpoint',
  'Privacy-first account settings',
  'Designed for respectful connections',
];

export default function PublicHomePage() {
  return (
    <div style={{ display: 'grid', gap: '3.5rem', paddingBottom: '4rem' }}>
      <section
        style={{
          minHeight: 'min(92vh, 880px)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(148, 163, 194, 0.28)',
          overflow: 'hidden',
          position: 'relative',
          background: 'linear-gradient(160deg, rgba(5, 11, 24, 0.72), rgba(5, 11, 24, 0.95))',
          boxShadow: 'var(--shadow-lg)',
          display: 'grid',
          alignItems: 'end',
          padding: 'clamp(1.25rem, 4vw, 3rem)',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 20% 18%, rgba(236, 72, 153, 0.42), transparent 32%), radial-gradient(circle at 82% 20%, rgba(139, 92, 246, 0.4), transparent 35%), radial-gradient(circle at 50% 90%, rgba(14, 165, 233, 0.25), transparent 36%)',
          }}
        />

        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: '8% 4% auto 4%',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '0.65rem',
            opacity: 0.35,
            transform: 'perspective(1200px) rotateX(16deg)',
          }}
        >
          {Array.from({ length: 9 }).map((_, index) => (
            <Card
              key={index}
              className="ui-glass"
              style={{
                minHeight: '110px',
                background:
                  index % 2 === 0
                    ? 'linear-gradient(145deg, rgba(236, 72, 153, 0.26), rgba(15, 23, 42, 0.86))'
                    : 'linear-gradient(145deg, rgba(139, 92, 246, 0.26), rgba(15, 23, 42, 0.86))',
              }}
            />
          ))}
        </div>

        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(5, 11, 24, 0.32), rgba(5, 11, 24, 0.95) 70%)',
          }}
        />

        <div style={{ position: 'relative', zIndex: 2, display: 'grid', gap: '1rem', maxWidth: '44rem' }}>
          <p
            style={{
              margin: 0,
              color: 'var(--text-muted)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontSize: '0.73rem',
              fontWeight: 700,
            }}
          >
            The future of modern dating
          </p>
          <h1 className="hero-gradient-text" style={{ margin: 0, fontSize: 'clamp(2.2rem, 7vw, 5rem)', lineHeight: 1.02 }}>
            Adult Badies turns every swipe into a cinematic connection.
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'clamp(1rem, 2.4vw, 1.2rem)', maxWidth: '55ch' }}>
            Discover people nearby, match instantly, and chat in a premium dark interface designed for speed, trust, and attraction.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link className="ui-button ui-button-primary" href="/sign-up">
              Create account
            </Link>
            <Link className="ui-button ui-button-secondary" href="/sign-in">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gap: '1.25rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          alignItems: 'center',
        }}
      >
        <Card className="ui-glass" style={{ padding: '1.2rem', display: 'grid', gap: '0.75rem' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.74rem' }}>
            Discovery preview
          </p>
          <div style={{ position: 'relative', minHeight: '320px' }}>
            {[0, 1, 2].map((layer) => (
              <div
                key={layer}
                style={{
                  position: 'absolute',
                  inset: layer === 0 ? '0 0 auto 0' : `${layer * 14}px ${layer * 10}px auto ${layer * 10}px`,
                  height: '280px',
                  borderRadius: '22px',
                  border: '1px solid rgba(148, 163, 194, 0.35)',
                  background:
                    layer === 0
                      ? 'linear-gradient(160deg, rgba(236, 72, 153, 0.32), rgba(15, 23, 42, 0.9))'
                      : 'linear-gradient(160deg, rgba(139, 92, 246, 0.24), rgba(15, 23, 42, 0.84))',
                  boxShadow: 'var(--shadow-lg)',
                  transform: `rotate(${layer === 0 ? -3 : layer === 1 ? 2 : 6}deg)`,
                }}
              />
            ))}
            <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', right: '1rem', zIndex: 3 }}>
              <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Ari, 29</p>
              <p style={{ margin: '0.4rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Designer • 4 miles away
              </p>
            </div>
          </div>
        </Card>

        <div style={{ display: 'grid', gap: '0.85rem' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.74rem' }}>
            Swipe-first experience
          </p>
          <h2 style={{ margin: 0, fontSize: 'clamp(1.7rem, 5vw, 2.8rem)', lineHeight: 1.08 }}>
            A phone-native flow designed for instant chemistry.
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', maxWidth: '46ch' }}>
            Profile cards stack with fluid depth, helping you evaluate vibe, values, and attraction in seconds before you commit to a match.
          </p>
        </div>
      </section>

      <section style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {features.map((feature) => (
          <Card key={feature.title} className="ui-glass" style={{ padding: '1.1rem', display: 'grid', gap: '0.6rem', background: feature.accent }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{feature.title}</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.94rem' }}>{feature.description}</p>
          </Card>
        ))}
      </section>

      <section style={{ display: 'grid', gap: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: 'clamp(1.5rem, 4.2vw, 2.3rem)' }}>Loved by ambitious singles worldwide.</h2>
        <div style={{ display: 'grid', gap: '0.9rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {testimonials.map((item) => (
            <Card key={item.person} className="ui-glass" style={{ padding: '1rem', display: 'grid', gap: '0.65rem' }}>
              <p style={{ margin: 0, color: 'var(--text)', fontSize: '0.98rem' }}>&ldquo;{item.quote}&rdquo;</p>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.person}</p>
            </Card>
          ))}
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gap: '0.95rem',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          background: 'linear-gradient(165deg, rgba(11, 18, 38, 0.9), rgba(26, 40, 72, 0.72))',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 'clamp(1.4rem, 4vw, 2.2rem)' }}>Safety first, always.</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)', maxWidth: '56ch' }}>
          Every part of Adult Badies is built to protect your comfort, from profile quality controls to fast moderation tooling.
        </p>
        <div style={{ display: 'grid', gap: '0.7rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {trustPoints.map((point) => (
            <Card key={point} className="ui-glass" style={{ padding: '0.85rem' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>{point}</p>
            </Card>
          ))}
        </div>
      </section>

      <section
        style={{
          borderRadius: 'var(--radius-lg)',
          padding: 'clamp(1.3rem, 4vw, 2.1rem)',
          background: 'linear-gradient(118deg, rgba(255, 46, 99, 0.32), rgba(139, 92, 246, 0.3))',
          border: '1px solid rgba(148, 163, 194, 0.35)',
          display: 'grid',
          gap: '0.9rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 'clamp(1.5rem, 4.5vw, 2.5rem)' }}>Your next match is already waiting.</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)', maxWidth: '48ch' }}>
          Build your profile in minutes and enter a premium dating community designed to move at your pace.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link className="ui-button ui-button-primary" href="/sign-up">
            Create account
          </Link>
          <Link className="ui-button ui-button-secondary" href="/sign-in">
            Sign in
          </Link>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        <p style={{ margin: 0 }}>© {new Date().getFullYear()} Adult Badies. Built for bold connections.</p>
      </footer>
    </div>
  );
}
