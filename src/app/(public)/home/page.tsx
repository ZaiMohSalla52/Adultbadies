import Link from 'next/link';

const showcaseItems = [
  {
    title: 'Discovery that reads your vibe',
    description: 'See people based on intent, proximity, and chemistry signals so every swipe feels more relevant.',
    icon: (
      <path
        d="M12 5.75a6.25 6.25 0 0 1 6.25 6.25c0 1.8-.76 3.42-1.97 4.56L12 20.75l-4.28-4.2A6.22 6.22 0 0 1 5.75 12 6.25 6.25 0 0 1 12 5.75Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    ),
  },
  {
    title: 'Chat that keeps momentum',
    description: 'Fast, high-contrast conversation threads help matches turn into plans without friction.',
    icon: (
      <path
        d="M6.25 6.25h11.5v8.5H10l-3.75 3.25v-3.25h0A2 2 0 0 1 4.25 12.75v-4.5a2 2 0 0 1 2-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    ),
  },
  {
    title: 'Safety built into every layer',
    description: 'One-tap report and block controls with active moderation protect your experience.',
    icon: (
      <path d="M12 4.5 6.5 6.75v4.5c0 3.58 2.4 6.9 5.5 8.25 3.1-1.35 5.5-4.67 5.5-8.25v-4.5L12 4.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    ),
  },
];

const testimonials = [
  {
    quote: 'It feels premium from the first swipe. The quality of matches is noticeably better.',
    person: 'Maya, 27',
  },
  {
    quote: 'The chat experience is elegant and fast. It actually makes conversations fun again.',
    person: 'Andre, 31',
  },
  {
    quote: 'I appreciate how visible the safety controls are. It gives me confidence to connect.',
    person: 'Riley, 25',
  },
];

export default function PublicHomePage() {
  return (
    <div className="marketing-page">
      <section className="marketing-hero">
        <div className="marketing-hero-media" aria-hidden>
          <div className="marketing-hero-image marketing-hero-image-main" />
          <div className="marketing-hero-image marketing-hero-image-alt" />
        </div>
        <div className="marketing-container marketing-hero-content">
          <p className="marketing-kicker">Futuristic dating for modern singles</p>
          <h1>Adult Badies makes every swipe feel intentional, premium, and alive.</h1>
          <p>
            Discover people with real chemistry, move naturally into chat, and build connections in a photo-first experience crafted for speed and trust.
          </p>
          <div className="marketing-hero-actions">
            <Link className="ui-button ui-button-primary" href="/sign-up">
              Create account
            </Link>
            <Link className="ui-button ui-button-secondary" href="/sign-in">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <section id="discover" className="marketing-section">
        <div className="marketing-container">
          <div className="marketing-section-head">
            <p className="marketing-kicker">Discovery</p>
            <h2>Designed for attraction-first discovery on every screen.</h2>
          </div>
          <div className="marketing-feature-grid">
            {showcaseItems.map((item) => (
              <article key={item.title} className="marketing-feature-card">
                <span className="marketing-feature-icon" aria-hidden>
                  <svg viewBox="0 0 24 24">{item.icon}</svg>
                </span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="chat" className="marketing-section">
        <div className="marketing-container marketing-media-split">
          <div>
            <p className="marketing-kicker">Chat experience</p>
            <h2>From match to conversation in seconds.</h2>
            <p className="marketing-support-copy">
              Clean typography, confident contrast, and mobile-first composition keep the focus on people, not noisy interface chrome.
            </p>
          </div>
          <div className="marketing-panel-image" />
        </div>
      </section>

      <section id="safety" className="marketing-section">
        <div className="marketing-container marketing-trust-panel">
          <p className="marketing-kicker">Safety & trust</p>
          <h2>A safer space for better connections.</h2>
          <p className="marketing-support-copy">Moderation, reporting, and profile quality checks are visible, fast, and built into the core experience.</p>
          <div className="marketing-trust-points">
            <span>Identity-aware profile checks</span>
            <span>One-tap report and block actions</span>
            <span>Privacy-first controls</span>
            <span>Community safety standards</span>
          </div>
        </div>
      </section>

      <section id="stories" className="marketing-section">
        <div className="marketing-container">
          <div className="marketing-section-head">
            <p className="marketing-kicker">Social proof</p>
            <h2>Loved by ambitious singles worldwide.</h2>
          </div>
          <div className="marketing-testimonial-grid">
            {testimonials.map((item) => (
              <article key={item.person} className="marketing-testimonial-card">
                <p>&ldquo;{item.quote}&rdquo;</p>
                <span>{item.person}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="premium" className="marketing-section">
        <div className="marketing-container marketing-final-cta">
          <p className="marketing-kicker">Ready to match?</p>
          <h2>Step into a premium dating network built for momentum.</h2>
          <p className="marketing-support-copy">Set up your profile in minutes and connect with people who match your energy.</p>
          <div className="marketing-hero-actions">
            <Link className="ui-button ui-button-primary" href="/sign-up">
              Join Adult Badies
            </Link>
            <Link className="ui-button ui-button-secondary" href="/sign-in">
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
