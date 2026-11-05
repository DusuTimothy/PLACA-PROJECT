'use strict';

/**
 * Report intake.
 *
 * A partner creates a draft, the device supplies a client_uuid so retries are
 * idempotent, and the partner submits when the numbers are ready. A PLACA
 * officer validates the report or returns it with a reason.
 *
 * Only counts are stored. There is no beneficiary name, address, phone number
 * or test result field anywhere in this module.
 *
 * Consistency checks run on submit, not on every keystroke:
 * - a total can never be below one of its own disaggregations;
 * - sex or age breakdowns must add up to the total when complete;
 * - cross-indicator rules from the indicator definition are enforced;
 * - reserved "soft" limits become flags in Phase 4, not blocks here.
 */

const { Op } = require('sequelize');
const { stringify } = require('csv-stringify/sync');
const PDFDocument = require('pdfkit');
const {
  Report,
  ReportValue,
  Organization,
  Indicator,
  Lga,
  WelfareProgramme,
  User,
  sequelize,
} = require('../models');
const AppError = require('../utils/AppError');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { canAccessOrganization } = require('../middleware/ownership');
const { ROLES, PLACA_ROLES } = require('../middleware/rbac');
const { recordAudit } = require('./auditService');
const { findOrganizationOrThrow } = require('./organizationService');

const REPORT_INCLUDE = [
  {
    model: Organization,
    as: 'organization',
    attributes: ['id', 'name', 'lga_id', 'status'],
  },
  { model: Lga, as: 'lga', attributes: ['id', 'name'] },
  { model: User, as: 'submitter', attributes: ['id', 'name'] },
  { model: User, as: 'validator', attributes: ['id', 'name'] },
  {
    model: ReportValue,
    as: 'values',
    include: [
      {
        model: Indicator,
        as: 'indicator',
        attributes: [
          'id',
          'code',
          'name',
          'category',
          'unit',
          'disaggregations',
          'validation_rules',
        ],
      },
    ],
  },
];

const AUTHOR_ROLES = [ROLES.PARTNER_STAFF];
const REVIEWER_ROLES = PLACA_ROLES;

function plain(instance) {
  return instance && instance.toJSON ? instance.toJSON() : instance;
}

function serializeReportValue(value) {
  const item = plain(value);
  return {
    id: item.id,
    indicator_id: item.indicator_id,
    disaggregation_key: item.disaggregation_key,
    value: item.value,
    indicator: item.indicator
      ? {
          id: item.indicator.id,
          code: item.indicator.code,
          name: item.indicator.name,
          category: item.indicator.category,
          unit: item.indicator.unit,
        }
      : null,
  };
}

function serializeReport(instance, { includeValues = true } = {}) {
  const report = plain(instance);
  if (!report) return null;

  const values = (report.values || [])
    .map(serializeReportValue)
    .sort((left, right) => {
      const byCategory = (left.indicator?.category || '').localeCompare(
        right.indicator?.category || ''
      );
      return byCategory || (left.indicator?.code || '').localeCompare(right.indicator?.code || '');
    });

  return {
    id: report.id,
    organization_id: report.organization_id,
    lga_id: report.lga_id,
    programme_id: report.programme_id,
    period_type: report.period_type,
    period_year: report.period_year,
    period_number: report.period_number,
    status: report.status,
    client_uuid: report.client_uuid,
    submitted_by: report.submitted_by,
    submitted_at: report.submitted_at,
    validated_by: report.validated_by,
    validated_at: report.validated_at,
    return_reason: report.return_reason,
    flags: report.flags || {},
    created_at: report.createdAt,
    updated_at: report.updatedAt,
    organization: report.organization
      ? {
          id: report.organization.id,
          name: report.organization.name,
          lga_id: report.organization.lga_id,
          status: report.organization.status,
        }
      : null,
    lga: report.lga ? { id: report.lga.id, name: report.lga.name } : null,
    submitter: report.submitter
      ? { id: report.submitter.id, name: report.submitter.name }
      : null,
    validator: report.validator
      ? { id: report.validator.id, name: report.validator.name }
      : null,
    ...(includeValues ? { values } : {}),
  };
}

