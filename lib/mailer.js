// Outbound mail for the storefront, over Hostinger's SMTP.
//
// Until this existed the site had no way to send anything at all, while the
// Help page told buyers "a download link is emailed to the address you enter"
// and "lost it? write to us and we'll resend". Neither was true: the only copy
// of a download link was the order page a buyer landed on after checkout, so
// closing that tab lost the purchase with no recovery path.
//
// Two rules shape everything below.
//
// 1. Sending must never break checkout. The payment is already captured by the
//    time we send, so a refused SMTP login or a mail server timeout must not
//    turn a successful purchase into a 500. Every function here resolves with
//    an { ok, error } result and throws nothing.
//
// 2. Missing configuration is not a crash. If the SMTP variables are absent the
//    module reports itself unconfigured and the caller carries on. That keeps
//    local development and any future deploy that forgets a variable working,
//    rather than repeating the .env outage where one missing value took the
//    whole site down.

// Loaded defensively. A bare require here would run at startup, so if a build
// ever lands without node_modules - npm install skipped, a pruned deploy, an
// install that failed while the build still reported success - the throw would
// stop the process before it binds a port and Hostinger would answer 503 for
// the whole storefront. That exact failure mode has taken this site down
// before, over a missing .env rather than a missing package. Mail is worth
// less than the shop: if the dependency is absent, mail degrades to
// unconfigured and everything else keeps serving.
let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (error) {
  console.error('[mail] nodemailer is not installed - outgoing mail is disabled:', error.message);
}

// Hostinger's outgoing server. Port 465 is implicit TLS, which is what their
// mailboxes expect; 587 (STARTTLS) also works if a host ever needs it.
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.hostinger.com';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

// The mailbox is contact@dwellingdream.shop. Hostinger's SMTP will only send as
// the account that authenticated, so MAIL_FROM defaults to SMTP_USER rather
// than to a separate address that would be rejected as a forged sender.
const MAIL_FROM = process.env.MAIL_FROM || (SMTP_USER ? `Dwelling Dream <${SMTP_USER}>` : '');
const CONTACT_TO = process.env.CONTACT_TO || SMTP_USER;
// Where sale notifications land. Separate from CONTACT_TO so the shop can send
// them somewhere the support inbox is not, but defaults to the same mailbox.
const SALES_TO = process.env.SALES_TO || CONTACT_TO;

let transporter = null;

function isMailConfigured() {
  return Boolean(nodemailer && SMTP_USER && SMTP_PASS);
}

function getTransporter() {
  if (!isMailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
  }
  return transporter;
}

