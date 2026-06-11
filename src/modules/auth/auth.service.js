const { ADMIN_CREATABLE_ROLES } = require("../../constants/roles");
const { ROLES } = require("../../constants/roles");
const { sha256 } = require("../../utils/sha256");
const { generateRandomPassword } = require("../../utils/randomPassword");
const { issueUserToken } = require("../../utils/tokenCrypto");
const {
  countByRole,
  findByEmail,
  findById,
  insertUser,
  listUsers,
  updateUserNameById,
  updateUserPasswordById,
  updateUserRoleStatusById,
} = require("./auth.repository");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeStatus(status) {
  const v = String(status || "").trim().toLowerCase();
  return v === "inactive" ? "inactive" : "active";
}

async function ensureActorIsSuperAdmin(actorId) {
  const id = Number(actorId);
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    err.code = "FORBIDDEN";
    throw err;
  }
  const actor = await findById(id);
  if (!actor || String(actor.role || "") !== "Super Admin") {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    err.code = "FORBIDDEN";
    throw err;
  }
  return actor;
}

function ensureString(value, fieldName) {
  const v = String(value || "").trim();
  if (!v) {
    const err = new Error(`${fieldName} is required`);
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return v;
}

function ensureEmail(email) {
  const v = normalizeEmail(email);
  if (!v || !v.includes("@")) {
    const err = new Error("email is invalid");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return v;
}

function publicUser(userRow) {
  return {
    id: userRow.id,
    first_name: userRow.first_name,
    last_name: userRow.last_name,
    email: userRow.email,
    role: userRow.role,
    status: userRow.status,
    dateAdded: userRow.dateAdded ?? userRow.date_added ?? null,
    expiry_date: userRow.expiry_date ?? null,
  };
}

async function login({ email, password }, { sender } = {}) {
  const normalizedEmail = ensureEmail(email);
  const passwordPlain = ensureString(password, "password");

  const user = await findByEmail(normalizedEmail);
  if (!user) {
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }

  const looksHashed = /^[a-f0-9]{64}$/i.test(passwordPlain);
  const hashed = looksHashed ? passwordPlain.toLowerCase() : sha256(passwordPlain);
  if (String(user.password) !== hashed) {
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }

  if (String(user.status).toLowerCase() !== "active") {
    const err = new Error("User is not active");
    err.statusCode = 403;
    err.code = "USER_INACTIVE";
    throw err;
  }

  const publicU = publicUser(user);
  const token = issueUserToken({
    userId: publicU.id,
    role: publicU.role,
    firstName: publicU.first_name,
    lastName: publicU.last_name,
    email: publicU.email,
    sender,
  });
  return { user: publicU, token: token.token, token_expires_at: new Date(token.expiresAtMs).toISOString() };
}

async function me(actorId) {
  const id = Number(actorId);
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    err.code = "UNAUTHORIZED";
    throw err;
  }
  const user = await findById(id);
  if (!user) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    err.code = "UNAUTHORIZED";
    throw err;
  }
  return publicUser(user);
}

async function createSuperAdmin({ first_name, last_name, email, password, status }, { actorId } = {}) {
  const totalSuperAdmins = await countByRole("Super Admin");
  if (totalSuperAdmins > 0) {
    if (!actorId) {
      const err = new Error("Forbidden");
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }
    await ensureActorIsSuperAdmin(actorId);
  }

  const firstName = ensureString(first_name, "first_name");
  const lastName = ensureString(last_name, "last_name");
  const normalizedEmail = ensureEmail(email);

  const existing = await findByEmail(normalizedEmail);
  if (existing) {
    const err = new Error("Email already in use");
    err.statusCode = 409;
    err.code = "EMAIL_EXISTS";
    throw err;
  }

  const passwordPlain = String(password || "").trim() || generateRandomPassword(12);
  const passwordHash = sha256(passwordPlain);
  const userStatus = normalizeStatus(status);

  const userId = await insertUser({
    firstName,
    lastName,
    email: normalizedEmail,
    passwordHash,
    expiryDate: null,
    role: "Super Admin",
    status: userStatus,
  });

  const created = await findById(userId);
  return { user: publicUser(created), password: passwordPlain };
}

