const fs = require('fs');
const path = require('path');
const { pool } = require('../server/db');

async function main() {
  const dir = path.join(__dirname, '..', 'db', 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    console.log(`Running migration: ${file}`);
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await pool.query(sql);
  }
  console.log('Migrations complete.');
}

main().catch(err => { console.error(err); process.exit(1); }).finally(() => pool.end());
