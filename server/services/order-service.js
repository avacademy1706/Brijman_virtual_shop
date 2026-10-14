// Demo orders: validate, re-price on the server, call the integration hooks, return a reference. Nothing is stored
// in static mode, and personal data is never logged.
import { needsRx, needsAdd } from '../../shared/pricing.js';
import { rxProblems } from '../../shared/rules.js';
import { refCode } from '../lib/hash.js';
import { invalid } from '../lib/errors.js';
import { quote } from './quote-service.js';
import * as payments from '../integrations/payments.js';
import * as notifications from '../integrations/notifications.js';
import * as crm from '../integrations/crm.js';

/**
 * @param {import('../repositories/contract.js').Repository} repo
 * @param {object} body schema-checked OrderSchema body
 * @param {string} [idempotencyKey] the same key always yields the same reference
 */
export async function placeOrder(repo, body, idempotencyKey) {
  const priced = await quote(
    repo,
    body.lines.map(({ prescription, ...line }) => (void prescription, line)),
  );

  // Prescriptions: required for lines whose lenses are made to a prescription entered now, refused anywhere else.
  const { products } = await repo.getCatalogue();
  const byId = new Map(products.map((p) => [p.id, p]));
  const fields = {};
  body.lines.forEach((l, i) => {
    const p = byId.get(l.productId);
    const wantsRx = needsRx(p, l.config) && l.config.rx === 'now';
    const at = 'lines.' + i + '.prescription';
    if (wantsRx && !l.prescription) fields[at] = 'Add the prescription for ' + p.name + ', or choose to send it later.';
    else if (!wantsRx && l.prescription) fields[at] = p.name + ' does not need a prescription with these lenses.';
    else if (wantsRx) {
      const problems = rxProblems(l.prescription, needsAdd(p, l.config));
      if (problems.length) fields[at + '.' + problems[0].path] = problems[0].message;
    }
  });
  if (Object.keys(fields).length) throw invalid(fields, 'Some prescriptions need fixing.');

  const orderRef = 'BM-DEMO-' + refCode(6, idempotencyKey ? 'order:' + idempotencyKey : undefined);
  const order = {
    orderRef,
    createdAt: new Date().toISOString(),
    quoteId: priced.quoteId,
    lines: priced.lines.map((l, i) => Object.assign({}, l, { prescription: body.lines[i].prescription || null })),
    subtotal: priced.subtotal,
    deliveryFee: priced.delivery,
    total: priced.total,
    currency: priced.currency,
    contact: body.contact,
    delivery: body.delivery,
  };
  await repo.saveOrder(order);
  await Promise.all([
    payments.createPayment(order),
    notifications.sendOrderUpdate(order),
    crm.pushLead({ type: 'order', ref: orderRef }),
  ]);

  return {
    orderRef,
    status: 'demo_not_charged',
    quoteId: priced.quoteId,
    currency: priced.currency,
    taxIncluded: true,
    delivery: { method: body.delivery.method, fee: priced.delivery },
    lines: priced.lines,
    subtotal: priced.subtotal,
    total: priced.total,
  };
}
