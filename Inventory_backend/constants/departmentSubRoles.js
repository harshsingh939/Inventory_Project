/**
 * Allowed sub-roles per main department (Team registration).
 * Keep in sync with inventory-frontend `department-sub-roles.ts`.
 */
exports.DEPARTMENT_SUB_ROLES = Object.freeze({
  IT: Object.freeze([
    'Support Engineer',
    'Software Developer',
    'Network Administrator',
    'Security Analyst',
    'General',
  ]),
  Telecommunications: Object.freeze([
    'Field Engineer',
    'NOC Engineer',
    'RF Engineer',
    'General',
  ]),
  HR: Object.freeze(['Recruiter', 'HR Partner', 'Payroll', 'Training', 'General']),
  Finance: Object.freeze(['Accountant', 'Financial Analyst', 'Auditor', 'Payroll Finance', 'General']),
  Operations: Object.freeze(['Coordinator', 'Supply Chain', 'Logistics', 'Quality', 'General']),
  Engineering: Object.freeze([
    'Software Engineer',
    'AI Developer',
    'Tester',
    'DevOps Engineer',
    'Hardware Engineer',
    'General',
  ]),
  Facilities: Object.freeze(['Maintenance', 'Housekeeping', 'Safety', 'General']),
  Administration: Object.freeze(['Executive Assistant', 'Office Admin', 'Reception', 'General']),
});

/** @returns {readonly string[]} */
exports.getSubRolesForDepartment = (department) => {
  const d = String(department || '').trim();
  const list = exports.DEPARTMENT_SUB_ROLES[d];
  return list ? [...list] : [];
};

/** @returns {string|null} error message, or null if valid */
exports.getSubRoleValidationError = (department, subRole) => {
  const sr = String(subRole || '').trim();
  if (!sr) return 'Sub-role is required';
  const allowed = exports.DEPARTMENT_SUB_ROLES[String(department || '').trim()];
  if (!allowed || !allowed.includes(sr)) {
    return 'Sub-role must belong to the selected department';
  }
  return null;
};
