// Give an account a role from the server's shell: node --experimental-sqlite tools/grant.mjs <email> <member|staff|admin>
import { loadConfig } from '../lib/config.mjs';
import { openDb } from '../lib/db.mjs';

const [email, role] = process.argv.slice(2);
if (!email || !['member', 'staff', 'admin'].includes(role)) { console.error('usage: grant.mjs <email> <member|staff|admin>'); process.exit(1); }
const db = openDb(loadConfig().dataDir);
const r = db.run('UPDATE accounts SET role = ? WHERE email = ?', role, email.toLowerCase());
console.log(r.changes ? `${email} is now ${role}` : `no account for ${email}; sign up first`);
db.run('INSERT INTO audit (at, actor, action, detail) VALUES (?, ?, ?, ?)', Date.now(), 'shell', 'account.role', JSON.stringify({ email, role }));
