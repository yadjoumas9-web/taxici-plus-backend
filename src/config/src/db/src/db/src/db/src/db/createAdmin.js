// Crée (ou met à jour) le compte administrateur à partir des variables d'environnement.
// Usage : npm run create-admin
// Nécessite ADMIN_PHONE et ADMIN_PASSWORD définis dans .env (ou dans les variables Railway).
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./pool');

async function createAdmin() {
  const phone = process.env.ADMIN_PHONE;
  const password = process.env.ADMIN_PASSWORD;

  if (!phone || !password) {
    console.error('[Admin] ADMIN_PHONE et ADMIN_PASSWORD doivent être définis dans .env');
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error('[Admin] Le mot de passe doit contenir au moins 8 caractères.');
    process.exitCode = 1;
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);

    if (rows.length > 0) {
      await pool.query(
        `UPDATE users SET password_hash = $1, role = 'admin', updated_at = now() WHERE phone = $2`,
        [passwordHash, phone]
      );
      console.log(`[Admin] Compte existant mis à jour en administrateur : ${phone}`);
    } else {
      await pool.query(
        `INSERT INTO users (phone, full_name, role, password_hash) VALUES ($1, $2, 'admin', $3)`,
        [phone, 'Administrateur TaxiCI+', passwordHash]
      );
      console.log(`[Admin] Compte administrateur créé : ${phone}`);
    }
  } catch (err) {
    console.error('[Admin] Échec :', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

createAdmin();
