import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.ROSTER_CSV = 'AD.NO,NAME,PHONE,EMAIL\n3411,New Student,,\n9999,Lock User,,\n';

let mongod;
let app;
let User;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const { connectDB } = await import('../db.js');
  const uri = mongod.getUri('ogea-test');
  await connectDB(uri);
  ({ User } = await import('../models/User.js'));
  const { createApp } = await import('../app.js');
  app = createApp({ connect: () => connectDB(uri) });
  await User.create({ name: 'Admin', username: 'admin', email: 'admin@test.dev', password: 'adminpass1', role: 'admin' });
}, 60000);

afterAll(async () => {
  const { disconnectDB } = await import('../db.js');
  await disconnectDB();
  await mongod?.stop();
});

const login = async (identifier, password) => {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/login').send({ identifier, password });
  return { agent, res };
};

describe('auth', () => {
  it('creates an account for a student on the roster', async () => {
    const agent = request.agent(app);
    const ok = await agent.post('/api/v1/auth/signup').send({ name: 'New Student', admissionNo: '3411' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.user.username).toBe('new.student');
    expect(ok.body.data.user.role).toBe('user');
    expect(ok.body.data.user).not.toHaveProperty('password');
    expect(ok.headers['set-cookie'][0]).toMatch(/HttpOnly/);

    const me = await agent.get('/api/v1/auth/me');
    expect(me.body.data.user.username).toBe('new.student');

    // The admission number is the initial password.
    expect((await login('new.student', '3411')).res.status).toBe(200);

    // A second signup for the same student is rejected.
    expect((await request(app).post('/api/v1/auth/signup').send({ name: 'New Student', admissionNo: '3411' })).status).toBe(409);
  });

  it('rejects a name or admission number that is not on the roster', async () => {
    const badName = await request(app).post('/api/v1/auth/signup').send({ name: 'Nobody Here', admissionNo: '3411' });
    expect(badName.status).toBe(403);
    const badAdNo = await request(app).post('/api/v1/auth/signup').send({ name: 'New Student', admissionNo: '1234' });
    expect(badAdNo.status).toBe(403);
  });

  it('rejects bad credentials and locks after repeated failures', async () => {
    await User.create({ name: 'Lock', username: 'locky', password: 'password1' });
    for (let i = 0; i < 5; i++) {
      const { res } = await login('locky', 'wrongpass');
      expect(res.status).toBe(401);
    }
    const { res } = await login('locky', 'password1');
    expect(res.status).toBe(423);
  });

  it('resets password with OTP', async () => {
    await User.create({ name: 'New', username: 'newbie', email: 'new@student.dev', password: '3411' });
    const req1 = await request(app).post('/api/v1/auth/password/request-otp').send({ email: 'new@student.dev' });
    expect(req1.body.devCode).toMatch(/^\d{6}$/);
    const reset = await request(app)
      .post('/api/v1/auth/password/reset')
      .send({ email: 'new@student.dev', code: req1.body.devCode, password: 'newpassword1' });
    expect(reset.status).toBe(200);
    expect((await login('newbie', 'newpassword1')).res.status).toBe(200);

    const unknown = await request(app).post('/api/v1/auth/password/request-otp').send({ email: 'nobody@x.dev' });
    expect(unknown.status).toBe(200);
    expect(unknown.body.devCode).toBeUndefined();
  });
});

describe('admin users', () => {
  it('blocks non-admins', async () => {
    expect((await request(app).get('/api/v1/admin/users')).status).toBe(401);
    const { agent } = await login('newbie', 'newpassword1');
    expect((await agent.get('/api/v1/admin/users')).status).toBe(403);
  });

  it('creates, edits, resets password, disables and deletes users', async () => {
    const { agent } = await login('admin', 'adminpass1');
    const created = await agent.post('/api/v1/admin/users').send({ name: 'Made', username: 'made', password: 'madepass1' });
    expect(created.status).toBe(201);
    const id = created.body.data.user._id;

    const list = await agent.get('/api/v1/admin/users?q=made');
    expect(list.body.data.users).toHaveLength(1);
    expect(list.body.data.users[0]).not.toHaveProperty('password');

    const edited = await agent.patch(`/api/v1/admin/users/${id}`).send({ name: 'Made 2', password: 'changed123', role: 'admin' });
    expect(edited.body.data.user).toMatchObject({ name: 'Made 2', role: 'admin' });
    expect((await login('made', 'changed123')).res.status).toBe(200);

    await agent.patch(`/api/v1/admin/users/${id}`).send({ status: 'disabled' });
    expect((await login('made', 'changed123')).res.status).toBe(403);

    const dup = await agent.post('/api/v1/admin/users').send({ name: 'Dup', username: 'made', password: 'madepass1' });
    expect(dup.status).toBe(409);

    const me = (await agent.get('/api/v1/auth/me')).body.data.user;
    expect((await agent.patch(`/api/v1/admin/users/${me._id}`).send({ role: 'user' })).status).toBe(400);
    expect((await agent.delete(`/api/v1/admin/users/${me._id}`)).status).toBe(400);

    expect((await agent.delete(`/api/v1/admin/users/${id}`)).status).toBe(204);
    expect((await agent.get('/api/v1/admin/stats')).body.data.users).toBeGreaterThan(0);
  });
});

describe('programs', () => {
  let id;
  it('admin CRUD and public reads', async () => {
    expect((await request(app).post('/api/v1/programs').send({ title: 'x', category: 'Quiz' })).status).toBe(401);
    const { agent } = await login('admin', 'adminpass1');
    const created = await agent
      .post('/api/v1/programs')
      .send({ title: 'Mega Quiz', category: 'Quiz', about: 'Long text', status: 'Live', deadline: '2030-01-01', imageurls: ['https://example.com/a.jpg'] });
    expect(created.status).toBe(201);
    id = created.body.data.program._id;

    const list = await request(app).get('/api/v1/programs?category=Quiz&q=mega');
    expect(list.body.total).toBe(1);
    expect(list.body.data.programs[0].about).toBeUndefined();

    const one = await request(app).get(`/api/v1/programs/${id}`);
    expect(one.body.data.program.about).toBe('Long text');

    expect((await request(app).get('/api/v1/programs/notanid')).status).toBe(400);
    const missing = await request(app).get('/api/v1/programs/000000000000000000000000');
    expect(missing.status).toBe(404);
    expect(missing.body.message).not.toMatch(/Cast/);

    const cats = await request(app).get('/api/v1/programs/categories');
    expect(cats.body.data.categories[0]).toEqual({ name: 'Quiz', count: 1 });

    expect((await agent.patch(`/api/v1/programs/${id}`).send({ status: 'Closed' })).body.data.program.status).toBe('Closed');
    expect((await agent.delete(`/api/v1/programs/${id}`)).status).toBe(204);
  });
});

describe('chat', () => {
  it('user messages admin and admin replies', async () => {
    expect((await request(app).get('/api/v1/chat/me')).status).toBe(401);
    const { agent: user } = await login('newbie', 'newpassword1');
    const sent = await user.post('/api/v1/chat/me/messages').send({ body: 'Hello admin' });
    expect(sent.status).toBe(201);
    expect((await user.get('/api/v1/chat/conversations')).status).toBe(403);

    const { agent: admin } = await login('admin', 'adminpass1');
    const convos = await admin.get('/api/v1/chat/conversations');
    expect(convos.body.data.conversations[0]).toMatchObject({ unreadForAdmin: 1, lastMessage: 'Hello admin' });
    const cid = convos.body.data.conversations[0]._id;
    await admin.get(`/api/v1/chat/conversations/${cid}/messages`);
    await admin.post(`/api/v1/chat/conversations/${cid}/messages`).send({ body: 'Hi! How can I help?' });

    expect((await user.get('/api/v1/chat/me/unread')).body.data.unread).toBe(1);
    const thread = await user.get('/api/v1/chat/me');
    expect(thread.body.data.messages.map((m) => m.senderRole)).toEqual(['user', 'admin']);
    expect((await user.get('/api/v1/chat/me/unread')).body.data.unread).toBe(0);
  });
});

describe('security', () => {
  it('does not reflect arbitrary origins and hides stack details', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'https://evil.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect((await request(app).get('/api/v1/nope')).status).toBe(404);
  });
});
