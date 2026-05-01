const { pool } = require('../server/db');
async function main(){
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  console.log('Database reset complete.');
}
main().catch(err=>{console.error(err);process.exit(1);}).finally(()=>pool.end());
