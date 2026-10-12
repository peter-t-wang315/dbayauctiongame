import type { Metadata } from 'next';
import Link from 'next/link';
import { RulesContent } from '../../components/rules/RulesContent';

export const metadata: Metadata = { title: 'How to play - dBay' };

export default function RulesPage() {
  return (
    <main className="page" style={{ gap: 8 }}>
      <Link href="/" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', fontWeight: 800 }}>
        ← Home
      </Link>
      <h1 style={{ margin: 0, font: '400 32px/1.2 var(--font-display)' }}>How to play</h1>
      <RulesContent />
    </main>
  );
}