function assertPeriod(periodType, periodNumber) {
  if (periodType === 'quarterly' && (periodNumber < 1 || periodNumber > 4)) {
    throw AppError.badRequest(
      'PERIOD_INVALID',
      'A quarterly report must be for quarter 1, 2, 3 or 4.'
    );
  }
  if (periodType === 'annual' && periodNumber !== 1) {
    throw AppError.badRequest('PERIOD_INVALID', 'An annual report always uses period 1.');
  }
}

function parseDisaggregationKey(key) {
  if (key === 'total') return { total: true, dimensions: {} };
  const dimensions = {};
  for (const part of key.split('|')) {
    const separator = part.indexOf('=');
    if (separator <= 0 || separator === part.length - 1) {
      throw AppError.badRequest(
        'DISAGGREGATION_INVALID',
        'A disaggregation must look like "sex=female" or "age=15-19".'
      );
    }
    const dimension = part.slice(0, separator);
    const value = part.slice(separator + 1);
    if (!['sex', 'age'].includes(dimension)) {
      throw AppError.badRequest(
        'DISAGGREGATION_INVALID',
        'Only sex and age breakdowns are supported.'
      );
    }
    if (dimensions[dimension] !== undefined) {
      throw AppError.badRequest(
        'DISAGGREGATION_INVALID',
        'A disaggregation cannot repeat the same dimension.'
      );
    }
    dimensions[dimension] = value;
  }
  return { total: false, dimensions };
}

function assertKeyAllowed(key, indicator) {
  const parsed = parseDisaggregationKey(key);
  const available = indicator.disaggregations || {};

  for (const [dimension, value] of Object.entries(parsed.dimensions)) {
    const allowed = available[dimension];
    if (!Array.isArray(allowed) || !allowed.includes(value)) {
      throw AppError.badRequest(
        'DISAGGREGATION_INVALID',
        `"${value}" is not a valid ${dimension} group for ${indicator.name}.`
      );
    }
  }

  if (!parsed.total && Object.keys(parsed.dimensions).length === 0) {
    throw AppError.badRequest('DISAGGREGATION_INVALID', 'The disaggregation is empty.');
  }

  return parsed;
}

async function loadIndicators(rawValues) {
  const indicatorIds = [...new Set(rawValues.map((value) => value.indicator_id))];
  if (indicatorIds.length === 0) return new Map();

  const indicators = await Indicator.findAll({
    where: { id: { [Op.in]: indicatorIds } },
  });
  const map = new Map(indicators.map((indicator) => [indicator.id, indicator]));

  for (const id of indicatorIds) {
    const indicator = map.get(id);
    if (!indicator) {
      throw AppError.badRequest(
        'INDICATOR_NOT_FOUND',
        'One of the indicators in this report does not exist.'
      );
    }
    if (!indicator.is_active) {
      throw AppError.badRequest(
        'INDICATOR_INACTIVE',
        'One of the indicators in this report has been retired. Remove it and choose another.'
      );
    }
  }

  return map;
}

function normalizeValues(rawValues, indicatorMap) {
  const seen = new Set();
  const clean = [];

  for (const raw of rawValues) {
    const indicator = indicatorMap.get(raw.indicator_id);
    assertKeyAllowed(raw.disaggregation_key, indicator);

    const key = `${raw.indicator_id}:${raw.disaggregation_key}`;
    if (seen.has(key)) {
      throw AppError.badRequest(
        'DUPLICATE_REPORT_VALUE',
        'The same indicator and breakdown appear twice. Keep one number for each.'
      );
    }
    seen.add(key);

    const rules = indicator.validation_rules || {};
    const max = Number.isFinite(rules.max) ? rules.max : 1000000;
    if (raw.value > max) {
      throw AppError.badRequest(
        'VALUE_TOO_LARGE',
        `${indicator.name} has a limit of ${max.toLocaleString('en-NG')} for one period. Check the number.`
      );
    }

    clean.push({
      indicator_id: raw.indicator_id,
      disaggregation_key: raw.disaggregation_key,
      value: raw.value,
    });
  }

  return clean;
}

function totalsByIndicator(values) {
  const totals = new Map();
  for (const value of values) {
    if (value.disaggregation_key === 'total') {
      totals.set(value.indicator_id, value.value);
    }
  }
  return totals;
}

