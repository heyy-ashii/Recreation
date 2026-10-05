import { config } from './config.js';
import { connectDB } from './db.js';

async function start() {
  let uri = config.mongoUri;
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    uri = mongod.getUri('ogea');
    process.env.MONGODB_URI = uri;
    console.info('[dev] MONGODB_URI not set - using an in-memory MongoDB (data resets on restart)');
    await connectDB(uri);
    const { seedDev } = await import('./scripts/dev-seed.js');
    await seedDev();
  }
  const { createApp } = await import('./app.js');
  const app = createApp({ connect: () => connectDB(uri) });
  app.listen(config.port, () => console.info(`[dev] API listening on http://localhost:${config.port}`));
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
