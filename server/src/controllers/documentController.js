'use strict';

const fs = require('fs');
const service = require('../services/documentService');

async function list(req, res) {
  return res.json(await service.listDocuments(req.user, req.query));
}

async function create(req, res) {
  return res
    .status(201)
    .json({ data: await service.createDocument(req.user, req.file, req.body) });
}

async function update(req, res) {
  return res.json({ data: await service.updateDocument(req.user, req.params.id, req.body) });
}

async function remove(req, res) {
  return res.json(await service.deleteDocument(req.user, req.params.id));
}

async function download(req, res) {
  const { document, filePath, downloadName } = await service.openDownload(
    req.user,
    req.params.id
  );

  const stat = fs.statSync(filePath);
  const asciiName = String(downloadName).replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  const encodedName = encodeURIComponent(downloadName);

  res.setHeader('Content-Type', document.mime_type || 'application/octet-stream');
  res.setHeader('Content-Length', stat.size);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');

  return fs.createReadStream(filePath).pipe(res);
}

module.exports = { list, create, update, remove, download };
