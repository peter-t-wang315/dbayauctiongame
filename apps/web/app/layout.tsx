import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import { Lilita_One, Nunito } from 'next/font/google';
import './globals.css';

export const metadata = { title: 'dBay', description: 'Bid fast. Hope it is real gold.' };
// Never disable pinch zoom (04 section 8).
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

const lilita = Lilita_One({ weight: '400', subsets: ['latin'], variable: '--font-lilita' });
const nunito = Nunito({
  weight: ['600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-nunito',
});

// Light is the default; only an explicit saved choice switches to dark (04 section 13).
const THEME_INIT = `try{if(localStorage.getItem('dbay:theme')==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${lilita.variable} ${nunito.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
