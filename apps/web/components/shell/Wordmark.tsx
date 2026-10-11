// d-B-a-y wordmark in red, blue, yellow and green (04 section 12). Our own mark, no eBay shapes or fonts.
export function Wordmark({ size = 88 }: { size?: number }) {
  const style = {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontWeight: 400,
    fontSize: size,
    lineHeight: 1,
    letterSpacing: 1,
    WebkitTextStroke: `${Math.max(2, size / 30)}px var(--ink)`,
    paintOrder: 'stroke fill',
  } as const;
  return (
    <h1 style={style} aria-label="dBay">
      <span aria-hidden="true">
        <span style={{ color: 'var(--p-red)' }}>d</span>
        <span style={{ color: 'var(--p-blue)' }}>B</span>
        <span style={{ color: 'var(--p-yellow)' }}>a</span>
        <span style={{ color: 'var(--p-green)' }}>y</span>
      </span>
    </h1>
  );
}