function addIssue(issues, message, path = 'body.values') {
  issues.push({ path, message, code: 'inconsistent' });
}

function checkSum(issues, indicator, label, sum, total) {
  if (sum !== total) {
    addIssue(
      issues,
      `${indicator.name}: the ${label} breakdown adds up to ${sum}, but the total is ${total}.`
    );
  }
}

function checkConsistency(report) {
  const values = (report.values || []).map(plain);
  const totals = totalsByIndicator(values);
  const byIndicator = new Map();

  for (const value of values) {
    if (!byIndicator.has(value.indicator_id)) byIndicator.set(value.indicator_id, []);
    byIndicator.get(value.indicator_id).push(value);
  }

  const issues = [];

  for (const [indicatorId, items] of byIndicator) {
    const indicator = items[0].indicator;
    const rules = indicator?.validation_rules || {};
    const total = totals.get(indicatorId);

    // Cross-indicator checks use totals from the same report.
    if (total !== undefined && Array.isArray(rules.consistency_rules)) {
      for (const rule of rules.consistency_rules) {
        if (rule?.type !== 'not_greater_than' || !rule.indicator_code) continue;
        const other = values.find(
          (value) =>
            value.disaggregation_key === 'total' &&
            value.indicator?.code === rule.indicator_code
        );
        if (other && total > other.value) {
          addIssue(issues, rule.message || `${indicator.name} is higher than ${rule.indicator_code}.`);
        }
      }
    }

    if (total === undefined) continue;

    // A breakdown cell can never exceed the total it belongs to.
    for (const item of items) {
      if (item.disaggregation_key !== 'total' && item.value > total) {
        addIssue(
          issues,
          `${indicator.name}: one breakdown (${item.disaggregation_key}) is higher than the total.`
        );
      }
    }

    if (rules.disaggregations_must_sum_to_total === false) continue;

    const parsed = items
      .filter((item) => item.disaggregation_key !== 'total')
      .map((item) => ({ item, ...parseDisaggregationKey(item.disaggregation_key) }));

    const composite = parsed.filter(
      (entry) => entry.dimensions.sex !== undefined && entry.dimensions.age !== undefined
    );
    const marginalSex = parsed.filter(
      (entry) => entry.dimensions.sex !== undefined && entry.dimensions.age === undefined
    );
    const marginalAge = parsed.filter(
      (entry) => entry.dimensions.age !== undefined && entry.dimensions.sex === undefined
    );

    if (composite.length > 0 && (marginalSex.length > 0 || marginalAge.length > 0)) {
      addIssue(
        issues,
        `${indicator.name}: use either full sex-by-age cells or separate sex and age breakdowns, not both.`
      );
      continue;
    }

    if (composite.length > 0) {
      const sexGroups = indicator.disaggregations?.sex || [];
      const ageGroups = indicator.disaggregations?.age || [];
      const expected = sexGroups.length * ageGroups.length;
      if (expected > 0 && composite.length === expected) {
        const sum = composite.reduce((acc, entry) => acc + entry.item.value, 0);
        checkSum(issues, indicator, 'sex-by-age', sum, total);
      }
      continue;
    }

    if (marginalSex.length > 0) {
      const sexGroups = indicator.disaggregations?.sex || [];
      const provided = new Set(marginalSex.map((entry) => entry.dimensions.sex));
      if (sexGroups.length > 0 && sexGroups.every((group) => provided.has(group))) {
        const sum = marginalSex.reduce((acc, entry) => acc + entry.item.value, 0);
        checkSum(issues, indicator, 'sex', sum, total);
      }
    }

    if (marginalAge.length > 0) {
      const ageGroups = indicator.disaggregations?.age || [];
      const provided = new Set(marginalAge.map((entry) => entry.dimensions.age));
      if (ageGroups.length > 0 && ageGroups.every((group) => provided.has(group))) {
        const sum = marginalAge.reduce((acc, entry) => acc + entry.item.value, 0);
        checkSum(issues, indicator, 'age', sum, total);
      }
    }
  }

  if (issues.length > 0) {
    throw AppError.badRequest(
      'REPORT_INCONSISTENT',
      'Some counts do not add up. Check the numbers marked below.',
      issues
    );
  }
}

