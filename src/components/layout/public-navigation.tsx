import Link from 'next/link';

const navItems = [
  { label: 'Discover', href: '#discover' },
  { label: 'Chat', href: '#chat' },
  { label: 'Safety', href: '#safety' },
  { label: 'Stories', href: '#stories' },
];

export function PublicNavigation() {
  return (
    <header className="marketing-header">
      <div className="marketing-container marketing-nav-row">
        <Link href="/home" className="marketing-brand" aria-label="Adult Badies home">
          <span className="marketing-brand-mark" aria-hidden>
            AB
          </span>
          <span>Adult Badies</span>
        </Link>

        <nav className="marketing-nav-links" aria-label="Main navigation">
          {navItems.map((item) => (
            <a key={item.label} href={item.href} className="marketing-nav-link">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="marketing-nav-actions">
          <Link className="ui-button ui-button-ghost" href="/sign-in">
            Sign in
          </Link>
          <Link className="ui-button ui-button-primary" href="/sign-up">
            Join now
          </Link>
        </div>
      </div>
    </header>
  );
}
