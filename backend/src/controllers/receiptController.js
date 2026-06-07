const { parseReceipt } = require('../utils/receiptParser');

/* OCR an image buffer → text (Tesseract) */
async function ocrImage(buffer) {
  const { createWorker } = require('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const { data } = await worker.recognize(buffer);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

/* ── POST /api/receipt/scan ──────────────────────────────────────────────
   Accepts an uploaded payment screenshot, returns parsed fields for review.
   (Does NOT save — the app shows a review screen so the user sets category.)
*/
const scan = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success:false, message:'No image provided' });

    const text   = await ocrImage(req.file.buffer);
    const parsed = parseReceipt(text);

    if (!parsed) {
      return res.status(422).json({ success:false, message:'Could not read the screenshot. Try a clearer image.', raw: text.slice(0, 300) });
    }
    res.json({ success:true, data: parsed });
  } catch (err) {
    console.error('Receipt scan error:', err.message);
    res.status(500).json({ success:false, message:'Failed to scan image' });
  }
};

module.exports = { scan };
