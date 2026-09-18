// Plays a monitoring tool: posts alerts to the running app every few seconds,
// firing new ones, repeating open ones (same dedupKey) and resolving them.
//
//   npm run alerts:demo              # until Ctrl+C
//   npm run alerts:demo -- --once    # one alert
//
// Tokens come straight from the SQLite database, so there is nothing to copy.
import Database from 'better-sqlite3';

const url = `http://localhost:${process.env.PORT ?? 3000}`;
const db = new Database(process.env.DATABASE_PATH ?? 'pager-pulse.sqlite', {
  readonly: true,
});
const sources = db.prepare('SELECT name, token FROM alert_source').all();
db.close();
if (sources.length === 0) {
  console.error('No alert sources yet: start the app once so it seeds them.');
  process.exit(1);
}

const CATALOG = [
  ['Error rate above 5% on /v1/checkout', 'critical', 'checkout-5xx'],
  ['Queue depth above 10k on emails', 'major', 'queue-emails'],
  ['p95 latency above 800ms on search', 'major', 'search-latency'],
  ['Disk usage above 85% on db-3', 'minor', 'disk-db-3'],
  ['Pod crash-looping: webhooks-worker', 'major', 'crashloop-webhooks'],
  ['TLS handshake failures from CDN', 'critical', 'cdn-tls'],
  ['Cache hit ratio below 60%', 'minor', 'cache-hit-ratio'],
];

const pick = (items) => items[Math.floor(Math.random() * items.length)];

async function post(source, body) {
  const response = await fetch(`${url}/alerts/ingest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${source.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  const detail = result.alert
    ? ` #${result.alert.id} ×${result.alert.occurrences}`
    : '';
  console.log(
    `${response.status} ${result.outcome ?? result.message}${detail}  ${source.name}: ${body.title}${body.status === 'resolved' ? ' (resolve)' : ''}`,
  );
}

/** Fires most of the time, resolves now and then: open alerts pile up a bit. */
async function tick() {
  // Each kind of alert always comes from the same source, so its dedupKey
  // lands on the same open alert.
  const index = Math.floor(Math.random() * CATALOG.length);
  const [title, severity, dedupKey] = CATALOG[index];
  const source = sources[index % sources.length];
  const status = Math.random() < 0.25 ? 'resolved' : 'firing';
  await post(source, {
    title,
    severity,
    dedupKey,
    status,
    labels: { env: 'production', region: pick(['eu-west-1', 'us-east-1']) },
  });
}

if (process.argv.includes('--once')) {
  await tick();
} else {
  console.log(`Posting to ${url}/alerts/ingest every 4s. Ctrl+C to stop.`);
  for (;;) {
    await tick().catch((error) => console.error(error.message));
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
}
