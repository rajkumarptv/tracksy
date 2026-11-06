import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { PageShell, PageHeader } from './ui';

/** Placeholder shown instead of a page that isn't released yet (see src/config/features.js). */
export default function ComingSoon({ title, subtitle, description, actions = [] }) {
  return (
    <PageShell maxWidth={720}>
      <PageHeader title={title} subtitle={subtitle} />
      <section className="card" role="status" aria-live="polite"
        style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{
          width: 56, height: 56, margin: '0 auto 16px', borderRadius: '50%',
          background: 'var(--accent-light)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Clock size={26} strokeWidth={1.75} aria-hidden="true" />
        </div>
        <span style={{
          display: 'inline-block', padding: '3px 12px', borderRadius: 'var(--radius-pill)',
          background: 'var(--accent-light)', color: 'var(--accent)', fontSize: 13, fontWeight: 600, marginBottom: 12,
        }}>Coming soon</span>
        <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)', marginBottom: 8 }}>
          {title} is on its way
        </h2>
        <p style={{ fontSize: 15, color: 'var(--text3)', lineHeight: 1.6, maxWidth: 440, margin: '0 auto 24px' }}>
          {description}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {actions.map((a, i) => (
            <Link key={a.to} to={a.to} className={`btn ${i === 0 ? 'btn-primary' : 'btn-ghost'}`}>{a.label}</Link>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
