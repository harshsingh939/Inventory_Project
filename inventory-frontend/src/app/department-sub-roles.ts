/**
 * Allowed sub-roles per main department (Team registration).
 * Keep in sync with Inventory_backend/constants/departmentSubRoles.js
 */
export const DEPARTMENT_SUB_ROLES: Readonly<Record<string, readonly string[]>> = {
  IT: ['Support Engineer', 'Software Developer', 'Network Administrator', 'Security Analyst', 'General'],
  Telecommunications: ['Field Engineer', 'NOC Engineer', 'RF Engineer', 'General'],
  HR: ['Recruiter', 'HR Partner', 'Payroll', 'Training', 'General'],
  Finance: ['Accountant', 'Financial Analyst', 'Auditor', 'Payroll Finance', 'General'],
  Operations: ['Coordinator', 'Supply Chain', 'Logistics', 'Quality', 'General'],
  Engineering: [
    'Software Engineer',
    'AI Developer',
    'Tester',
    'DevOps Engineer',
    'Hardware Engineer',
    'General',
  ],
  Facilities: ['Maintenance', 'Housekeeping', 'Safety', 'General'],
  Administration: ['Executive Assistant', 'Office Admin', 'Reception', 'General'],
};

export function subRolesForDepartment(department: string): readonly string[] {
  const d = String(department || '').trim();
  return DEPARTMENT_SUB_ROLES[d] ?? [];
}