async function findReportOrThrow(id) {
  const report = await Report.findByPk(id, { include: REPORT_INCLUDE });
  if (!report) {
    throw AppError.notFound('REPORT_NOT_FOUND', 'That report does not exist.');
  }
  return report;
}

function assertCanView(user, report) {
  if (!canAccessOrganization(user, report.organization)) {
    throw AppError.forbidden(
      'REPORT_ACCESS_DENIED',
      'You can only view reports for your own organization or LGA.'
    );
  }
}

function assertCanAuthor(user, report) {
  if (
    !AUTHOR_ROLES.includes(user.role) ||
    !user.organization_id ||
    report.organization_id !== user.organization_id
  ) {
    throw AppError.forbidden('REPORT_EDIT_DENIED', 'You cannot edit this report.');
  }
}

async function assertProgramme(actor, programmeId) {
  if (!programmeId) return null;
  const programme = await WelfareProgramme.findByPk(programmeId, {
    attributes: ['id', 'name', 'organization_id'],
  });
  if (!programme) {
    throw AppError.badRequest('PROGRAMME_NOT_FOUND', 'That welfare programme does not exist.');
  }
  if (programme.organization_id && programme.organization_id !== actor.organization_id) {
    throw AppError.forbidden(
      'PROGRAMME_ACCESS_DENIED',
      'You can only link a programme that belongs to your organization.'
    );
  }
  return programme.id;
}

async function replaceValues(report, values, transaction) {
  const existing = await ReportValue.findAll({
    where: { report_id: report.id },
    transaction,
  });
  for (const value of existing) {
    await value.destroy({ transaction });
  }

  if (!values.length) return;
  await ReportValue.bulkCreate(
    values.map((value) => ({ ...value, report_id: report.id })),
    { transaction }
  );
}

function buildReportScope(actor, query) {
  const where = {};

  if (actor.role === ROLES.PARTNER_STAFF) {
    if (!actor.organization_id) {
      throw AppError.forbidden('NO_ORGANIZATION', 'Your account is not linked to an organization.');
    }
    where.organization_id = actor.organization_id;
  } else if (actor.role === ROLES.LACA_OFFICER) {
    where.lga_id = actor.lga_id;
  } else if (!PLACA_ROLES.includes(actor.role)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'You cannot view reports.');
  }

  if (query.organization_id) {
    if (
      actor.role === ROLES.PARTNER_STAFF &&
      query.organization_id !== actor.organization_id
    ) {
      throw AppError.forbidden(
        'ORGANIZATION_ACCESS_DENIED',
        'You can only view reports for your own organization.'
      );
    }
    where.organization_id = query.organization_id;
  }
  if (query.lga_id) {
    if (actor.role === ROLES.LACA_OFFICER && query.lga_id !== actor.lga_id) {
      throw AppError.forbidden('LGA_NOT_ALLOWED', 'You can only view reports in your own LGA.');
    }
    if (actor.role !== ROLES.PARTNER_STAFF) where.lga_id = query.lga_id;
  }
  if (query.status) where.status = query.status;
  if (query.period_type) where.period_type = query.period_type;
  if (query.period_year) where.period_year = query.period_year;
  if (query.period_number) where.period_number = query.period_number;

  return where;
}

async function listReports(actor, query) {
  const { page, limit, offset } = getPagination(query);
  const where = buildReportScope(actor, query);

  const { rows, count } = await Report.findAndCountAll({
    where,
    include: REPORT_INCLUDE,
    order: [
      ['period_year', 'DESC'],
      ['period_type', 'ASC'],
      ['period_number', 'DESC'],
      ['created_at', 'DESC'],
    ],
    limit,
    offset,
    distinct: true,
  });

  return {
    data: rows.map((report) => serializeReport(report, { includeValues: false })),
    pagination: buildPaginationMeta({ page, limit, count }),
  };
}

async function getReport(actor, id) {
  const report = await findReportOrThrow(id);
  assertCanView(actor, report);
  return serializeReport(report);
}

const CSV_COLUMNS = [
  'report_id',
  'organization',
  'lga',
  'period_type',
  'period_year',
  'period_number',
  'status',
  'indicator_code',
  'indicator_name',
  'disaggregation',
  'value',
  'submitted_at',
  'validated_at',
];

