// Applique le schéma SQL sur la base de données configurée via DATABASE_URL.
// Usage : npm run migrate
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  console.log('[Migration] Application du schéma TaxiCI+...');
  try {
    await pool.query(sql);
    console.log('[Migration] Terminée avec succès ✅');
  } catch (err) {
    console.error('[Migration] Échec :', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
