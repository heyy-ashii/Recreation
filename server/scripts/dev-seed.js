import { Program } from '../models/Program.js';
import { User } from '../models/User.js';

const day = 24 * 60 * 60 * 1000;

export async function seedDev() {
  if (!(await User.exists({ username: 'admin' }))) {
    await User.create({ name: 'OGEA Admin', username: 'admin', email: 'admin@ogea.local', password: 'admin12345', role: 'admin', emailVerified: true });
    await User.create({ name: 'Demo Student', username: 'student', email: 'student@ogea.local', password: 'student12345', emailVerified: true });
    console.info('[dev] Seeded admin (admin / admin12345) and student (student / student12345)');
  }
  if (await Program.exists({})) return;
  const now = Date.now();
  await Program.insertMany([
    { title: 'National Academic Seminar', category: 'Seminar', type: 'Seminar', organizer: 'MFSA & MMIC, Jamia Raheemiya', venue: 'Raheemiya Campus, Palakkad, Kerala', about: 'Women in Islam: discourses on equality, equity and social status.\n\nAbstract deadline: 1 Oct. Contact ogea.sms@gmail.com or +91 94976 31425.', status: 'Live', deadline: new Date(now + 10 * day), eventDate: new Date(now + 20 * day), tags: ['Seminar', 'Research'], imageurls: ['https://images.unsplash.com/photo-1540575467063-178a50c2df87'] },
    { title: 'രചനകൾ അയക്കാം', category: 'Writing', type: 'Call for Entries', organizer: 'Various', venue: 'Online Submission', about: 'പത്രപ്രതികരണം\n\nമാധ്യമം letters@madhyamam.in\nദീപിക letters@deepika.com', status: 'Live', deadline: new Date(now + 60 * day), eventDate: new Date(now + 60 * day), tags: ['Article'], imageurls: ['https://images.unsplash.com/photo-1455390582262-044cdead277a'] },
    { title: 'All Kerala Mega Quiz', category: 'Quiz', type: 'Quiz', organizer: "MHS Ma'din Darul Habeeb Campus", venue: 'Online', about: '150 questions. Registration fee ₹99. Prizes 4444 / 3333 / 1111.', status: 'Live', deadline: new Date(now + 5 * day), eventDate: new Date(now + 7 * day), tags: ['Quiz'], imageurls: ['https://images.unsplash.com/photo-1606326608606-aa0b62935f2b'] },
    { title: 'Sociology Conference: Call for Papers', category: 'Conference', type: 'Conference', organizer: 'Department of Sociology, Shiv Nadar University', venue: 'Delhi NCR, India', about: 'Listening, Knowing, Writing: a methodological exploration.', status: 'Closed', deadline: new Date(now - 5 * day), eventDate: new Date(now + 40 * day), tags: ['Conference'], imageurls: ['https://images.unsplash.com/photo-1505373877841-8d25f7d46678'] },
  ]);
  console.info('[dev] Seeded sample programs');
}
