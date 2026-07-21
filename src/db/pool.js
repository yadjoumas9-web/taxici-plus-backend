const { Pool } = require('pg');

// Railway fournit automatiquement DATABASE_URL quand un plugin PostgreSQL est ajouté au projet.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  console.error('[DB] Erreur inattendue sur le pool PostgreSQL :', err);
});

module.exports = pool;
