const ROLES = [
  "Super Admin",
  "Content Manager",
  "Sales Agent",
  "Analyst",
  "Event Coordinator",
  "Basic User",
  "System Admin",
];

const ADMIN_CREATABLE_ROLES = ROLES.filter((r) => r !== "Super Admin");

module.exports = { ROLES, ADMIN_CREATABLE_ROLES };

