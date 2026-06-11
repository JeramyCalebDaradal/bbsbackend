const { pool } = require("../../db/pool");

async function findByEmail(email) {
  const [rows] = await pool.query("SELECT * FROM auth WHERE email = ? LIMIT 1", [email]);
  return rows[0] || null;
}

async function countByRole(role) {
  const [rows] = await pool.query("SELECT COUNT(*) AS total FROM auth WHERE role = ?", [role]);
  return Number(rows?.[0]?.total || 0);
}

async function insertUser({ firstName, lastName, email, passwordHash, expiryDate, role, status }) {
  const [result] = await pool.query(
    `
      INSERT INTO auth (first_name, last_name, email, password, expiry_date, role, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      firstName,
      lastName,
      email,
      passwordHash,
      expiryDate ?? null,
      role,
      status,
    ]
  );

  return Number(result.insertId);
}

async function findById(id) {
  const [rows] = await pool.query("SELECT * FROM auth WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
}

async function listUsers() {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        first_name,
        last_name,
        email,
        dateAdded,
        expiry_date,
        role,
        status
      FROM auth
      ORDER BY id ASC
    `
  );
  return rows;
}

async function updateUserNameById(id, { firstName, lastName }) {
  const [result] = await pool.query(
    `
      UPDATE auth
      SET first_name = ?, last_name = ?
      WHERE id = ?
      LIMIT 1
    `,
    [firstName, lastName, id]
  );
  return Number(result.affectedRows || 0);
}

async function updateUserPasswordById(id, passwordHash) {
  const [result] = await pool.query(
    `
      UPDATE auth
      SET password = ?
      WHERE id = ?
      LIMIT 1
    `,
    [passwordHash, id]
  );
  return Number(result.affectedRows || 0);
}

async function updateUserRoleStatusById(id, { role, status }) {
  const [result] = await pool.query(
    `
      UPDATE auth
      SET role = ?, status = ?
      WHERE id = ?
      LIMIT 1
    `,
    [role, status, id]
  );
  return Number(result.affectedRows || 0);
}

module.exports = {
  findByEmail,
  countByRole,
  insertUser,
  findById,
  listUsers,
  updateUserNameById,
  updateUserPasswordById,
  updateUserRoleStatusById,
};
