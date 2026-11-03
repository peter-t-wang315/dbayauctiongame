// node pt.mjs <port> <op> [a] [b]   e.g.  node pt.mjs 9101 click 12
const [port, op = 'help', a = '', b = ''] = process.argv.slice(2);
const q = new URLSearchParams({ op, a, b });
const r = await fetch(`http://127.0.0.1:${port}/?${q}`, { signal: AbortSignal.timeout(300000) });
console.log(await r.text());
