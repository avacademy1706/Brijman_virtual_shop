// Errors the API turns into the `{ error: { code, message, fields? } }` envelope.

export class HttpError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} code short machine-readable code
   * @param {string} message safe to show to visitors; never includes internals
   * @param {Record<string, string>} [fields] per-field messages, keyed by path such as `lines.0.productId`
   */
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const badRequest = (message) => new HttpError(400, 'bad_request', message);
export const notFound = (message) => new HttpError(404, 'not_found', message || 'Not found.');
export const invalid = (fields, message) =>
  new HttpError(422, 'validation_failed', message || 'Some details need fixing.', fields);
