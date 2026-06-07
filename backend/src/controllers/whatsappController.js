const { query } = require('../db');

// ── PUT /api/whatsapp/phone — link a WhatsApp number to the account ──────────
// (Twilio path removed — WhatsApp now runs via Meta Cloud API in
//  whatsappMetaController.js. This only stores the user's phone number.)
const savePhone = async (req, res) => {
  try {
    const { whatsapp_phone } = req.body;
    const phone = whatsapp_phone?.replace(/[^\d+]/g, '').replace(/^([^+])/, '+$1') || null;

    await query(
      `UPDATE users SET whatsapp_phone = $1, updated_at = NOW() WHERE id = $2`,
      [phone, req.user.userId]
    );
    res.json({ success: true, whatsapp_phone: phone });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'This number is already linked to another account' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { savePhone };
