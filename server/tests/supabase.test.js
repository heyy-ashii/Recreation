import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Runs the whole API against a real Postgres. The schema in
// supabase/migrations/0001_init.sql is applied first. Point TEST_DATABASE_URL at
// a throwaway database; without it the suite is skipped.
//
//   TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/ogea npm test
//
process.env.NODE_ENV = 'test';

const DB_URL = process.env.TEST_DATABASE_URL;
const describeIfDb = DB_URL ? describe : describe.skip;

let app;
let db;
let closePool;

const TABLES = ['app_messages', 'app_conversations', 'app_otps', 'app_programs', 'app_users'];

beforeAll(async () => {
  if (!DB_URL) return;
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_DB_URL = DB_URL;

  // `pg` reads the connection string; tests need a clean slate.
  ({ getPool: db, closePool } = await import('../supabase/db.js'));
  await db().query('truncate ' + TABLES.join(', ') + ' restart identity cascade');

  const { createApp } = await import('../app.js');
  app = createApp({ connect: () => Promise.reject(new Error('MongoDB must not be used in supabase mode')) });
}, 60000);

afterAll(async () => {
  if (closePool) await closePool();
});

describeIfDb('OGEA on Supabase (Postgres)', () => {
  it('reports the supabase datastore', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.body.datastore).toBe('supabase');
    expect(res.body.programs).toBe('supabase');
  });

  it('signs up with OTP, logs in and reads /me', async () => {
    const otp = await request(app).post('/api/v1/auth/signup/request-otp').send({ email: 'new@student.dev' });
    expect(otp.status).toBe(200);
    expect(otp.body.devCode).toMatch(/^\d{6}$/);

    const agent = request.agent(app);
    const ok = await agent
      .post('/api/v1/auth/signup/verify')
      .send({ email: 'new@student.dev', code: otp.body.devCode, name: 'New', username: 'newbie', password: 'password1' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.user.role).toBe('user');
    expect(ok.body.data.user).not.toHaveProperty('password');

    const me = await agent.get('/api/v1/auth/me');
    expect(me.body.data.user.username).toBe('newbie');

    const login = await request(app).post('/api/v1/auth/login').send({ identifier: 'newbie', password: 'password1' });
    expect(login.status).toBe(200);

    const bad = await request(app).post('/api/v1/auth/login').send({ identifier: 'newbie', password: 'wrongpass' });
    expect(bad.status).toBe(401);
  });

  it('enforces the OTP resend cooldown and rejects a wrong code', async () => {
    await request(app).post('/api/v1/auth/signup/request-otp').send({ email: 'otp@student.dev' });
    const again = await request(app).post('/api/v1/auth/signup/request-otp').send({ email: 'otp@student.dev' });
    expect(again.status).toBe(429);

    const wrong = await request(app)
      .post('/api/v1/auth/signup/verify')
      .send({ email: 'otp@student.dev', code: '000000', name: 'Otp', username: 'otpuser', password: 'password1' });
    expect(wrong.status).toBe(400);
  });

  it('runs the admin user lifecycle', async () => {
    const { User } = await import('../models/User.js');
    await User.create({ name: 'Admin', username: 'admin', email: 'admin@test.dev', password: 'adminpass1', role: 'admin', emailVerified: true });

    const agent = request.agent(app);
    expect((await agent.post('/api/v1/auth/login').send({ identifier: 'admin', password: 'adminpass1' })).status).toBe(200);

    const created = await agent.post('/api/v1/admin/users').send({ name: 'Made', username: 'made', password: 'madepass1' });
    expect(created.status).toBe(201);
    const id = created.body.data.user._id;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    const list = await agent.get('/api/v1/admin/users?q=made');
    expect(list.body.data.users.map((u) => u.username)).toContain('made');

    const edited = await agent.patch(`/api/v1/admin/users/${id}`).send({ name: 'Made 2', role: 'admin' });
    expect(edited.body.data.user.name).toBe('Made 2');
    expect(edited.body.data.user.role).toBe('admin');

    const stats = await agent.get('/api/v1/admin/stats');
    expect(stats.body.data.users).toBeGreaterThanOrEqual(3);
    expect(stats.body.data.admins).toBe(2);

    await agent.patch(`/api/v1/admin/users/${id}`).send({ status: 'disabled' });
    expect((await request(app).post('/api/v1/auth/login').send({ identifier: 'made', password: 'madepass1' })).status).toBe(403);

    expect((await agent.delete(`/api/v1/admin/users/${id}`)).status).toBe(204);
    expect((await agent.get(`/api/v1/admin/users?q=made`)).body.data.users).toHaveLength(0);
  });

  it('runs programs CRUD', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ identifier: 'admin', password: 'adminpass1' });

    const created = await agent
      .post('/api/v1/programs')
      .send({ title: 'Postgres Quiz', category: 'Quiz', about: 'From Postgres', status: 'Live', deadline: '2030-01-01', tags: ['math'], imageurls: ['https://example.com/a.jpg'] });
    expect(created.status).toBe(201);
    const id = created.body.data.program._id;

    const one = await request(app).get(`/api/v1/programs/${id}`);
    expect(one.body.data.program.about).toBe('From Postgres');
    expect(one.body.data.program.deadline).toBeTruthy();
    expect(one.body.data.program.tags).toEqual(['math']);

    const search = await request(app).get('/api/v1/programs?q=postgres');
    expect(search.body.data.programs.map((p) => p._id)).toContain(id);

    const cats = await request(app).get('/api/v1/programs/categories');
    expect(cats.body.data.categories).toEqual([{ name: 'Quiz', count: 1 }]);

    const stats = await agent.get('/api/v1/admin/stats');
    expect(stats.body.data.programs).toBe(1);
    expect(stats.body.data.livePrograms).toBe(1);

    const updated = await agent.patch(`/api/v1/programs/${id}`).send({ status: 'Closed' });
    expect(updated.body.data.program.status).toBe('Closed');

    expect((await agent.delete(`/api/v1/programs/${id}`)).status).toBe(204);
    expect((await request(app).get(`/api/v1/programs/${id}`)).status).toBe(404);
  });

  it('rejects an unknown program id without a 500', async () => {
    const res = await request(app).get('/api/v1/programs/not-a-uuid');
    expect(res.status).toBe(400);
  });

  it('runs the chat flow', async () => {
    const user = request.agent(app);
    const otp = await request(app).post('/api/v1/auth/signup/request-otp').send({ email: 'chat@student.dev' });
    await user
      .post('/api/v1/auth/signup/verify')
      .send({ email: 'chat@student.dev', code: otp.body.devCode, name: 'Chat', username: 'chatter', password: 'password1' });

    const sent = await user.post('/api/v1/chat/me/messages').send({ body: 'Hello admin' });
    expect(sent.status).toBe(201);

    const mine = await user.get('/api/v1/chat/me');
    expect(mine.body.data.messages[0].body).toBe('Hello admin');
    expect(mine.body.data.conversation.unreadForAdmin).toBe(1);

    const unread = await user.get('/api/v1/chat/me/unread');
    expect(unread.body.data.unread).toBe(0);

    const admin = request.agent(app);
    await admin.post('/api/v1/auth/login').send({ identifier: 'admin', password: 'adminpass1' });
    const inbox = await admin.get('/api/v1/chat/conversations');
    expect(inbox.body.data.conversations).toHaveLength(1);
    expect(inbox.body.data.conversations[0].user.username).toBe('chatter');

    const convoId = inbox.body.data.conversations[0]._id;
    const reply = await admin.post(`/api/v1/chat/conversations/${convoId}/messages`).send({ body: 'Hi there' });
    expect(reply.status).toBe(201);

    const thread = await user.get('/api/v1/chat/me');
    expect(thread.body.data.messages.map((m) => m.body)).toEqual(['Hello admin', 'Hi there']);
    expect(thread.body.data.conversation.unreadForUser).toBe(0);

    const closed = await admin.patch(`/api/v1/chat/conversations/${convoId}`).send({ status: 'closed' });
    expect(closed.body.data.conversation.status).toBe('closed');
  });
});
