import Link from 'next/link';
import { Wordmark } from '../components/shell/Wordmark';
import { LandingActions } from './LandingActions';

export default function Home() {
  return (
    <main className="page" style={{ alignItems: 'center', gap: 24, paddingTop: 48 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Wordmark />
        <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-dim)' }}>
          Bid fast. Hope it&apos;s real gold.
        </p>
      </div>
      <LandingActions />
      <Link
        href="/rules"
        style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', fontWeight: 800 }}
      >
        How to play
      </Link>
    </main>
  );
}