/**
 * Load the same rows for every export format. Filters and role scope are
 * identical to the report list, so an export can never contain a row the same
 * user could not open on screen.
 */
async function loadReportsForExport(actor, query) {
  const where = buildReportScope(actor, query);

  const reports = await Report.findAll({
    where,
    include: REPORT_INCLUDE,
    order: [
      ['period_year', 'DESC'],
      ['period_type', 'ASC'],
      ['period_number', 'DESC'],
      ['created_at', 'DESC'],
    ],
    limit: 5000,
  });

  return reports.map((instance) => serializeReport(instance));
}

function readableBreakdown(key) {
  if (!key || key === 'total') return 'Total';
  return key
    .split('|')
    .map((part) => {
      const [dimension, value] = part.split('=');
      if (dimension === 'sex') {
        if (value === 'female') return 'Female';
        if (value === 'male') return 'Male';
        return `Sex ${value}`;
      }
      if (dimension === 'age') return `Ages ${value}`;
      return part;
    })
    .join(' / ');
}

function exportPeriod(report) {
  if (report.period_type === 'quarterly') {
    return `Q${report.period_number} ${report.period_year}`;
  }
  if (report.period_type === 'monthly') {
    return `${report.period_year}-${String(report.period_number).padStart(2, '0')}`;
  }
  return `${report.period_year}`;
}

function filterSummary(query) {
  const parts = [];
  if (query.period_year) parts.push(`Year ${query.period_year}`);
  if (query.period_type) parts.push(query.period_type);
  if (query.period_number) parts.push(`Period ${query.period_number}`);
  if (query.status) parts.push(`Status ${query.status}`);
  if (query.organization_id) parts.push(`Organization ${query.organization_id}`);
  if (query.lga_id) parts.push(`LGA ${query.lga_id}`);
  return parts.length > 0 ? parts.join(' | ') : 'All reports in your scope';
}

/**
 * Build the quarterly PDF in memory so the controller can set headers before
 * sending. Counts only: no beneficiary field exists to leak.
 */
function buildReportsPdf(reports, query) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('PLACA - Plateau State Agency for the Control of AIDS', { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(20).text('Reported activity report', { align: 'center' });
    doc.moveDown(0.3);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#444444')
      .text(`Generated ${new Date().toISOString().slice(0, 10)}`, { align: 'center' });
    doc.moveDown(0.8);

    doc.fillColor('#000000').fontSize(10).text(`Scope: ${filterSummary(query)}`);
    doc.moveDown(0.3);
    doc
      .fontSize(9)
      .fillColor('#444444')
      .text(
        'These figures are reported activity. They are not independent verification of every activity. Counts only; no beneficiary data is stored.'
      );
    doc.moveDown(1);
    doc.fillColor('#000000');

    if (reports.length === 0) {
      doc.fontSize(11).text('No reports match the selected filters.');
    }

    for (const report of reports) {
      if (doc.y > doc.page.height - 120) doc.addPage();

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#000000')
        .text(`${report.organization?.name || 'Unknown organization'} - ${report.lga?.name || 'Unknown LGA'}`);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#444444')
        .text(`${exportPeriod(report)} | ${report.period_type} | ${report.status}`);
      doc.moveDown(0.2);
      doc.fillColor('#000000').fontSize(9);

      if (!report.values || report.values.length === 0) {
        doc.text('No counts entered.');
      } else {
        for (const value of report.values) {
          const indicator = value.indicator;
          const label = indicator ? `${indicator.name} (${indicator.code})` : 'Unknown indicator';
          doc.text(`- ${label} | ${readableBreakdown(value.disaggregation_key)}: ${value.value}`);
        }
      }
      doc.moveDown(0.7);
    }

    // The footer repeats on every buffered page, including pages that PDFKit
    // added automatically while the report rows flowed.
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index);
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#666666')
        .text(
          'Reported activity, not independently verified fact. Counts only.',
          50,
          doc.page.height - 70,
          { width: doc.page.width - 100, align: 'center' }
        );
    }

    doc.end();
  });
}