async function createAdminUser({ first_name, last_name, email, password, role, status }, { allowSuperAdmin = false } = {}) {
  const firstName = ensureString(first_name, "first_name");
  const lastName = ensureString(last_name, "last_name");
  const normalizedEmail = ensureEmail(email);

  const requestedRole = ensureString(role, "role");
  if (requestedRole === "Super Admin" && !allowSuperAdmin) {
    const err = new Error("Role not allowed");
    err.statusCode = 400;
    err.code = "ROLE_NOT_ALLOWED";
    throw err;
  }
  if (!allowSuperAdmin && !ADMIN_CREATABLE_ROLES.includes(requestedRole)) {
    const err = new Error("Unknown role");
    err.statusCode = 400;
    err.code = "ROLE_INVALID";
    throw err;
  }
  if (allowSuperAdmin && !ROLES.includes(requestedRole)) {
    const err = new Error("Unknown role");
    err.statusCode = 400;
    err.code = "ROLE_INVALID";
    throw err;
  }

  const existing = await findByEmail(normalizedEmail);
  if (existing) {
    const err = new Error("Email already in use");
    err.statusCode = 409;
    err.code = "EMAIL_EXISTS";
    throw err;
  }

  const passwordPlain = String(password || "").trim() || generateRandomPassword(12);
  const passwordHash = sha256(passwordPlain);
  const userStatus = normalizeStatus(status);

  const userId = await insertUser({
    firstName,
    lastName,
    email: normalizedEmail,
    passwordHash,
    expiryDate: null,
    role: requestedRole,
    status: userStatus,
  });

  const created = await findById(userId);
  return { user: publicUser(created), password: passwordPlain };
}

async function getUsers(actorId) {
  await ensureActorIsSuperAdmin(actorId);
  const rows = await listUsers();
  return rows.map(publicUser);
}

function ensureId(id) {
  const v = Number(id);
  if (!Number.isFinite(v) || v <= 0) {
    const err = new Error("id is invalid");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return v;
}

async function updateProfile({ id, email, first_name, last_name }) {
  const userId = ensureId(id);
  const normalizedEmail = ensureEmail(email);
  const firstName = ensureString(first_name, "first_name");
  const lastName = ensureString(last_name, "last_name");

  const existing = await findById(userId);
  if (!existing) {
    const err = new Error("User not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }
  if (normalizeEmail(existing.email) !== normalizedEmail) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    err.code = "FORBIDDEN";
    throw err;
  }

  await updateUserNameById(userId, { firstName, lastName });
  const updated = await findById(userId);
  return publicUser(updated);
}

async function changePassword({ id, email, current_password, new_password }) {
  const userId = ensureId(id);
  const normalizedEmail = ensureEmail(email);
  const currentPasswordPlain = ensureString(current_password, "current_password");
  const newPasswordPlain = ensureString(new_password, "new_password");

  const existing = await findById(userId);
  if (!existing) {
    const err = new Error("User not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }
  if (normalizeEmail(existing.email) !== normalizedEmail) {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    err.code = "FORBIDDEN";
    throw err;
  }

  const currentHash = sha256(currentPasswordPlain);
  if (String(existing.password) !== currentHash) {
    const err = new Error("Invalid current password");
    err.statusCode = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }

  const nextHash = sha256(newPasswordPlain);
  await updateUserPasswordById(userId, nextHash);
  return { ok: true };
}

async function createAdminUserAsActor(actorId, payload) {
  await ensureActorIsSuperAdmin(actorId);
  return createAdminUser(payload, { allowSuperAdmin: true });
}

async function updateAdminUser(actorId, id, { role, status }) {
  await ensureActorIsSuperAdmin(actorId);

  const targetId = ensureId(id);
  const existing = await findById(targetId);
  if (!existing) {
    const err = new Error("User not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  if (String(existing.role || "") === "Super Admin") {
    const err = new Error("Cannot modify Super Admin account");
    err.statusCode = 400;
    err.code = "ROLE_NOT_ALLOWED";
    throw err;
  }

  const nextRole = ensureString(role, "role");
  if (!ROLES.includes(nextRole)) {
    const err = new Error("Role not allowed");
    err.statusCode = 400;
    err.code = "ROLE_NOT_ALLOWED";
    throw err;
  }

  const nextStatus = normalizeStatus(status);

  await updateUserRoleStatusById(targetId, { role: nextRole, status: nextStatus });
  const updated = await findById(targetId);
  return publicUser(updated);
}

module.exports = {
  login,
  me,
  createSuperAdmin,
  createAdminUserAsActor,
  getUsers,
  updateProfile,
  changePassword,
  updateAdminUser,
};
