/**
 * generateEmailTemplate — single branded HTML email template for Local Connect.
 *
 * @param {object} opts
 * @param {string} opts.heading      - Bold heading below the header (e.g. "Verify Your Email")
 * @param {string} opts.name         - Recipient name for greeting (e.g. "Aayush")
 * @param {string} opts.body         - Main paragraph(s) — supports \n for line breaks
 * @param {string} [opts.highlight]  - Optional highlighted box text (e.g. a link or post title)
 * @param {string} [opts.highlightLabel] - Label above the highlight box (e.g. "Reset link:")
 * @param {string} [opts.footer]     - Optional extra footer note
 */
function generateEmailTemplate({ heading, name, body, highlight, highlightLabel, footer }) {
    const bodyHtml = (body || "")
        .split("\n")
        .map(line => line.trim() ? `<p style="margin:0 0 12px;">${line}</p>` : "")
        .join("");

    const highlightBlock = highlight
        ? `<div style="background:#f0fafa;border-left:4px solid #04888D;border-radius:4px;padding:14px 18px;margin:20px 0;font-size:15px;color:#1c1c1e;word-break:break-all;">
        ${highlightLabel ? `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#64748b;margin-bottom:6px;">${highlightLabel}</div>` : ""}
        ${highlight}
       </div>`
        : "";

    const footerNote = footer
        ? `<p style="margin:20px 0 0;font-size:13px;color:#94a3b8;">${footer}</p>`
        : "";

    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#04888D;padding:28px 36px;text-align:center;">
            <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">Local Connect</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.7);margin-top:4px;letter-spacing:0.08em;text-transform:uppercase;">Community Engagement Platform</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 28px;">
            <h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#1e293b;">${heading}</h2>
            <p style="margin:0 0 16px;font-size:15px;color:#374151;">Hi <strong>${name}</strong>,</p>
            <div style="font-size:15px;color:#374151;line-height:1.7;">${bodyHtml}</div>
            ${highlightBlock}
            ${footerNote}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fb;padding:18px 36px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">&copy; Local Connect &mdash; Nepal Community Platform</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

module.exports = { generateEmailTemplate };
