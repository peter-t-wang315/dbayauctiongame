import Link from 'next/link';
import { Wordmark } from '../components/shell/Wordmark';
import { LandingActions } from './LandingActions';
import { LotRow } from './LotRow';

export default function Home() {
  return (
    <main className="page" style={{ alignItems: 'center', gap: 24, paddingTop: 48 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Wordmark />
        <p style={{ margin: 0, fontWeight: 800, color: 'var(--text)' }}>
          Bid fast. Hope it&apos;s real gold.
        </p>
      </div>
      <LotRow />
      <p className="landing-pitch">Bid cards on mystery items. Best collection wins.</p>
      <LandingActions />
      <Link href="/rules" className="btn btn--outline">
        How to play
      </Link>
    </main>
  );
}
