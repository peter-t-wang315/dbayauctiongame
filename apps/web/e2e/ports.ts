// Single source for e2e ports. Override with E2E_WEB_PORT / E2E_MOCK_PORT (defaults match CI).
export const WEB_PORT = process.env.E2E_WEB_PORT ?? '3100';
export const MOCK_PORT = process.env.E2E_MOCK_PORT ?? '8787';

// Next 16.4.0's dev server detects coding-agent environments (these env vars) and, when the
// installed version has a security advisory, exits with an "upgrade recommendation" instead of
// serving: on first start, and again mid-run, which killed whole-suite runs. Blank the markers for
// the dev server only; harmless in CI where they are unset.
export const AGENT_ENV_OFF: Record<string, string> = Object.fromEntries(
  [
    'AI_AGENT',
    'CLAUDECODE',
    'CLAUDE_CODE',
    'CLAUDE_CODE_IS_COWORK',
    'CODEX_CI',
    'CODEX_SANDBOX',
    'CODEX_THREAD_ID',
    'CURSOR_AGENT',
    'CURSOR_EXTENSION_HOST_ROLE',
    'CURSOR_TRACE_ID',
    'GEMINI_CLI',
    'OPENCODE_CLIENT',
    'ANTIGRAVITY_AGENT',
    'AUGMENT_AGENT',
    'COPILOT_ALLOW_ALL',
    'COPILOT_MODEL',
    'REPL_ID',
  ].map((k) => [k, '']),
);
