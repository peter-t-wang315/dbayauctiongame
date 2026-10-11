// WS0 placeholder. WS4 builds the real landing page (docs/04-ux-and-ui.md).
import { CATEGORIES } from '@dbay/content/public';
import { PROTOCOL_VERSION } from '@dbay/protocol';

export default function Home() {
  return (
    <main>
      <h1>dBay</h1>
      <p>
        Protocol v{PROTOCOL_VERSION}. Categories: {CATEGORIES.map((c) => c.name).join(', ')}.
      </p>
    </main>
  );
}
