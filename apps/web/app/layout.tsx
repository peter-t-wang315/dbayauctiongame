import type { ReactNode } from 'react';

export const metadata = { title: 'dBay', description: 'Bid fast. Hope it is real gold.' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
