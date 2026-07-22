const pool = require('../db/pool');

async function logAdminAction({ adminId, action, targetType, targetId, details, ip }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (admin_id, action, target_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [adminId, action, targetType, targetId || null, JSON.stringify(details || {}), ip || null]
    );
  } catch (err) {
    console.error('[Audit] Échec de journalisation :', err.message);
  }
}

async function listAuditLogs({ limit = 50, adminId, targetType } = {}) {
  const conditions = [];
  const params = [];

  if (adminId) { params.push(adminId); conditions.push(`al.admin_id = $${params.length}`); }
  if (targetType) { params.push(targetType); conditions.push(`al.target_type = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Math.min(limit, 200));

  const { rows } = await pool.query(
    `SELECT al.*, u.phone AS admin_phone, u.full_name AS admin_name
     FROM audit_logs al
     JOIN users u ON u.id = al.admin_id
     ${where}
     ORDER BY al.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows;
}

module.exports = { logAdminAction, listAuditLogs };
