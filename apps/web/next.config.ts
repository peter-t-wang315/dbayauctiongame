import type { NextConfig } from 'next';

const config: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@dbay/protocol', '@dbay/content'],
  // Dev only: opening the app from 127.0.0.1 or a LAN IP (phone testing) is cross-origin to the
  // dev server. Without these, hydration and RSC navigation are blocked and "Create a room"
  // hangs on "Creating...".
  allowedDevOrigins: ['127.0.0.1', '192.168.*.*', '10.*.*.*', '172.*.*.*', '*.local'],
  // Dev only: hide the Next dev-tools pill; on phones it sat over the hand and ate taps in local
  // playtests (playtest B10). Production never shows it.
  devIndicators: false,
};

export default config;