/**
 * One CSV row per indicator/breakdown figure. Counts only: the export can never
 * contain a beneficiary name because the database never stores one.
 */
async function exportReports(actor, query) {
  const reports = await loadReportsForExport(actor, query);

  const rows = [];
  const iso = (value) => (value ? new Date(value).toISOString() : '');

  for (const report of reports) {
    const organization = report.organization?.name || '';
    const lga = report.lga?.name || '';
    const common = [
      report.id,
      organization,
      lga,
      report.period_type,
      report.period_year,
      report.period_number,
      report.status,
    ];
    const tail = [iso(report.submitted_at), iso(report.validated_at)];

    if (report.values.length === 0) {
      rows.push([...common, '', '', '', '', ...tail]);
      continue;
    }

    for (const value of report.values) {
      rows.push([
        ...common,
        value.indicator?.code || '',
        value.indicator?.name || '',
        value.disaggregation_key,
        value.value,
        ...tail,
      ]);
    }
  }

  return stringify([CSV_COLUMNS, ...rows]);
}

/**
 * The same rows as the CSV export, laid out as a printable report. The footer
 * on every page repeats that these are reported figures, not verified facts.
 */
async function exportReportsPdf(actor, query) {
  const reports = await loadReportsForExport(actor, query);
  return buildReportsPdf(reports, query);
}

async function applyReportChanges(report, actor, input) {
  const indicatorMap =
    input.values !== undefined ? await loadIndicators(input.values) : new Map();
  const values =
    input.values !== undefined ? normalizeValues(input.values, indicatorMap) : null;
  const programmeId =
    input.programme_id !== undefined ? await assertProgramme(actor, input.programme_id) : undefined;

  await sequelize.transaction(async (transaction) => {
    if (programmeId !== undefined) report.programme_id = programmeId;
    if (values) await replaceValues(report, values, transaction);
    await report.save({ transaction });
  });

  return getReport(actor, report.id);
}

async function createReport(actor, input) {
  if (!AUTHOR_ROLES.includes(actor.role)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only partner staff can create a report.');
  }
  if (!actor.organization_id) {
    throw AppError.forbidden('NO_ORGANIZATION', 'Your account is not linked to an organization.');
  }

  assertPeriod(input.period_type, input.period_number);

  const organization = await findOrganizationOrThrow(actor.organization_id);
  if (organization.status !== 'approved') {
    throw AppError.badRequest(
      'ORGANIZATION_NOT_APPROVED',
      'Your organization must be approved before you can report.'
    );
  }

  // An offline device may resend the same report. Return the existing row
  // instead of creating a duplicate, and refresh it while it is still editable.
  const existing = await Report.findOne({
    where: { client_uuid: input.client_uuid },
    include: REPORT_INCLUDE,
  });
  if (existing) {
    if (existing.organization_id !== actor.organization_id) {
      throw AppError.conflict(
        'CLIENT_UUID_TAKEN',
        'This report identifier belongs to another organization.'
      );
    }
    if (['draft', 'returned'].includes(existing.status)) {
      return applyReportChanges(existing, actor, input);
    }
    return serializeReport(existing);
  }

  const periodClash = await Report.findOne({
    where: {
      organization_id: actor.organization_id,
      period_type: input.period_type,
      period_year: input.period_year,
      period_number: input.period_number,
    },
    attributes: ['id'],
  });
  if (periodClash) {
    throw AppError.conflict(
      'REPORT_PERIOD_EXISTS',
      'A report for this organization and period already exists. Open it instead of creating another.',
      [{ path: 'body.period_number', message: 'This period already has a report.', code: 'duplicate', report_id: periodClash.id }]
    );
  }

  const indicatorMap = await loadIndicators(input.values || []);
  const values = normalizeValues(input.values || [], indicatorMap);
  const programmeId = await assertProgramme(actor, input.programme_id || null);

  const report = await sequelize.transaction(async (transaction) => {
    const created = await Report.create(
      {
        organization_id: organization.id,
        lga_id: organization.lga_id,
        programme_id: programmeId,
        period_type: input.period_type,
        period_year: input.period_year,
        period_number: input.period_number,
        status: 'draft',
        client_uuid: input.client_uuid,
        flags: {},
      },
      { transaction }
    );

    if (values.length) {
      await ReportValue.bulkCreate(
        values.map((value) => ({ ...value, report_id: created.id })),
        { transaction }
      );
    }

    return created;
  });

  return getReport(actor, report.id);
}

