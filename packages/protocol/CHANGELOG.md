# @dbay/protocol changelog

## 2 (PROTOCOL_VERSION = 2)

- Additive: `length: 'quick' | 'standard'` on `setOpts` (optional) and on `PlayerView.opts`
  (optional; absent means `'standard'`). New exports `LENGTH_OPTIONS`, `GameLengthSchema`,
  `GameLength`, `DEFAULT_LENGTH`. Version bumped so a stale client cannot silently miss the option.

## 1

- Initial contract (WS0).
