import app from '../server/app.js';

// Vercel serverless entry. In Sheets mode there is no MongoDB, so an empty
// MONGODB_URI must not stop the function from starting.
export default app;
