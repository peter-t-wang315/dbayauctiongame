import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

export const metadata = { title: 'dBay', description: 'Bid fast. Hope it is real gold.' };
// Never disable pinch zoom (04 section 8).
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

// Self-hosted (OFL; licenses in ./fonts) so builds and dev make no network font requests.
const lilita = localFont({
  src: './fonts/LilitaOne-Regular.woff2',
  weight: '400',
  display: 'swap',
  variable: '--font-lilita',
});
const nunito = localFont({
  src: './fonts/Nunito-Variable.woff2',
  weight: '200 1000',
  display: 'swap',
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
