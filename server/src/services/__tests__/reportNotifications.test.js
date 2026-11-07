'use strict';

jest.mock('sequelize', () => ({ Op: { in: Symbol('in') } }));
jest.mock('../../models', () => ({
  Report: { findByPk: jest.fn() },
  ReportValue: {},
  Organization: {},
  Indicator: {},
  Lga: {},
  WelfareProgramme: {},
  User: {},
  sequelize: {
    transaction: jest.fn((callback) => callback({ id: 'transaction' })),
  },
}));
jest.mock('../../middleware/ownership', () => ({
  canAccessOrganization: jest.fn(() => true),
}));
jest.mock('../auditService', () => ({ recordAudit: jest.fn() }));
jest.mock('../organizationService', () => ({ findOrganizationOrThrow: jest.fn() }));
jest.mock('../notificationService', () => ({
  notifyPlacaOfficers: jest.fn(),
  notifyOrganizationPartners: jest.fn(),
}));

const { Report } = require('../../models');
const {
  notifyPlacaOfficers,
  notifyOrganizationPartners,
} = require('../notificationService');
const { submitReport, reviewReport } = require('../reportService');

const REPORT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORGANIZATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function createReport(status = 'submitted') {
  return {
    id: REPORT_ID,
    organization_id: ORGANIZATION_ID,
    period_type: 'quarterly',
    period_year: 2026,
    period_number: 2,
    status,
    submitted_by: null,
    submitted_at: null,
    validated_by: null,
    validated_at: null,
    return_reason: null,
    flags: {},
    organization: {
      id: ORGANIZATION_ID,
      name: 'Sample Partner',
      status: 'approved',
    },
    lga: { id: 'lga-id', name: 'Sample LGA' },
    values: [
      {
        id: 'value-id',
        indicator_id: 'indicator-id',
        disaggregation_key: 'total',
        value: 10,
        indicator: { id: 'indicator-id', code: 'TEST', name: 'Test', validation_rules: {} },
      },
    ],
    save: jest.fn().mockResolvedValue(undefined),
  };
}

describe('report notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('notifies PLACA reviewers when a report is submitted', async () => {
    const report = createReport('draft');
    Report.findByPk.mockResolvedValue(report);
    const actor = {
      id: 'partner-user',
      role: 'partner_staff',
      organization_id: ORGANIZATION_ID,
    };

    await submitReport(actor, REPORT_ID);

    expect(notifyPlacaOfficers).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'report',
        title: 'Report submitted for review',
        body: 'Sample Partner submitted a report for Q2 2026.',
        link: `/reports/${REPORT_ID}`,
        options: { transaction: { id: 'transaction' } },
      })
    );
  });

  test('notifies organization partners when PLACA validates a report', async () => {
    const report = createReport();
    Report.findByPk.mockResolvedValue(report);

    await reviewReport({ id: 'placa-user', role: 'placa_officer' }, REPORT_ID, {
      decision: 'validate',
    });

    expect(notifyOrganizationPartners).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      expect.objectContaining({
        kind: 'report',
        title: 'Report validated',
        body: 'Your report for Q2 2026 was validated by PLACA.',
        link: `/reports/${REPORT_ID}`,
        options: { transaction: { id: 'transaction' } },
      })
    );
  });

  test('includes the return reason in partner notifications', async () => {
    const report = createReport();
    Report.findByPk.mockResolvedValue(report);

    await reviewReport({ id: 'placa-user', role: 'placa_director' }, REPORT_ID, {
      decision: 'return',
      reason: 'Please check the total against the paper form.',
    });

    expect(notifyOrganizationPartners).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      expect.objectContaining({
        title: 'Report returned for correction',
        body: "Your report for Q2 2026 was returned. PLACA's note: Please check the total against the paper form.",
      })
    );
  });
});
