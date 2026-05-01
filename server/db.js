require('dotenv').config();
const { Pool } = require('pg');
const connectionString = process.env.DATABASE_URL || 'postgres://grantcrm:grantcrm_password@localhost:5432/grantcrm';
const pool = new Pool({ connectionString });
module.exports = { pool };
