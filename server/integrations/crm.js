// Pushes orders and bookings to DGCC as leads. Does nothing until DGCC_API_URL and DGCC_API_KEY are set on the server.

const configured = () => !!(process.env.DGCC_API_URL && process.env.DGCC_API_KEY);

/**
 * @param {{type: 'order'|'booking', ref: string, [key: string]: unknown}} event
 */
export async function pushLead(event) {
  void event;
  if (!configured()) return { skipped: true, reason: 'not_configured' };
  return { skipped: true, reason: 'not_implemented' };
}
