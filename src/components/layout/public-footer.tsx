import Link from 'next/link';

const footerGroups = [
  {
    title: 'Product',
    links: [
      { label: 'Discovery', href: '#discover' },
      { label: 'Messaging', href: '#chat' },
      { label: 'Premium', href: '#premium' },
    ],
  },
  {
    title: 'Trust',
    links: [
      { label: 'Safety Center', href: '#safety' },
      { label: 'Community Guidelines' },
      { label: 'Privacy' },
    ],
  },
  {
    title: 'Support',
    links: [{ label: 'Help' }, { label: 'Contact' }, { label: 'Accessibility' }],
  },
] as const;

export function PublicFooter() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-container marketing-footer-grid">
        <div className="marketing-footer-brand">
          <p className="marketing-footer-title">Adult Badies</p>
          <p className="marketing-footer-copy">A premium mobile-first dating experience built for chemistry, confidence, and real connection.</p>
        </div>

        {footerGroups.map((group) => (
          <div key={group.title}>
            <p className="marketing-footer-title">{group.title}</p>
            <ul className="marketing-footer-list">
              {group.links.map((link) => (
                <li key={link.label}>
                  {'href' in link ? (
                    <Link href={link.href} className="marketing-footer-link">
                      {link.label}
                    </Link>
                  ) : (
                    <span className="marketing-footer-link marketing-footer-link-disabled" aria-disabled>
                      {link.label} (coming soon)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="marketing-container marketing-footer-meta">© {new Date().getFullYear()} Adult Badies. Built for bold connections.</div>
    </footer>
  );
}
