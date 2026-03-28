import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { initializeSchema } from './db/schema.js';
import { db } from './db/connection.js';
import { mocks } from './routes/mocks.js';
import { dynamic } from './routes/dynamic.js';
import { config } from './routes/config.js';
import { graphql } from './routes/graphql.js';
import { API_PORT } from '@mocksnap/shared';

// Initialize database
initializeSchema();

// Clean expired mocks on startup and every hour
function cleanExpiredMocks() {
  const expired = db.prepare(
    "SELECT id FROM mocks WHERE expires_at IS NOT NULL AND expires_at < datetime('now')"
  ).all() as { id: string }[];

  for (const { id } of expired) {
    const resources = db.prepare('SELECT name FROM mock_resources WHERE mock_id = ?').all(id) as { name: string }[];
    for (const r of resources) {
      db.exec(`DROP TABLE IF EXISTS "mock_${id.replace(/[^a-zA-Z0-9_]/g, '')}_${r.name.replace(/[^a-zA-Z0-9_]/g, '')}"`);
    }
    db.prepare('DELETE FROM request_logs WHERE mock_id = ?').run(id);
    db.prepare('DELETE FROM mock_resources WHERE mock_id = ?').run(id);
    db.prepare('DELETE FROM mocks WHERE id = ?').run(id);
  }
  if (expired.length > 0) console.log(`Cleaned ${expired.length} expired mock(s)`);
}

cleanExpiredMocks();
setInterval(cleanExpiredMocks, 60 * 60 * 1000);

const app = new Hono();

// Middleware
app.use('*', cors());

// Rate limit for mock creation (IP-based, 10/hour)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

app.use('/api/mocks', async (c, next) => {
  if (c.req.method !== 'POST') return next();

  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (entry && now < entry.resetAt) {
    if (entry.count >= 10) {
      return c.json({ error: 'Rate Limited', message: 'Max 10 mocks per hour. Try again later.' }, 429);
    }
    entry.count++;
  } else {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
  }

  await next();
});

// Routes
app.route('/api/mocks', mocks);
app.route('/api/mocks', config);
app.route('/m', graphql);
app.route('/m', dynamic);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

serve({ fetch: app.fetch, port: API_PORT }, (info) => {
  console.log(`MockSnap API running on http://localhost:${info.port}`);
});
