/**
 * Role checks shared by navigation, pages and actions.
 *
 * The API enforces every rule again. These helpers only keep the interface
 * honest so a person is not shown a button they cannot use.
 */

export const PLACA_ROLES = ['placa_officer', 'placa_director'];
export const PROGRAMME_ROLES = [
  'partner_staff',
  'laca_officer',
  'placa_officer',
  'placa_director',
];

export function isPlaca(role) {
  return PLACA_ROLES.includes(role);
}

export function isPartner(role) {
  return role === 'partner_staff';
}

export function isAdmin(role) {
  return role === 'admin';
}

export function canViewProgramme(role) {
  return PROGRAMME_ROLES.includes(role);
}

export function canManageOrganizations(role) {
  return role === 'laca_officer' || isPlaca(role);
}

export function canReview(role) {
  return isPlaca(role);
}

export function canAuthor(role) {
  return isPartner(role);
}

export function canCreatePartnerStaff(role) {
  return isPlaca(role);
}

export const ALL_ROLES = [
  'partner_staff',
  'laca_officer',
  'placa_officer',
  'placa_director',
  'admin',
];

export function canChangeRoles(role) {
  return role === 'placa_director' || role === 'admin';
}

export function getAllowedRolesToAssign(actorRole) {
  if (actorRole === 'admin') {
    return ALL_ROLES;
  }
  if (actorRole === 'placa_director') {
    return ALL_ROLES.filter((r) => r !== 'admin');
  }
  return [];
}

export function isElevatedRole(role) {
  return ['admin', 'placa_director', 'placa_officer'].includes(role);
}

export function canManageTargetUserRole(actor, target) {
  if (!actor || !target) return false;
  if (!canChangeRoles(actor.role)) return false;
  if (target.id === actor.id) return false;
  if (actor.role === 'placa_director' && target.role === 'admin') return false;
  return true;
}

const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function periodLabel(type, number, year, language = 'en') {
  if (type === 'quarterly') return `Q${number} ${year}`;
  if (type === 'annual') return `${year}`;
  const months = language === 'ha' ? HAUSA_MONTHS : MONTHS_EN;
  return `${months[number - 1] || number} ${year}`;
}

export const HAUSA_MONTHS = [
  'Janairu',
  'Faburairu',
  'Maris',
  'Afirilu',
  'Mayu',
  'Yuni',
  'Yuli',
  'Agusta',
  'Satumba',
  'Oktoba',
  'Nuwamba',
  'Disamba',
];

export function formatDate(value, language = 'en') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const months =
    language === 'ha'
      ? HAUSA_MONTHS
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Format by hand: some devices have no Hausa locale data, and
  // toLocaleDateString silently falls back to English there.
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function currentYear() {
  return new Date().getFullYear();
}

/**
 * Human label for a public_summary period such as 2026, 2026-Q1 or 2026-02.
 * Kept manual for the same reason as formatDate: Hausa locale data is sparse.
 */
export function publishedPeriodLabel(period, language = 'en') {
  if (!period) return '';
  if (/^\d{4}$/.test(period)) return period;
  const quarter = /^(\d{4})-Q([1-4])$/.exec(period);
  if (quarter) return `Q${quarter[2]} ${quarter[1]}`;
  const month = /^(\d{4})-(\d{2})$/.exec(period);
  if (month) return periodLabel('monthly', Number(month[2]), Number(month[1]), language);
  return period;
}

export function currentQuarter() {
  return Math.floor(new Date().getMonth() / 3) + 1;
}
