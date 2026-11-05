#!/usr/bin/env node

/**
 * End-to-end checks for the Phase 1 to Phase 4 API.
 *
 * Run against a running server and a disposable demo database:
 *
 *   API_BASE_URL=http://localhost:5000/api \
 *   VERIFY_PASSWORD='ChangeMe#2026' \
 *   node scripts/verify-api.mjs
 *
 * Env:
 *   API_BASE_URL     API root, default http://localhost:5000/api
 *   VERIFY_PASSWORD  password shared by the four demo programme logins,
 *                    default ChangeMe#2026
 *
 * What it needs:
 *   - a demo seed (`npm run seed:demo`) with at least the 7 seeded
 *     organizations
 *   - the four programme demo accounts past their forced password change,
 *     because programme routes are closed until the password is changed
 *   - an empty 2026 Q4 / 2025 Q4 workplan period and empty 2026 Q4 and
 *     January 2026 report periods for Hope Foundation
 *
 * What it writes: one `Test Community Health Initiative` organization, one
 * workplan each for Hope Foundation and Rural Health Initiative (2026 Q4),
 * one returned-then-approved Hope workplan (2025 Q4) and two Hope reports.
 * It does not clean up afterwards, so re-run it after `npm run db:reset`
 * rather than against a database that already holds these records.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
const env = require('../src/config/env.js');

const base = process.env.API_BASE_URL || 'http://localhost:5000/api';
const demoPassword = process.env.VERIFY_PASSWORD || 'ChangeMe#2026';
let passed = 0;
let failed = 0;

function check(name, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`ok - ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL - ${name}${extra ? ` :: ${extra}` : ''}`);
  }
}

async function call(method, path, token, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { status: response.status, body: json };
}

async function uploadFile(path, token, fields, file) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, String(value));
  }
  form.append('file', new Blob([file.content], { type: file.type }), file.name);

  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { status: response.status, body: json };
}

async function login(identifier, password) {
  const result = await call('POST', '/auth/login', null, { identifier, password });
  if (result.status !== 200) {
    throw new Error(
      `login failed for ${identifier}: ${result.status} ${JSON.stringify(result.body)}\n` +
        'Set VERIFY_PASSWORD to the password the demo accounts use after their forced change.'
    );
  }
  return result.body.accessToken;
}

const partner = await login('partner@hopefoundation.org', demoPassword);
const partnerRural = await login('partner@ruralhealth.ng', demoPassword);
const officer = await login('officer@placa.gov.ng', demoPassword);
const laca = await login('laca.josnorth@placa.gov.ng', demoPassword);

// Programme routes stay closed until the forced password change is done.
const preflight = await call('GET', '/lgas', partner);
if (preflight.status === 403 && preflight.body?.error === 'PASSWORD_CHANGE_REQUIRED') {
  console.error(
    '\nThese demo accounts still have a pending password change, so programme routes are closed.\n' +
      'Sign in once and change each password, or clear must_change_password on a disposable database.\n'
  );
  process.exit(2);
}

console.log('\n== Reference data ==');
const indicatorsResult = await call('GET', '/indicators', partner);
const lgasResult = await call('GET', '/lgas', partner);
const indicators = indicatorsResult.body.data;
const lgas = lgasResult.body.data;
const byCode = Object.fromEntries(indicators.map((indicator) => [indicator.code, indicator]));
const josNorth = lgas.find((lga) => lga.name === 'Jos North');
const barkinLadi = lgas.find((lga) => lga.name === 'Barkin Ladi');
check('indicator and LGA reference data load', Boolean(byCode.HTS_TST && byCode.REACH && josNorth && barkinLadi));

console.log('\n== Organizations: scope and approval ==');
const partnerOrgs = await call('GET', '/organizations', partner);
check('partner sees only their own organization', partnerOrgs.status === 200 && partnerOrgs.body.pagination.total === 1, JSON.stringify(partnerOrgs.body).slice(0, 200));

const officerOrgs = await call('GET', '/organizations', officer);
check('PLACA officer sees all organizations', officerOrgs.status === 200 && officerOrgs.body.pagination.total >= 7);

const lacaOrgs = await call('GET', '/organizations', laca);
check(
  'LACA officer sees only organizations in their LGA',
  lacaOrgs.status === 200 && lacaOrgs.body.data.every((org) => org.lga?.name === 'Jos North')
);

const partnerCreateOrg = await call('POST', '/organizations', partner, {
  name: 'Test Partner Cannot Register',
  type: 'cbo',
  lga_id: josNorth.id,
});
check('partner staff cannot register an organization', partnerCreateOrg.status === 403, JSON.stringify(partnerCreateOrg.body));

const wrongLgaOrg = await call('POST', '/organizations', laca, {
  name: 'Test Wrong LGA Organization',
  type: 'cbo',
  lga_id: barkinLadi.id,
});
check('LACA officer cannot register outside their LGA', wrongLgaOrg.status === 403, JSON.stringify(wrongLgaOrg.body));

const createdOrg = await call('POST', '/organizations', laca, {
  name: 'Test Community Health Initiative',
  type: 'cbo',
  lga_id: josNorth.id,
  focus_areas: ['testing', 'referral'],
  contact_name: 'Test Contact',
  contact_phone: '08031239999',
  contact_email: 'test.org@example.org',
});
check('LACA officer registers a pending organization', createdOrg.status === 201 && createdOrg.body.data.status === 'pending', JSON.stringify(createdOrg.body).slice(0, 300));
const testOrgId = createdOrg.body.data?.id;

const lacaApprove = await call('POST', `/organizations/${testOrgId}/approve`, laca);
check('LACA officer cannot approve an organization', lacaApprove.status === 403);

const officerApprove = await call('POST', `/organizations/${testOrgId}/approve`, officer);
check('PLACA officer approves an organization', officerApprove.status === 200 && officerApprove.body.data.status === 'approved' && officerApprove.body.data.approved_by);

const suspend = await call('POST', `/organizations/${testOrgId}/suspend`, officer);
check('PLACA officer suspends an organization', suspend.status === 200 && suspend.body.data.status === 'suspended');

const staffForSuspended = await call('POST', '/users', officer, {
  name: 'Test Staff',
  email: 'test.staff.suspended@example.org',
  role: 'partner_staff',
  organization_id: testOrgId,
  send_email: false,
});
check('cannot add partner staff to a suspended organization', staffForSuspended.status === 400 && staffForSuspended.body.error === 'ORGANIZATION_NOT_APPROVED', JSON.stringify(staffForSuspended.body));

const reinstate = await call('POST', `/organizations/${testOrgId}/approve`, officer);
check('approving a suspended organization reinstates it', reinstate.status === 200 && reinstate.body.data.status === 'approved');

console.log('\n== Workplans: author, submit, review ==');
const workplanTargets = [
  { indicator_id: byCode.HTS_TST.id, lga_id: josNorth.id, target_value: 800 },
  { indicator_id: byCode.REACH.id, lga_id: josNorth.id, target_value: 2000 },
];

const createdPlan = await call('POST', '/workplans', partner, {
  year: 2026,
  quarter: 4,
  targets: workplanTargets,
});
check(
  'partner creates a draft workplan with targets',
  createdPlan.status === 201 && createdPlan.body.data.status === 'draft' && createdPlan.body.data.targets.length === 2,
  JSON.stringify(createdPlan.body).slice(0, 300)
);
const workplanId = createdPlan.body.data?.id;

const planForOtherOrg = await call('POST', '/workplans', partnerRural, {
  year: 2026,
  quarter: 4,
  targets: workplanTargets,
});
check(
  'each partner plans for their own organization',
  planForOtherOrg.status === 201 &&
    planForOtherOrg.body.data?.organization?.name === 'Rural Health Initiative',
  JSON.stringify(planForOtherOrg.body).slice(0, 200)
);

const duplicatePlan = await call('POST', '/workplans', partner, {
  year: 2026,
  quarter: 4,
  targets: workplanTargets,
});
check('duplicate workplan period is rejected', duplicatePlan.status === 409 && duplicatePlan.body.error === 'WORKPLAN_EXISTS');

const officerCreatePlan = await call('POST', '/workplans', officer, {
  year: 2026,
  quarter: 3,
  targets: workplanTargets,
});
check('PLACA officer cannot author a partner workplan', officerCreatePlan.status === 403);

const submittedPlan = await call('POST', `/workplans/${workplanId}/submit`, partner);
check('partner submits a workplan', submittedPlan.status === 200 && submittedPlan.body.data.status === 'submitted' && submittedPlan.body.data.submitted_at);

const editSubmitted = await call('PATCH', `/workplans/${workplanId}`, partner, { targets: workplanTargets });
check('submitted workplan is locked', editSubmitted.status === 409 && editSubmitted.body.error === 'WORKPLAN_LOCKED');

const lacaReview = await call('POST', `/workplans/${workplanId}/review`, laca, { decision: 'approve' });
check('LACA officer cannot review a workplan', lacaReview.status === 403);

const approvedPlan = await call('POST', `/workplans/${workplanId}/review`, officer, { decision: 'approve' });
check('PLACA officer approves a workplan', approvedPlan.status === 200 && approvedPlan.body.data.status === 'approved' && approvedPlan.body.data.approved_at);

const reviewAgain = await call('POST', `/workplans/${workplanId}/review`, officer, { decision: 'approve' });
check(
  'an approved workplan cannot be reviewed again',
  reviewAgain.status === 409 && reviewAgain.body.error === 'WORKPLAN_NOT_SUBMITTED'
);

const partnerPlanList = await call('GET', '/workplans?year=2026&quarter=4', partner);
check('partner lists their own workplan', partnerPlanList.status === 200 && partnerPlanList.body.data.some((plan) => plan.id === workplanId));

const lacaPlanList = await call('GET', '/workplans', laca);
check(
  'LACA workplan list stays inside their LGA',
  lacaPlanList.status === 200 && lacaPlanList.body.data.every((plan) => plan.organization?.lga?.name === 'Jos North')
);

const ruralPlanList = await call('GET', '/workplans', partnerRural);
check(
  'a partner cannot see another organization workplan',
  ruralPlanList.status === 200 &&
    ruralPlanList.body.data.length === 1 &&
    !ruralPlanList.body.data.some((plan) => plan.id === workplanId),
  JSON.stringify(ruralPlanList.body).slice(0, 200)
);

console.log('\n== Workplans: return and resubmit ==');
const returnedPlan = await call('POST', '/workplans', partner, {
  year: 2025,
  quarter: 4,
  targets: [{ indicator_id: byCode.HTS_TST.id, lga_id: josNorth.id, target_value: 100 }],
});
const returnedPlanId = returnedPlan.body.data?.id;
await call('POST', `/workplans/${returnedPlanId}/submit`, partner);
const returned = await call('POST', `/workplans/${returnedPlanId}/review`, officer, {
  decision: 'return',
  note: 'Add a target for people reached.',
});
check('PLACA officer returns a workplan with a note', returned.status === 200 && returned.body.data.status === 'returned' && returned.body.data.review_note);

const missingNote = await call('POST', `/workplans/${workplanId}/review`, officer, { decision: 'return' });
check(
  'returning a workplan requires a note',
  missingNote.status === 400 && missingNote.body.error === 'VALIDATION_FAILED',
  JSON.stringify(missingNote.body)
);

const resubmit = await call('PATCH', `/workplans/${returnedPlanId}`, partner, {
  targets: [
    { indicator_id: byCode.HTS_TST.id, lga_id: josNorth.id, target_value: 120 },
    { indicator_id: byCode.REACH.id, lga_id: josNorth.id, target_value: 300 },
  ],
});
check('partner edits a returned workplan', resubmit.status === 200 && resubmit.body.data.targets.length === 2);
const resubmitted = await call('POST', `/workplans/${returnedPlanId}/submit`, partner);
check('partner resubmits a returned workplan', resubmitted.status === 200 && resubmitted.body.data.status === 'submitted');
const approvedAfterReturn = await call('POST', `/workplans/${returnedPlanId}/review`, officer, { decision: 'approve' });
check('returned workplan can be approved after resubmission', approvedAfterReturn.status === 200 && approvedAfterReturn.body.data.status === 'approved');

console.log('\n== Reports: create, consistency, submit, validate ==');
const reportPayload = {
  client_uuid: crypto.randomUUID(),
  period_type: 'quarterly',
  period_year: 2026,
  period_number: 4,
  values: [
    { indicator_id: byCode.HTS_TST.id, disaggregation_key: 'total', value: 100 },
    { indicator_id: byCode.HTS_TST_POS.id, disaggregation_key: 'total', value: 10 },
    { indicator_id: byCode.REACH.id, disaggregation_key: 'total', value: 500 },
  ],
};
const createdReport = await call('POST', '/reports', partner, reportPayload);
check(
  'partner creates a draft report',
  createdReport.status === 201 && createdReport.body.data.status === 'draft' && createdReport.body.data.values.length === 3,
  JSON.stringify(createdReport.body).slice(0, 300)
);
const reportId = createdReport.body.data?.id;

const duplicatePeriod = await call('POST', '/reports', partner, { ...reportPayload, client_uuid: crypto.randomUUID() });
check('second report for the same period is rejected', duplicatePeriod.status === 409 && duplicatePeriod.body.error === 'REPORT_PERIOD_EXISTS');

const retry = await call('POST', '/reports', partner, reportPayload);
check('re-sending the same client_uuid is idempotent', retry.status === 201 && retry.body.data.id === reportId, JSON.stringify(retry.body).slice(0, 200));

const badNumbers = await call('PATCH', `/reports/${reportId}`, partner, {
  values: [
    { indicator_id: byCode.HTS_TST.id, disaggregation_key: 'total', value: 5 },
    { indicator_id: byCode.HTS_TST_POS.id, disaggregation_key: 'total', value: 10 },
  ],
});
check('partner edits a draft report', badNumbers.status === 200);

const inconsistent = await call('POST', `/reports/${reportId}/submit`, partner);
check(
  'submission blocks inconsistent counts',
  inconsistent.status === 400 && inconsistent.body.error === 'REPORT_INCONSISTENT',
  JSON.stringify(inconsistent.body).slice(0, 300)
);

await call('PATCH', `/reports/${reportId}`, partner, {
  values: [
    { indicator_id: byCode.HTS_TST.id, disaggregation_key: 'total', value: 100 },
    { indicator_id: byCode.HTS_TST_POS.id, disaggregation_key: 'total', value: 10 },
    { indicator_id: byCode.REACH.id, disaggregation_key: 'total', value: 500 },
  ],
});
const submittedReport = await call('POST', `/reports/${reportId}/submit`, partner);
check('partner submits a consistent report', submittedReport.status === 200 && submittedReport.body.data.status === 'submitted');

const editSubmittedReport = await call('PATCH', `/reports/${reportId}`, partner, { values: [] });
check('submitted report is locked', editSubmittedReport.status === 409 && editSubmittedReport.body.error === 'REPORT_LOCKED');

const lacaValidate = await call('POST', `/reports/${reportId}/review`, laca, { decision: 'validate' });
check('LACA officer cannot validate a report', lacaValidate.status === 403);

const validatedReport = await call('POST', `/reports/${reportId}/review`, officer, { decision: 'validate' });
check('PLACA officer validates a report', validatedReport.status === 200 && validatedReport.body.data.status === 'validated' && validatedReport.body.data.validated_at);

const lacaReports = await call('GET', '/reports', laca);
check(
  'LACA report list stays inside their LGA',
  lacaReports.status === 200 && lacaReports.body.data.every((report) => report.lga?.name === 'Jos North')
);

const ruralReports = await call('GET', '/reports', partnerRural);
check('a partner cannot see another organization report', ruralReports.status === 200 && ruralReports.body.data.length === 0);

console.log('\n== Public aggregation ==');
const partnerPublish = await call('POST', '/aggregation/run', partner, {
  period_type: 'quarterly',
  period_year: 2026,
  period_number: 4,
});
check('partner staff cannot publish results', partnerPublish.status === 403);

const lacaPublish = await call('POST', '/aggregation/run', laca, {
  period_type: 'quarterly',
  period_year: 2026,
  period_number: 4,
});
check('LACA officer cannot publish results', lacaPublish.status === 403);

const publishedQuarter = await call('POST', '/aggregation/run', officer, {
  period_type: 'quarterly',
  period_year: 2026,
  period_number: 4,
});
check(
  'PLACA officer publishes a validated period',
  publishedQuarter.status === 200 &&
    publishedQuarter.body.data.period === '2026-Q4' &&
    publishedQuarter.body.data.state >= 1,
  JSON.stringify(publishedQuarter.body).slice(0, 300)
);

const publicAfterPublish = await call('GET', '/public/summary?period=2026-Q4', null);
const publicRows = publicAfterPublish.body?.rows || [];
check(
  'public page sees state and LGA rows without signing in',
  publicAfterPublish.status === 200 &&
    publicRows.some((row) => row.scope === 'state' && row.indicator_code === 'HTS_TST') &&
    publicRows.some((row) => row.scope === 'lga' && row.lga_name === 'Jos North'),
  JSON.stringify(publicAfterPublish.body).slice(0, 300)
);

const republished = await call('POST', '/aggregation/run', officer, {
  period_type: 'quarterly',
  period_year: 2026,
  period_number: 4,
});
const publicAfterRepublish = await call('GET', '/public/summary?period=2026-Q4', null);
check(
  'publishing the same period twice replaces rows instead of duplicating them',
  republished.status === 200 && publicAfterRepublish.body.rows.length === publicRows.length,
  `${publicRows.length} then ${publicAfterRepublish.body.rows.length}`
);

const aggregateStatus = await call('GET', '/aggregation/status', officer);
check(
  'aggregation status lists the published period',
  aggregateStatus.status === 200 &&
    aggregateStatus.body.data.published.some((item) => item.period === '2026-Q4'),
  JSON.stringify(aggregateStatus.body).slice(0, 300)
);

// A tiny LGA count must never reach the public page, but its state total
// still includes it.
const smallReport = await call('POST', '/reports', partnerRural, {
  client_uuid: crypto.randomUUID(),
  period_type: 'monthly',
  period_year: 2026,
  period_number: 6,
  values: [{ indicator_id: byCode.REACH.id, disaggregation_key: 'total', value: 3 }],
});
const smallReportId = smallReport.body.data?.id;
await call('POST', `/reports/${smallReportId}/submit`, partnerRural);
await call('POST', `/reports/${smallReportId}/review`, officer, { decision: 'validate' });
const smallPublished = await call('POST', '/aggregation/run', officer, {
  period_type: 'monthly',
  period_year: 2026,
  period_number: 6,
});
check(
  'an LGA count below the small-cell threshold is suppressed',
  smallPublished.status === 200 &&
    smallPublished.body.data.suppressed === 1 &&
    smallPublished.body.data.lga === 0,
  JSON.stringify(smallPublished.body).slice(0, 300)
);

const publicSmall = await call('GET', '/public/summary?period=2026-06', null);
const smallRows = publicSmall.body?.rows || [];
check(
  'the suppressed LGA row is absent while the state total remains',
  smallRows.length === 1 &&
    smallRows[0].scope === 'state' &&
    smallRows[0].value === 3,
  JSON.stringify(smallRows).slice(0, 300)
);

console.log('\n== Dashboard and export ==');
const officerDashboard = await call('GET', '/dashboard/overview?period=2026-Q4', officer);
check(
  'PLACA dashboard shows state totals, LGA rows and coverage',
  officerDashboard.status === 200 &&
    officerDashboard.body.data.scope === 'state' &&
    officerDashboard.body.data.state_rows.length >= 1 &&
    officerDashboard.body.data.local_rows.some((row) => row.lga_name === 'Jos North') &&
    officerDashboard.body.data.coverage.total === 17,
  JSON.stringify(officerDashboard.body).slice(0, 300)
);

const lacaDashboard = await call('GET', '/dashboard/overview?period=2026-Q4', laca);
check(
  'LACA dashboard stays inside their own LGA',
  lacaDashboard.status === 200 &&
    lacaDashboard.body.data.scope === 'lga' &&
    lacaDashboard.body.data.local_rows.every((row) => row.lga_name === 'Jos North'),
  JSON.stringify(lacaDashboard.body).slice(0, 300)
);

const partnerDashboard = await call('GET', '/dashboard/overview?period=2026-Q4', partner);
check(
  'partner dashboard scopes workflow counts to their organization',
  partnerDashboard.status === 200 &&
    partnerDashboard.body.data.scope === 'organization' &&
    partnerDashboard.body.data.pipeline.total >= 1,
  JSON.stringify(partnerDashboard.body).slice(0, 300)
);

async function download(path, token) {
  const response = await fetch(`${base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: response.status, type: response.headers.get('content-type'), text: await response.text() };
}

const officerCsv = await download('/reports/export?period_year=2026&period_type=quarterly', officer);
check(
  'PLACA officer downloads a CSV with a header and figures',
  officerCsv.status === 200 &&
    officerCsv.type?.includes('text/csv') &&
    officerCsv.text.includes('report_id,organization,lga') &&
    officerCsv.text.includes('HTS_TST'),
  officerCsv.text.slice(0, 200)
);

const officerPdf = await download('/reports/export/pdf?period_year=2026&period_type=quarterly', officer);
check(
  'PLACA officer downloads a PDF report',
  officerPdf.status === 200 &&
    officerPdf.type?.includes('application/pdf') &&
    officerPdf.text.startsWith('%PDF'),
  `${officerPdf.status} ${officerPdf.type} ${officerPdf.text.slice(0, 20)}`
);

const partnerCsv = await download('/reports/export', partner);
check(
  'partner export contains only their own organization',
  partnerCsv.status === 200 &&
    partnerCsv.text.includes('Hope Foundation') &&
    !partnerCsv.text.includes('Rural Health Initiative'),
  partnerCsv.text.slice(0, 200)
);

const lacaCsv = await download('/reports/export', laca);
check(
  'LACA export contains only their own LGA',
  lacaCsv.status === 200 &&
    lacaCsv.text.includes('Jos North') &&
    !lacaCsv.text.includes('Barkin Ladi'),
  lacaCsv.text.slice(0, 200)
);

const partnerCsvScope = await download(
  `/reports/export?organization_id=${(await call('GET', '/organizations', partnerRural)).body.data[0]?.id}`,
  partner
);
check('partner cannot widen a CSV export with organization_id', partnerCsvScope.status === 403);

console.log('\n== Reports: breakdowns, duplicate keys, periods ==');
const monthlyPayload = {
  client_uuid: crypto.randomUUID(),
  period_type: 'monthly',
  period_year: 2026,
  period_number: 1,
  values: [
    { indicator_id: byCode.HTS_TST.id, disaggregation_key: 'total', value: 10 },
    { indicator_id: byCode.HTS_TST.id, disaggregation_key: 'sex=female', value: 4 },
    { indicator_id: byCode.HTS_TST.id, disaggregation_key: 'sex=male', value: 5 },
  ],
};
const monthly = await call('POST', '/reports', partner, monthlyPayload);
check('report with sex breakdown is created', monthly.status === 201, JSON.stringify(monthly.body).slice(0, 300));
const monthlyId = monthly.body.data?.id;
const sumMismatch = await call('POST', `/reports/${monthlyId}/submit`, partner);
check('breakdown that does not add up is blocked', sumMismatch.status === 400 && sumMismatch.body.error === 'REPORT_INCONSISTENT', JSON.stringify(sumMismatch.body).slice(0, 300));

const duplicateKey = await call('PATCH', `/reports/${monthlyId}`, partner, {
  values: [
    { indicator_id: byCode.HTS_TST.id, disaggregation_key: 'total', value: 10 },
    { indicator_id: byCode.HTS_TST.id, disaggregation_key: 'total', value: 11 },
  ],
});
check('duplicate indicator and breakdown is rejected', duplicateKey.status === 400 && duplicateKey.body.error === 'DUPLICATE_REPORT_VALUE');

const badKey = await call('PATCH', `/reports/${monthlyId}`, partner, {
  values: [{ indicator_id: byCode.HTS_TST.id, disaggregation_key: 'sex=unknown', value: 1 }],
});
check('unknown breakdown value is rejected', badKey.status === 400 && badKey.body.error === 'DISAGGREGATION_INVALID');

await call('PATCH', `/reports/${monthlyId}`, partner, {
  values: [
    { indicator_id: byCode.HTS_TST.id, disaggregation_key: 'total', value: 10 },
    { indicator_id: byCode.HTS_TST.id, disaggregation_key: 'sex=female', value: 4 },
    { indicator_id: byCode.HTS_TST.id, disaggregation_key: 'sex=male', value: 6 },
  ],
});
const monthlySubmitted = await call('POST', `/reports/${monthlyId}/submit`, partner);
check('complete sex breakdown passes the sum check', monthlySubmitted.status === 200 && monthlySubmitted.body.data.status === 'submitted');

const annualBad = await call('POST', '/reports', partner, {
  client_uuid: crypto.randomUUID(),
  period_type: 'annual',
  period_year: 2027,
  period_number: 2,
  values: [],
});
check('annual report must use period 1', annualBad.status === 400 && annualBad.body.error === 'VALIDATION_FAILED');

console.log('\n== Reports: return and resubmit ==');
const returnedReport = await call('POST', `/reports/${monthlyId}/review`, officer, {
  decision: 'return',
  reason: 'Male and female counts do not match the facility tally. Check the paper form.',
});
check('PLACA officer returns a report with a reason', returnedReport.status === 200 && returnedReport.body.data.status === 'returned' && returnedReport.body.data.return_reason);

const noReason = await call('POST', `/reports/${monthlyId}/review`, officer, { decision: 'return' });
check('a return without a reason is rejected', noReason.status === 400 && noReason.body.error === 'VALIDATION_FAILED');

const editReturned = await call('PATCH', `/reports/${monthlyId}`, partner, {
  values: [
    { indicator_id: byCode.HTS_TST.id, disaggregation_key: 'total', value: 12 },
    { indicator_id: byCode.HTS_TST.id, disaggregation_key: 'sex=female', value: 5 },
    { indicator_id: byCode.HTS_TST.id, disaggregation_key: 'sex=male', value: 7 },
  ],
});
check('partner edits a returned report', editReturned.status === 200 && editReturned.body.data.status === 'returned');

const reSubmittedReport = await call('POST', `/reports/${monthlyId}/submit`, partner);
check('partner resubmits a returned report', reSubmittedReport.status === 200 && reSubmittedReport.body.data.status === 'submitted' && reSubmittedReport.body.data.return_reason === null);

const finalValidate = await call('POST', `/reports/${monthlyId}/review`, officer, { decision: 'validate' });
check('returned report can be validated after resubmission', finalValidate.status === 200 && finalValidate.body.data.status === 'validated');

console.log('\n== Scope cannot be widened by query filters ==');
const ruralOrgId = (await call('GET', '/organizations', partnerRural)).body.data[0]?.id;
const lacaOrgScope = await call('GET', `/organizations?lga_id=${barkinLadi.id}`, laca);
check(
  'LACA officer cannot widen the organization list with lga_id',
  lacaOrgScope.status === 403 && lacaOrgScope.body.error === 'LGA_NOT_ALLOWED',
  JSON.stringify(lacaOrgScope.body).slice(0, 200)
);

const partnerPlanScope = await call('GET', `/workplans?organization_id=${ruralOrgId}`, partner);
check(
  'partner cannot widen the workplan list with organization_id',
  partnerPlanScope.status === 403 && partnerPlanScope.body.error === 'ORGANIZATION_ACCESS_DENIED',
  JSON.stringify(partnerPlanScope.body).slice(0, 200)
);

const partnerReportScope = await call('GET', `/reports?organization_id=${ruralOrgId}`, partner);
check(
  'partner cannot widen the report list with organization_id',
  partnerReportScope.status === 403 &&
    partnerReportScope.body.error === 'ORGANIZATION_ACCESS_DENIED',
  JSON.stringify(partnerReportScope.body).slice(0, 200)
);

const lacaReportScope = await call('GET', `/reports?lga_id=${barkinLadi.id}`, laca);
check(
  'LACA officer cannot widen the report list with lga_id',
  lacaReportScope.status === 403 && lacaReportScope.body.error === 'LGA_NOT_ALLOWED',
  JSON.stringify(lacaReportScope.body).slice(0, 200)
);

console.log('\n== Draft deletion ==');
const throwaway = await call('POST', '/reports', partner, {
  client_uuid: crypto.randomUUID(),
  period_type: 'monthly',
  period_year: 2027,
  period_number: 2,
  values: [{ indicator_id: byCode.REACH.id, disaggregation_key: 'total', value: 1 }],
});
const throwawayId = throwaway.body.data?.id;

const removedDraft = await call('DELETE', `/reports/${throwawayId}`, partner);
check(
  'partner deletes a draft report',
  removedDraft.status === 200 && removedDraft.body.deleted === true,
  JSON.stringify(removedDraft.body).slice(0, 200)
);

const afterDelete = await call('GET', `/reports/${throwawayId}`, partner);
check('a deleted draft is gone', afterDelete.status === 404);

console.log('\n== Admin boundary ==');
// The demo admin needs a TOTP code, so assert the other side of the boundary:
// programme roles cannot read the audit log, which is admin-only.
const officerAudit = await call('GET', '/audit-logs', officer);
check(
  'PLACA officer cannot read the admin audit log',
  officerAudit.status === 403,
  JSON.stringify(officerAudit.body).slice(0, 200)
);

const lacaAudit = await call('GET', '/audit-logs', laca);
check(
  'LACA officer cannot read the admin audit log',
  lacaAudit.status === 403,
  JSON.stringify(lacaAudit.body).slice(0, 200)
);

const officerOrganizations = await call('GET', '/organizations', officer);
check('PLACA officer keeps programme access', officerOrganizations.status === 200);

console.log('\n== Phase 5: help library ==');
const hopeOrgId = (await call('GET', '/organizations', partner)).body.data[0]?.id;
const partnerGuides = await call('GET', '/guides', partner);
check(
  'partner sees published English guides for their role',
  partnerGuides.status === 200 && partnerGuides.body.pagination.total >= 1,
  JSON.stringify(partnerGuides.body).slice(0, 200)
);

const hausaGuides = await call('GET', '/guides?language=ha', partner);
check(
  'Hausa guides are available',
  hausaGuides.status === 200 && hausaGuides.body.data.every((guide) => guide.language === 'ha'),
  JSON.stringify(hausaGuides.body).slice(0, 200)
);

const partnerCreateGuide = await call('POST', '/guides', partner, {
  key: 'verify_phase5_guide',
  language: 'en',
  title: 'Verify Phase 5 guide',
  body_md: '### What it means\nA test guide created by the verification script.',
  audience_roles: ['partner_staff'],
  page_key: 'support',
  field_key: 'phase5_test',
});
check('partner staff cannot edit guides', partnerCreateGuide.status === 403);

const createdGuide = await call('POST', '/guides', officer, {
  key: 'verify_phase5_guide',
  language: 'en',
  title: 'Verify Phase 5 guide',
  body_md: '### What it means\nA test guide created by the verification script.',
  audience_roles: ['partner_staff'],
  page_key: 'support',
  field_key: 'phase5_test',
});
check(
  'PLACA officer creates a guide',
  createdGuide.status === 201 && createdGuide.body.data.key === 'verify_phase5_guide',
  JSON.stringify(createdGuide.body).slice(0, 200)
);
const createdGuideId = createdGuide.body.data?.id;

const duplicateGuide = await call('POST', '/guides', officer, {
  key: 'verify_phase5_guide',
  language: 'en',
  title: 'Duplicate guide',
  body_md: 'This should be rejected because the key and language already exist.',
});
check(
  'a guide key is unique per language',
  duplicateGuide.status === 409 && duplicateGuide.body.error === 'GUIDE_EXISTS'
);

const fetchedGuide = await call('GET', '/guides/verify_phase5_guide', partner);
check(
  'partner fetches a guide by key',
  fetchedGuide.status === 200 && fetchedGuide.body.data.title === 'Verify Phase 5 guide'
);

const markedGuide = await call('POST', '/guides/progress/verify_phase5_guide', partner, {
  completed: true,
});
check('partner marks a guide as done', markedGuide.status === 200 && Boolean(markedGuide.body.data.completed_at));

const guideProgress = await call('GET', '/guides/progress', partner);
check(
  'guide progress is stored for the reader',
  guideProgress.status === 200 &&
    guideProgress.body.data.some((row) => row.guide_key === 'verify_phase5_guide')
);

const deletedGuide = await call('DELETE', `/guides/${createdGuideId}`, officer);
check('PLACA officer deletes a guide', deletedGuide.status === 200 && deletedGuide.body.deleted === true);

console.log('\n== Phase 5: resource library ==');
const partnerDocuments = await call('GET', '/documents', partner);
check('partner reads the document catalogue', partnerDocuments.status === 200);

const partnerUpload = await uploadFile(
  '/documents',
  partner,
  { title: 'Partner upload', category: 'guideline', language: 'en', is_public: 'false' },
  { name: 'partner.txt', type: 'text/plain', content: 'not allowed' }
);
check('partner staff cannot upload documents', partnerUpload.status === 403, JSON.stringify(partnerUpload.body));

const uploaded = await uploadFile(
  '/documents',
  officer,
  { title: 'Verify Phase 5 resource', category: 'guideline', language: 'en', is_public: 'false' },
  { name: 'phase5-resource.txt', type: 'text/plain', content: 'PLACA phase 5 offline resource.' }
);
check(
  'PLACA officer uploads a document',
  uploaded.status === 201 && uploaded.body.data.original_name === 'phase5-resource.txt',
  JSON.stringify(uploaded.body).slice(0, 300)
);
const documentId = uploaded.body.data?.id;

const officerDocuments = await call('GET', '/documents?search=Verify Phase 5', officer);
check(
  'uploaded document appears in the catalogue',
  officerDocuments.status === 200 &&
    officerDocuments.body.data.some((doc) => doc.id === documentId)
);

const downloaded = await download(`/documents/${documentId}/download`, partner);
check(
  'partner downloads a shared document',
  downloaded.status === 200 && downloaded.text.includes('PLACA phase 5 offline resource'),
  `${downloaded.status} ${downloaded.text.slice(0, 80)}`
);

const badUpload = await uploadFile(
  '/documents',
  officer,
  { title: 'Bad file type', category: 'guideline', language: 'en', is_public: 'false' },
  { name: 'bad.exe', type: 'application/x-msdownload', content: 'not allowed' }
);
check('unsupported file types are rejected', badUpload.status === 400 && badUpload.body.error === 'UPLOAD_FAILED', JSON.stringify(badUpload.body));

const partnerDelete = await call('DELETE', `/documents/${documentId}`, partner);
check('partner staff cannot delete documents', partnerDelete.status === 403);

const deletedDocument = await call('DELETE', `/documents/${documentId}`, officer);
check('PLACA officer deletes a document', deletedDocument.status === 200 && deletedDocument.body.deleted === true);

const missingDownload = await download(`/documents/${documentId}/download`, partner);
check('a deleted document can no longer be downloaded', missingDownload.status === 404);

console.log('\n== Phase 5: equipment and stock ==');
const partnerCreateItem = await call('POST', '/equipment', partner, {
  name: 'Verify Phase 5 partner item',
  unit: 'kit',
});
check('partner staff cannot manage the equipment catalogue', partnerCreateItem.status === 403);

const createdItem = await call('POST', '/equipment', officer, {
  name: 'Verify Phase 5 Test Kits',
  description: 'Rapid test kits used by the verification script.',
  unit: 'kit',
});
check(
  'PLACA officer adds an equipment item',
  createdItem.status === 201 && createdItem.body.data.name === 'Verify Phase 5 Test Kits',
  JSON.stringify(createdItem.body).slice(0, 200)
);
const equipmentItemId = createdItem.body.data?.id;

const duplicateItem = await call('POST', '/equipment', officer, {
  name: 'verify phase 5 test kits',
  unit: 'kit',
});
check('equipment names are unique regardless of case', duplicateItem.status === 409 && duplicateItem.body.error === 'EQUIPMENT_NAME_TAKEN');

const partnerItems = await call('GET', '/equipment', partner);
check(
  'partner reads the equipment catalogue',
  partnerItems.status === 200 && partnerItems.body.data.some((item) => item.id === equipmentItemId)
);

const stockSet = await call('PUT', `/equipment/${equipmentItemId}/stock`, officer, {
  lga_id: josNorth.id,
  quantity: 25,
});
check('PLACA officer sets LGA stock', stockSet.status === 200 && stockSet.body.data.quantity === 25);

const partnerStock = await call('GET', '/equipment/stock', partner);
const partnerStockItem = (partnerStock.body.data || []).find((item) => item.id === equipmentItemId);
check(
  'partner sees stock for their own LGA',
  partnerStock.status === 200 &&
    partnerStockItem?.stock_levels.some(
      (level) => level.lga_id === josNorth.id && level.quantity === 25
    ),
  JSON.stringify(partnerStockItem || {}).slice(0, 300)
);

const partnerSetStock = await call('PUT', `/equipment/${equipmentItemId}/stock`, partner, {
  lga_id: josNorth.id,
  quantity: 1,
});
check('partner staff cannot change stock', partnerSetStock.status === 403);

console.log('\n== Phase 5: support requests ==');
const supportPayload = {
  client_uuid: crypto.randomUUID(),
  kind: 'equipment',
  description: 'Verify phase 5 request for test kits and gloves.',
  items: [{ equipment_item_id: equipmentItemId, qty_requested: 10 }],
};
const createdSupport = await call('POST', '/support-requests', partner, supportPayload);
check(
  'partner creates an equipment support request',
  createdSupport.status === 201 &&
    createdSupport.body.data.status === 'requested' &&
    createdSupport.body.data.items.length === 1,
  JSON.stringify(createdSupport.body).slice(0, 300)
);
const supportId = createdSupport.body.data?.id;

const resentSupport = await call('POST', '/support-requests', partner, supportPayload);
check(
  're-sending the same support client_uuid is idempotent',
  resentSupport.status === 201 && resentSupport.body.data.id === supportId
);

const partnerDecide = await call('POST', `/support-requests/${supportId}/decision`, partner, {
  decision: 'approve',
});
check('partner staff cannot decide a support request', partnerDecide.status === 403);

const officerRequests = await call('GET', '/support-requests?status=requested', officer);
check(
  'PLACA officer sees the new support request',
  officerRequests.status === 200 &&
    officerRequests.body.data.some((request) => request.id === supportId)
);

const approvedSupport = await call('POST', `/support-requests/${supportId}/decision`, officer, {
  decision: 'approve',
});
check(
  'PLACA officer approves a support request',
  approvedSupport.status === 200 &&
    approvedSupport.body.data.status === 'approved' &&
    approvedSupport.body.data.items[0].qty_approved === 10,
  JSON.stringify(approvedSupport.body).slice(0, 300)
);

const supplied = await call('POST', `/support-requests/${supportId}/supplies`, officer, {
  items: [
    {
      support_request_item_id: approvedSupport.body.data.items[0].id,
      qty_delivered: 10,
    },
  ],
});
check(
  'PLACA officer records a delivery',
  supplied.status === 200 && supplied.body.data.status === 'in_transit',
  JSON.stringify(supplied.body).slice(0, 300)
);

const received = await call('POST', `/support-requests/${supportId}/confirm-receipt`, partner);
check(
  'partner confirms receipt and closes the delivery loop',
  received.status === 200 && received.body.data.status === 'delivered',
  JSON.stringify(received.body).slice(0, 300)
);

const lacaRequests = await call('GET', '/support-requests', laca);
check(
  'LACA officer sees only requests in their own LGA',
  lacaRequests.status === 200 &&
    lacaRequests.body.data.every((request) => request.organization?.lga?.name === 'Jos North')
);

const otherOrgRequest = await call('GET', `/support-requests/${supportId}`, partnerRural);
check('a partner cannot read another organization request', otherOrgRequest.status === 403);

const trainingRequest = await call('POST', '/support-requests', partner, {
  client_uuid: crypto.randomUUID(),
  kind: 'training',
  description: 'Verify phase 5 training request with no equipment.',
  items: [],
});
check('partner creates a training support request', trainingRequest.status === 201);
const trainingId = trainingRequest.body.data?.id;

const trainingWithItems = await call('POST', '/support-requests', partner, {
  client_uuid: crypto.randomUUID(),
  kind: 'training',
  description: 'Training requests must not carry equipment lines.',
  items: [{ equipment_item_id: equipmentItemId, qty_requested: 1 }],
});
check('training requests cannot list equipment', trainingWithItems.status === 400);

const rejectWithoutNote = await call('POST', `/support-requests/${trainingId}/decision`, officer, {
  decision: 'reject',
});
check(
  'rejecting a request requires a reason',
  rejectWithoutNote.status === 400 && rejectWithoutNote.body.error === 'VALIDATION_FAILED'
);

const rejected = await call('POST', `/support-requests/${trainingId}/decision`, officer, {
  decision: 'reject',
  note: 'Training dates are not available this quarter.',
});
check('PLACA officer rejects a request with a reason', rejected.status === 200 && rejected.body.data.status === 'rejected');

console.log('\n== Phase 5: funding ==');
const partnerCreateSource = await call('POST', '/funding/sources', partner, {
  name: 'Verify Phase 5 partner source',
  type: 'donor',
});
check('partner staff cannot create funding sources', partnerCreateSource.status === 403);

const createdSource = await call('POST', '/funding/sources', officer, {
  name: 'Verify Phase 5 Donor',
  type: 'donor',
  description: 'Funding source created by the verification script.',
});
check(
  'PLACA officer creates a funding source',
  createdSource.status === 201 && createdSource.body.data.name === 'Verify Phase 5 Donor',
  JSON.stringify(createdSource.body).slice(0, 200)
);
const fundingSourceId = createdSource.body.data?.id;

const duplicateSource = await call('POST', '/funding/sources', officer, {
  name: 'verify phase 5 donor',
  type: 'donor',
});
check('funding source names are unique regardless of case', duplicateSource.status === 409 && duplicateSource.body.error === 'FUNDING_SOURCE_EXISTS');

const partnerSources = await call('GET', '/funding/sources', partner);
check(
  'partner reads active funding sources',
  partnerSources.status === 200 &&
    partnerSources.body.data.some((source) => source.id === fundingSourceId)
);

const createdInflow = await call('POST', '/funding/inflows', officer, {
  funding_source_id: fundingSourceId,
  amount: 500000,
  currency: 'NGN',
  received_on: '2026-10-01',
  purpose: 'Verify phase 5 inflow',
});
check(
  'PLACA officer records a funding inflow',
  createdInflow.status === 201 && createdInflow.body.data.amount === 500000,
  JSON.stringify(createdInflow.body).slice(0, 200)
);
const fundingInflowId = createdInflow.body.data?.id;

const partnerInflows = await call('GET', '/funding/inflows', partner);
check('partner staff cannot read funding inflows', partnerInflows.status === 403);

const createdAllocation = await call('POST', '/funding/allocations', officer, {
  funding_source_id: fundingSourceId,
  funding_inflow_id: fundingInflowId,
  recipient_organization_id: hopeOrgId,
  amount: 200000,
  currency: 'NGN',
  period: '2026-Q4',
  purpose: 'Verify phase 5 allocation',
  status: 'planned',
});
check(
  'PLACA officer allocates funding to a partner',
  createdAllocation.status === 201 &&
    createdAllocation.body.data.recipient?.id === hopeOrgId &&
    createdAllocation.body.data.amount === 200000,
  JSON.stringify(createdAllocation.body).slice(0, 300)
);
const allocationId = createdAllocation.body.data?.id;

const partnerAllocations = await call('GET', '/funding/allocations', partner);
check(
  'partner sees allocations addressed to their organization',
  partnerAllocations.status === 200 &&
    partnerAllocations.body.data.some((row) => row.id === allocationId)
);

const ruralAllocations = await call('GET', '/funding/allocations', partnerRural);
check(
  'a partner cannot see another organization allocation',
  ruralAllocations.status === 200 &&
    !ruralAllocations.body.data.some((row) => row.id === allocationId)
);

const lacaAllocations = await call('GET', '/funding/allocations', laca);
check(
  'LACA officer sees only allocations in their own LGA',
  lacaAllocations.status === 200 &&
    lacaAllocations.body.data.every(
      (row) => row.lga?.id === josNorth.id || row.recipient?.lga?.id === josNorth.id
    )
);

const disbursed = await call('PATCH', `/funding/allocations/${allocationId}`, officer, {
  status: 'disbursed',
});
check(
  'PLACA officer marks an allocation disbursed',
  disbursed.status === 200 &&
    disbursed.body.data.status === 'disbursed' &&
    Boolean(disbursed.body.data.approved_by)
);

const partnerCreateAllocation = await call('POST', '/funding/allocations', partner, {
  recipient_organization_id: hopeOrgId,
  amount: 1000,
  period: '2026-Q4',
});
check('partner staff cannot allocate funding', partnerCreateAllocation.status === 403);

const fundingSummary = await call('GET', '/funding/summary?period=2026-Q4', officer);
check(
  'funding summary totals the period',
  fundingSummary.status === 200 && fundingSummary.body.data.total_allocated >= 200000,
  JSON.stringify(fundingSummary.body).slice(0, 300)
);

console.log('\n== Phase 5: welfare programmes ==');
const createdProgramme = await call('POST', '/programmes', partner, {
  kind: 'skills_training',
  name: 'Verify Phase 5 Skills Programme',
  description: 'Programme created by the verification script.',
  lga_id: josNorth.id,
  start_date: '2026-10-01',
  end_date: '2026-12-31',
  status: 'planned',
});
check(
  'partner creates a programme for their organization',
  createdProgramme.status === 201 &&
    createdProgramme.body.data.organization?.id === hopeOrgId &&
    createdProgramme.body.data.lga?.id === josNorth.id,
  JSON.stringify(createdProgramme.body).slice(0, 300)
);
const programmeId = createdProgramme.body.data?.id;

const otherOrgProgramme = await call('GET', `/programmes/${programmeId}`, partnerRural);
check('a partner cannot read another organization programme', otherOrgProgramme.status === 403);

const ruralProgrammes = await call('GET', '/programmes', partnerRural);
check(
  'a partner programme list excludes another organization programme',
  ruralProgrammes.status === 200 &&
    !ruralProgrammes.body.data.some((programme) => programme.id === programmeId)
);

const lacaProgrammes = await call('GET', '/programmes', laca);
check(
  'LACA officer sees programmes in their own LGA',
  lacaProgrammes.status === 200 &&
    lacaProgrammes.body.data.some((programme) => programme.id === programmeId)
);

const officerProgrammes = await call('GET', '/programmes', officer);
check(
  'PLACA officer sees all programmes',
  officerProgrammes.status === 200 &&
    officerProgrammes.body.data.some((programme) => programme.id === programmeId)
);

const badProgrammeDates = await call('PATCH', `/programmes/${programmeId}`, partner, {
  start_date: '2026-06-01',
  end_date: '2026-05-01',
});
check(
  'a programme end date cannot be before its start date',
  badProgrammeDates.status === 400 && badProgrammeDates.body.error === 'VALIDATION_FAILED'
);

const updatedProgramme = await call('PATCH', `/programmes/${programmeId}`, partner, {
  name: 'Verify Phase 5 Skills Programme (updated)',
});
check(
  'partner edits their own programme',
  updatedProgramme.status === 200 &&
    updatedProgramme.body.data.name === 'Verify Phase 5 Skills Programme (updated)'
);

const throwawayProgramme = await call('POST', '/programmes', partner, {
  kind: 'stigma_support',
  name: 'Verify Phase 5 Throwaway Programme',
  lga_id: josNorth.id,
  status: 'planned',
});
const throwawayProgrammeId = throwawayProgramme.body.data?.id;
const removedProgramme = await call('DELETE', `/programmes/${throwawayProgrammeId}`, partner);
check(
  'partner deletes an unused planned programme',
  removedProgramme.status === 200 && removedProgramme.body.deleted === true
);

const linkedProgramme = await call('POST', '/programmes', partner, {
  kind: 'testing_campaign',
  name: 'Verify Phase 5 Linked Programme',
  lga_id: josNorth.id,
  status: 'planned',
});
const linkedProgrammeId = linkedProgramme.body.data?.id;
const linkedReport = await call('POST', '/reports', partner, {
  client_uuid: crypto.randomUUID(),
  period_type: 'monthly',
  period_year: 2026,
  period_number: 9,
  programme_id: linkedProgrammeId,
  values: [{ indicator_id: byCode.REACH.id, disaggregation_key: 'total', value: 2 }],
});
check('a report can link to a programme', linkedReport.status === 201, JSON.stringify(linkedReport.body).slice(0, 300));
const linkedReportId = linkedReport.body.data?.id;

const deleteLinkedProgramme = await call('DELETE', `/programmes/${linkedProgrammeId}`, partner);
check(
  'a programme with linked reports cannot be deleted',
  deleteLinkedProgramme.status === 409 &&
    deleteLinkedProgramme.body.error === 'PROGRAMME_IN_USE',
  JSON.stringify(deleteLinkedProgramme.body).slice(0, 200)
);

if (linkedReportId) {
  await call('DELETE', `/reports/${linkedReportId}`, partner);
}

console.log('\n== Phase 5: notifications ==');
const partnerNotifications = await call('GET', '/notifications', partner);
check(
  'workflow events create notifications for the partner',
  partnerNotifications.status === 200 &&
    partnerNotifications.body.unread >= 1 &&
    partnerNotifications.body.data.length >= 1,
  JSON.stringify(partnerNotifications.body).slice(0, 300)
);
const partnerNotificationIds = new Set(
  (partnerNotifications.body.data || []).map((notification) => notification.id)
);

const firstNotification = partnerNotifications.body.data?.[0];
const readOne = await call('POST', `/notifications/${firstNotification?.id}/read`, partner);
check('a notification can be marked read', readOne.status === 200 && Boolean(readOne.body.data.read_at));

const readAll = await call('POST', '/notifications/read-all', partner);
check('all notifications can be marked read', readAll.status === 200);

const unreadAfter = await call('GET', '/notifications/unread', partner);
check('the unread counter reaches zero', unreadAfter.status === 200 && unreadAfter.body.unread === 0);

const ruralNotifications = await call('GET', '/notifications', partnerRural);
check(
  'notifications are private to each account',
  ruralNotifications.status === 200 &&
    !ruralNotifications.body.data.some((notification) =>
      partnerNotificationIds.has(notification.id)
    )
);

console.log('\n== Phase 5: admin boundary ==');
// The demo admin has no authenticator enrolled, so login returns the account
// id in the TOTP setup response. Sign a short-lived access token for that id
// to exercise the role boundary without enrolling a real second factor.
const adminLogin = await call('POST', '/auth/login', null, {
  identifier: 'admin@placa.gov.ng',
  password: demoPassword,
});
const adminId = adminLogin.body?.user?.id;
const adminToken = adminId
  ? jwt.sign(
      { sub: adminId, role: 'admin', typ: 'access' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '5m', issuer: 'placa-api', audience: 'placa-client' }
    )
  : null;
check('admin account is available for the boundary check', Boolean(adminToken), JSON.stringify(adminLogin.body).slice(0, 200));

const adminAudit = adminToken ? await call('GET', '/audit-logs', adminToken) : { status: 0, body: {} };
check('admin reads the audit log', adminAudit.status === 200);

const adminReports = adminToken ? await call('GET', '/reports', adminToken) : { status: 0, body: {} };
check('admin cannot read programme reports', adminReports.status === 403, JSON.stringify(adminReports.body).slice(0, 200));

const adminSupport = adminToken ? await call('GET', '/support-requests', adminToken) : { status: 0, body: {} };
check('admin cannot read support requests', adminSupport.status === 403);

const adminFunding = adminToken ? await call('GET', '/funding/sources', adminToken) : { status: 0, body: {} };
check('admin cannot read funding records', adminFunding.status === 403);

const adminProgrammes = adminToken ? await call('GET', '/programmes', adminToken) : { status: 0, body: {} };
check('admin cannot read welfare programmes', adminProgrammes.status === 403);

const adminEquipment = adminToken ? await call('GET', '/equipment', adminToken) : { status: 0, body: {} };
check('admin cannot read equipment records', adminEquipment.status === 403);

const adminGuides = adminToken ? await call('GET', '/guides', adminToken) : { status: 0, body: {} };
check('admin can still read the help library', adminGuides.status === 200);

const adminDocuments = adminToken ? await call('GET', '/documents', adminToken) : { status: 0, body: {} };
check('admin can still read shared documents', adminDocuments.status === 200);

const adminNotifications = adminToken ? await call('GET', '/notifications', adminToken) : { status: 0, body: {} };
check('admin can read their own notifications', adminNotifications.status === 200);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
