import { createServer } from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.NODE_ENV = 'test';

const TOKEN = 'test-sheets-token';

// Minimal stand-in for the deployed Apps Script: same actions, same JSON shapes,
// backed by an in-memory "sheet" with Programs columns.
function startFakeSheet() {
  const rows = [];
  const summary = (p) => ({
    _id: p.id,
    title: p.title,
    organizer: p.organizer,
    type: p.type,
    category: p.category,
    venue: p.venue,
    imageurls: p.imageurls,
    tags: p.tags,
    status: p.status,
    deadline: p.deadline || undefined,
    eventDate: p.eventDate || undefined,
    createdAt: p.createdAt,
  });

  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const url = new URL(req.url, 'http://localhost');
      const q = url.searchParams;
      const send = (payload) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };

      const action = req.method === 'POST' ? JSON.parse(body || '{}').action : q.get('action') || 'GET';
      if (action === 'health') return send({ ok: true });
      if (q.get('token') !== TOKEN) return send({ error: 'Unauthorized' });

      if (action === 'GET') {
        let list = rows.slice();
        if (q.get('category') && q.get('category') !== 'All') list = list.filter((r) => r.category === q.get('category'));
        if (q.get('q')) list = list.filter((r) => String(r.title).toLowerCase().includes(q.get('q').toLowerCase()));
        list.sort((a, b) => (q.get('sort') === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)));
        const total = list.length;
        const limit = Number(q.get('limit')) || 50;
        const page = Number(q.get('page')) || 1;
        const slice = list.slice((page - 1) * limit, (page - 1) * limit + limit);
        return send({ results: slice.length, total, page, pages: Math.ceil(total / limit), programs: q.get('view') === 'summary' ? slice.map(summary) : slice });
      }
      if (action === 'get') {
        const found = rows.find((r) => r.id === q.get('id'));
        return send(found ? { program: found } : { error: 'Program not found' });
      }
      if (action === 'categories') {
        const counts = {};
        rows.forEach((r) => (counts[r.category] = (counts[r.category] || 0) + 1));
        return send({ categories: Object.keys(counts).map((name) => ({ name, count: counts[name] })) });
      }
      if (action === 'count') return send({ total: rows.length });
      if (action === 'countLive') return send({ total: rows.filter((r) => r.status === 'Live').length });

      const data = JSON.parse(body || '{}').data || {};
      if (action === 'create') {
        const now = new Date().toISOString();
        const row = { ...data, id: data.id || crypto.randomUUID(), createdAt: now, updatedAt: now };
        rows.push(row);
        return send({ program: row });
      }
      if (action === 'update') {
        const row = rows.find((r) => r.id === q.get('id'));
        Object.assign(row, data, { updatedAt: new Date().toISOString() });
        return send({ program: row });
      }
      if (action === 'delete') {
        const idx = rows.findIndex((r) => r.id === q.get('id'));
        if (idx === -1) return send({ deleted: false });
        rows.splice(idx, 1);
        return send({ deleted: true });
      }
      send({ error: 'Unknown action' });
    });
  });
  return server;
}

let mongod;
let app;
let sheet;
let sheetUrl;

beforeAll(async () => {
  sheet = startFakeSheet();
  await new Promise((resolve) => sheet.listen(0, '127.0.0.1', resolve));
  sheetUrl = `http://127.0.0.1:${sheet.address().port}/exec`;

  process.env.SHEETS_API_URL = sheetUrl;
  process.env.SHEETS_API_TOKEN = TOKEN;

  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('ogea-sheets-test');
  const { connectDB } = await import('../db.js');
  await connectDB(uri);
  const { User } = await import('../models/User.js');
  await User.create({ name: 'Admin', username: 'admin', email: 'admin@test.dev', password: 'adminpass1', role: 'admin' });
  const { createApp } = await import('../app.js');
  app = createApp({ connect: () => connectDB(uri) });
}, 60000);

afterAll(async () => {
  const { disconnectDB } = await import('../db.js');
  await disconnectDB();
  await mongod?.stop();
  await new Promise((resolve) => sheet.close(resolve));
});

const adminLogin = async () => {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ identifier: 'admin', password: 'adminpass1' });
  return agent;
};

describe('programs on Google Sheets', () => {
  it('reports the sheets datastore', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.body.programs).toBe('sheets');
    expect(res.body.datastore).toBe('sheets');
  });

  it('runs the full CRUD flow through the sheet', async () => {
    const admin = await adminLogin();

    const created = await admin
      .post('/api/v1/programs')
      .send({ title: 'Sheet Quiz', category: 'Quiz', about: 'From the sheet', status: 'Live', deadline: '2030-01-01', tags: ['math'], imageurls: ['https://example.com/a.jpg'] });
    expect(created.status).toBe(201);
    const id = created.body.data.program._id;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    const list = await request(app).get('/api/v1/programs?category=Quiz&q=sheet');
    expect(list.body.total).toBe(1);
    expect(list.body.data.programs[0].about).toBeUndefined();
    expect(list.body.data.programs[0].tags).toEqual(['math']);

    const one = await request(app).get(`/api/v1/programs/${id}`);
    expect(one.status).toBe(200);
    expect(one.body.data.program.about).toBe('From the sheet');
    expect(one.body.data.program.deadline).toBeTruthy();

    const cats = await request(app).get('/api/v1/programs/categories');
    expect(cats.body.data.categories).toEqual([{ name: 'Quiz', count: 1 }]);

    const patched = await admin.patch(`/api/v1/programs/${id}`).send({ status: 'Closed' });
    expect(patched.body.data.program.status).toBe("Closed");

    const stats = await admin.get('/api/v1/admin/stats');
    expect(stats.body.data.programs).toBe(1);
    expect(stats.body.data.livePrograms).toBe(0);

    expect((await request(app).get(`/api/v1/programs/${id}`)).status).toBe(200);
    expect((await admin.delete(`/api/v1/programs/${id}`)).status).toBe(204);
    expect((await request(app).get(`/api/v1/programs/${id}`)).status).toBe(404);
  });

  it('requires admin rights for writes', async () => {
    expect((await request(app).post('/api/v1/programs').send({ title: 'x', category: 'Quiz' })).status).toBe(401);
  });

  it('maps an unreachable sheet to 503, not a 500', async () => {
    const { sheetsClient } = await import('../sheets/client.js');
    const { config } = await import('../config.js');
    const original = config.sheets.apiUrl;
    config.sheets.apiUrl = 'http://127.0.0.1:1/exec';
    await expect(sheetsClient.list({})).rejects.toMatchObject({ statusCode: 503 });
    config.sheets.apiUrl = original;
  });
});
