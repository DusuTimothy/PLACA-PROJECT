'use strict';

/**
 * Report endpoints.
 */

const service = require('../services/reportService');

async function list(req, res) {
  const result = await service.listReports(req.user, req.query);
  return res.json(result);
}

async function getOne(req, res) {
  const report = await service.getReport(req.user, req.params.id);
  return res.json({ data: report });
}

async function create(req, res) {
  const report = await service.createReport(req.user, req.body);
  return res.status(201).json({ data: report });
}

async function update(req, res) {
  const report = await service.updateReport(req.user, req.params.id, req.body);
  return res.json({ data: report });
}

async function submit(req, res) {
  const report = await service.submitReport(req.user, req.params.id);
  return res.json({ data: report });
}

async function review(req, res) {
  const report = await service.reviewReport(req.user, req.params.id, req.body);
  return res.json({ data: report });
}

async function remove(req, res) {
  const result = await service.deleteReport(req.user, req.params.id);
  return res.json(result);
}

/**
 * CSV export. Same filters and role scope as the list, one row per figure.
 */
async function exportCsv(req, res) {
  const csv = await service.exportReports(req.user, req.query);
  const stamp = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="placa-reports-${stamp}.csv"`);
  // Excel opens UTF-8 CSV correctly with a byte-order mark.
  return res.send(`\uFEFF${csv}`);
}

/**
 * Printable PDF with the same filters, role scope and counts-only rule as CSV.
 */
async function exportPdf(req, res) {
  const pdf = await service.exportReportsPdf(req.user, req.query);
  const stamp = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="placa-reports-${stamp}.pdf"`);
  res.setHeader('Content-Length', pdf.length);
  return res.send(pdf);
}

module.exports = { list, getOne, create, update, submit, review, remove, exportCsv, exportPdf };
