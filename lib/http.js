'use strict';

function json(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end(JSON.stringify(body));
}

function ok(res, body = {}) { return json(res, 200, body); }
function badRequest(res, message = 'Dữ liệu không hợp lệ.', code = 'BAD_REQUEST') { return json(res, 400, { error: message, code }); }
function unauthorized(res, message = 'Bạn cần đăng nhập.') { return json(res, 401, { error: message, code: 'UNAUTHORIZED' }); }
function forbidden(res, message = 'Bạn không có quyền thực hiện thao tác này.') { return json(res, 403, { error: message, code: 'FORBIDDEN' }); }
function notFound(res, message = 'Không tìm thấy dữ liệu.') { return json(res, 404, { error: message, code: 'NOT_FOUND' }); }
function conflict(res, message = 'Dữ liệu đã được xử lý.') { return json(res, 409, { error: message, code: 'CONFLICT' }); }
function tooMany(res, message = 'Bạn thao tác quá nhanh. Hãy thử lại sau.') { return json(res, 429, { error: message, code: 'RATE_LIMITED' }, { 'Retry-After': '60' }); }
function serverError(res, message = 'Hệ thống tạm thời không khả dụng.') { return json(res, 500, { error: message, code: 'INTERNAL_ERROR' }); }

function method(res, req, allowed) {
  if (allowed.includes(req.method)) return true;
  res.setHeader('Allow', allowed.join(', '));
  json(res, 405, { error: 'Phương thức không được hỗ trợ.', code: 'METHOD_NOT_ALLOWED' });
  return false;
}

function noStore(res) { res.setHeader('Cache-Control', 'no-store, max-age=0'); }

module.exports = { json, ok, badRequest, unauthorized, forbidden, notFound, conflict, tooMany, serverError, method, noStore };