async function updateReport(actor, id, input) {
  const report = await findReportOrThrow(id);
  assertCanAuthor(actor, report);

  if (!['draft', 'returned'].includes(report.status)) {
    throw AppError.conflict(
      'REPORT_LOCKED',
      'This report has been submitted and can no longer be edited.'
    );
  }

  return applyReportChanges(report, actor, input);
}

async function submitReport(actor, id) {
  const report = await findReportOrThrow(id);
  assertCanAuthor(actor, report);

  if (!['draft', 'returned'].includes(report.status)) {
    throw AppError.conflict('REPORT_LOCKED', 'This report has already been submitted.');
  }

  if (!report.values || report.values.length === 0) {
    throw AppError.badRequest(
      'REPORT_EMPTY',
      'Add at least one number before submitting this report.'
    );
  }

  if (report.organization.status !== 'approved') {
    throw AppError.badRequest(
      'ORGANIZATION_NOT_APPROVED',
      'Your organization must be approved before you can submit a report.'
    );
  }

  checkConsistency(report);

  await sequelize.transaction(async (transaction) => {
    report.status = 'submitted';
    report.submitted_by = actor.id;
    report.submitted_at = new Date();
    report.validated_by = null;
    report.validated_at = null;
    report.return_reason = null;
    report.flags = {
      ...(report.flags || {}),
      consistency_checked_at: new Date().toISOString(),
    };
    await report.save({ transaction });
  });

  await recordAudit({
    action: 'report_submitted',
    entity: 'Report',
    entityId: report.id,
    userId: actor.id,
    userRole: actor.role,
    newValue: {
      status: 'submitted',
      period_type: report.period_type,
      period_year: report.period_year,
      period_number: report.period_number,
    },
  });

  return getReport(actor, id);
}

async function reviewReport(actor, id, { decision, reason }) {
  if (!REVIEWER_ROLES.includes(actor.role)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can review a report.');
  }

  const report = await findReportOrThrow(id);
  if (report.status !== 'submitted') {
    throw AppError.conflict('REPORT_NOT_SUBMITTED', 'Only a submitted report can be reviewed.');
  }

  const validate = decision === 'validate';
  if (!validate && !reason) {
    throw AppError.badRequest(
      'RETURN_REASON_REQUIRED',
      'Tell the partner what to correct before returning the report.'
    );
  }

  await sequelize.transaction(async (transaction) => {
    if (validate) {
      report.status = 'validated';
      report.validated_by = actor.id;
      report.validated_at = new Date();
      report.return_reason = null;
    } else {
      report.status = 'returned';
      report.validated_by = null;
      report.validated_at = null;
      report.return_reason = reason;
    }
    await report.save({ transaction });
  });

  await recordAudit({
    action: validate ? 'report_validated' : 'report_returned',
    entity: 'Report',
    entityId: report.id,
    userId: actor.id,
    userRole: actor.role,
    oldValue: { status: 'submitted' },
    newValue: { status: report.status, reason: reason || null },
  });

  return getReport(actor, id);
}

async function deleteReport(actor, id) {
  const report = await findReportOrThrow(id);
  assertCanAuthor(actor, report);

  if (report.status !== 'draft') {
    throw AppError.conflict('REPORT_LOCKED', 'Only a draft report can be deleted.');
  }

  await sequelize.transaction(async (transaction) => {
    for (const value of report.values || []) {
      await value.destroy({ transaction });
    }
    await report.destroy({ transaction });
  });

  await recordAudit({
    action: 'report_deleted',
    entity: 'Report',
    entityId: report.id,
    userId: actor.id,
    userRole: actor.role,
    oldValue: {
      period_type: report.period_type,
      period_year: report.period_year,
      period_number: report.period_number,
    },
  });

  return { deleted: true };
}

module.exports = {
  listReports,
  getReport,
  exportReports,
  exportReportsPdf,
  createReport,
  updateReport,
  submitReport,
  reviewReport,
  deleteReport,
  checkConsistency,
  serializeReport,
};
