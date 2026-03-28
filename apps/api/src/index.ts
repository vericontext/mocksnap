import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { initializeSchema } from './db/schema.js';
import { mocks } from './routes/mocks.js';
import { dynamic } from './routes/dynamic.js';
import { config } from './routes/config.js';
import { graphql } from './routes/graphql.js';
import { API_PORT } from '@mocksnap/shared';

// Initialize database
initializeSchema();

const app = new Hono();

// Middleware
app.use('*', cors());

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