// Resolves { ok: true } or { ok: false, error }. Never rejects - see rule 1.
async function sendMail({ to, subject, text, html, replyTo }) {
  if (!to) return { ok: false, error: 'No recipient address.' };

  const tx = getTransporter();
  if (!tx) {
    // Logged rather than thrown so an unconfigured deploy is visible without
    // costing a customer their purchase.
    console.warn(`[mail] not configured - skipped "${subject}" to ${to}`);
    return { ok: false, error: 'SMTP is not configured.' };
  }

  try {
    await tx.sendMail({ from: MAIL_FROM, to, subject, text, html, replyTo });
    return { ok: true };
  } catch (error) {
    console.error(`[mail] failed to send "${subject}" to ${to}:`, error.message);
    return { ok: false, error: error.message };
  }
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// The order confirmation. Its entire job is to put the tokenized order URL in
// the buyer's inbox, because that link is the only way back to files they have
// already paid for.
function orderConfirmation({ order, orderUrl }) {
  const items = (order.items || []);
  const currency = order.currency || 'USD';
  const money = amount => `${currency === 'USD' ? '$' : ''}${Number(amount).toFixed(2)}`;

  // Order items carry `title`, not `name` - the shape insertOrder() stores and
  // the order page renders. Getting this wrong silently produced blank product
  // names in the email rather than any error.
  const nameOf = item => item.title || item.name || 'Item';
  // The bundled guides are attached as a separate zero-priced line. "$0.00"
  // next to them reads like a mistake, so say what it actually means.
  const amountOf = item => (Number(item.price) === 0 ? 'Included' : money(item.price * (item.qty || 1)));

  const lines = items.flatMap(item => {
    const qty = Number(item.qty) > 1 ? ` x ${item.qty}` : '';
    const files = (item.digitalFiles || []).map(f => `      ${f.name}`);
    return [`  - ${nameOf(item)}${qty}  ${amountOf(item)}`, ...files];
  });

  const text = [
    'Thank you for your order.',
    '',
    'Your files are ready to download here:',
    orderUrl,
    '',
    'Keep this email - the link above stays active, so you can come back to',
    'your downloads at any time.',
    '',
    'What you bought:',
    ...lines,
    '',
    `Order total: ${money(order.total)}`,
    `Order reference: ${order.id}`,
    '',
    'Digital downloads only - nothing is shipped.',
    '',
    'Something wrong with a file or a link? Reply to this email and we will',
    'put it right.',
    '',
    'Dwelling Dream',
    'https://dwellingdream.shop'
  ].join('\n');

  const rows = items.map(item => {
    const qty = Number(item.qty) > 1 ? ` &times; ${item.qty}` : '';
    const files = (item.digitalFiles || [])
      .map(f => `<div style="color:#8A837A;font-size:12px;padding-top:3px;">${escapeHtml(f.name)}</div>`)
      .join('');
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #E5DFD4;color:#292825;">${escapeHtml(nameOf(item))}${qty}${files}</td>
      <td style="padding:8px 0;border-bottom:1px solid #E5DFD4;color:#292825;text-align:right;vertical-align:top;">${amountOf(item)}</td>
    </tr>`;
  }).join('');

  const html = `<div style="margin:0;padding:32px 20px;background:#F5F2EA;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#FFFDF8;padding:36px 32px;border-radius:6px;">
    <h1 style="margin:0 0 20px;font-family:Georgia,serif;font-weight:500;font-size:26px;color:#292825;">Thank you for your order</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4A4741;">Your files are ready. Keep this email &mdash; the link below stays active, so you can come back to your downloads at any time.</p>
    <p style="margin:0 0 28px;">
      <a href="${escapeHtml(orderUrl)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#292825;color:#F5F2EA;font-size:13px;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;">Download your files</a>
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 20px;">${rows}
      <tr>
        <td style="padding:12px 0 0;color:#292825;font-weight:bold;">Total</td>
        <td style="padding:12px 0 0;color:#292825;font-weight:bold;text-align:right;">${money(order.total)}</td>
      </tr>
    </table>
    <p style="margin:0 0 6px;font-size:12px;color:#8A837A;">Order reference: ${escapeHtml(order.id)}</p>
    <p style="margin:0 0 24px;font-size:12px;color:#8A837A;">Digital downloads only &mdash; nothing is shipped.</p>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#4A4741;">Something wrong with a file or a link? Reply to this email and we will put it right.</p>
  </div>
</div>`;

  return { subject: 'Your Dwelling Dream downloads', text, html };
}

// The shop's own copy of a sale. Until this existed a sale produced no signal
// at all - the only way to learn about one was to open the admin panel and
// look, so an order could sit unnoticed indefinitely.
//
// replyTo is the buyer, so answering a customer is one keystroke rather than a
// copy-paste out of the admin panel.
function saleNotification({ order, orderUrl, buyerEmail }) {
  const items = order.items || [];
  const currency = order.currency || 'USD';
  const money = amount => `${currency === 'USD' ? '$' : ''}${Number(amount).toFixed(2)}`;
  const nameOf = item => item.title || item.name || 'Item';
  const paid = items.filter(item => Number(item.price) > 0);

  // The subject carries the whole story, so a phone lock screen is enough to
  // know what happened without opening anything.
  const headline = paid.length === 1
    ? nameOf(paid[0])
    : `${paid.length || items.length} items`;
  const subject = `Sale: ${headline} - ${money(order.total)}`;

  const lines = items.map(item => {
    const qty = Number(item.qty) > 1 ? ` x ${item.qty}` : '';
    const amount = Number(item.price) === 0 ? 'Included' : money(item.price * (item.qty || 1));
    return `  - ${nameOf(item)}${qty}  ${amount}`;
  });

  const text = [
    `A ${money(order.total)} order just completed.`,
    '',
    `Buyer:     ${buyerEmail || 'NOT PROVIDED BY STRIPE - no receipt could be sent'}`,
    `Reference: ${order.id}`,
    `Total:     ${money(order.total)} ${currency}`,
    '',
    'Items:',
    ...lines,
    '',
    'The buyer\'s download page (same link they were emailed):',
    orderUrl,
    '',
    'Reply to this email to reach the buyer directly.'
  ].join('\n');

  const rows = items.map(item => {
    const qty = Number(item.qty) > 1 ? ` &times; ${item.qty}` : '';
    const amount = Number(item.price) === 0 ? 'Included' : money(item.price * (item.qty || 1));
    return `<tr>
      <td style="padding:7px 0;border-bottom:1px solid #E5DFD4;">${escapeHtml(nameOf(item))}${qty}</td>
      <td style="padding:7px 0;border-bottom:1px solid #E5DFD4;text-align:right;">${amount}</td>
    </tr>`;
  }).join('');

  const buyerLine = buyerEmail
    ? `<a href="mailto:${escapeHtml(buyerEmail)}">${escapeHtml(buyerEmail)}</a>`
    : '<strong style="color:#8C3A2B;">not provided by Stripe &mdash; no receipt could be sent</strong>';

  const html = `<div style="margin:0;padding:28px 20px;background:#F5F2EA;font-family:Helvetica,Arial,sans-serif;color:#292825;">
  <div style="max-width:560px;margin:0 auto;background:#FFFDF8;padding:32px;border-radius:6px;">
    <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-weight:500;font-size:24px;">A ${money(order.total)} order just completed</h1>
    <p style="margin:0 0 6px;font-size:14px;">Buyer: ${buyerLine}</p>
    <p style="margin:0 0 20px;font-size:12px;color:#8A837A;">Reference: ${escapeHtml(order.id)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 18px;">${rows}
      <tr>
        <td style="padding:11px 0 0;font-weight:bold;">Total</td>
        <td style="padding:11px 0 0;font-weight:bold;text-align:right;">${money(order.total)} ${escapeHtml(currency)}</td>
      </tr>
    </table>
    <p style="margin:0 0 18px;font-size:13px;"><a href="${escapeHtml(orderUrl)}">The buyer's download page</a> &mdash; the same link they were emailed.</p>
    <p style="margin:0;font-size:13px;color:#5F5A54;">Reply to this email to reach the buyer directly.</p>
  </div>
</div>`;

  return { subject, text, html, replyTo: buyerEmail || undefined };
}

// A contact form submission, delivered to the support mailbox. replyTo is set
// to the sender so support can just hit reply.
function contactMessage({ name, email, message }) {
  const text = [
    `From: ${name} <${email}>`,
    '',
    message,
    '',
    '--',
    'Sent from the contact form at https://dwellingdream.shop/contact'
  ].join('\n');

  const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#292825;">
  <p style="margin:0 0 16px;"><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
  <div style="white-space:pre-wrap;">${escapeHtml(message)}</div>
  <p style="margin:24px 0 0;font-size:12px;color:#8A837A;">Sent from the contact form at https://dwellingdream.shop/contact</p>
</div>`;

  return { subject: `Contact form: ${name}`, text, html, replyTo: `${name} <${email}>` };
}

module.exports = {
  isMailConfigured,
  sendMail,
  orderConfirmation,
  saleNotification,
  contactMessage,
  CONTACT_TO,
  SALES_TO
};
