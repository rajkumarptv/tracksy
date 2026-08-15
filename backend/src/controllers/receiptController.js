const { parseReceipt } = require('../utils/receiptParser');
const { readReceiptWithGemini } = require('../utils/geminiReceipt');
const sharp = require('sharp');

/* Preprocess: upscale + grayscale + high contrast → big OCR accuracy boost
   on colourful UPI receipts. */
async function preprocess(buffer) {
  try {
    return await sharp(buffer)
      .resize({ width: 1000, withoutEnlargement: false })  // upscale small screenshots
      .grayscale()
      .normalise()                                          // stretch contrast
      .sharpen()
      .toBuffer();
  } catch { return buffer; }
}

/* OCR an image buffer → text (Tesseract) */
async function ocrImage(buffer) {
  const { createWorker } = require('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const pre = await preprocess(buffer);
    const { data } = await worker.recognize(pre);
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

    // 1) Primary: read the image with Gemini vision (understands the whole
    //    receipt, no OCR/regex). Falls through to Tesseract if the key is
    //    missing or the call fails (network/offline).
    let parsed = null;
    try {
      parsed = await readReceiptWithGemini(req.file.buffer);
      if (parsed) {
        console.log('[receipt-scan] gemini parsed:', JSON.stringify(parsed));
        return res.json({ success:true, data: parsed });
      }
      // Gemini ran but couldn't read a payment — treat as unreadable image.
      console.log('[receipt-scan] gemini: image not a readable receipt');
      return res.status(422).json({ success:false, message:'Could not read the receipt. Try a clearer image.' });
    } catch (gemErr) {
      console.warn('[receipt-scan] gemini unavailable, falling back to OCR:', gemErr.message);
    }

    // 2) Fallback: legacy Tesseract OCR + regex parser.
    const text = await ocrImage(req.file.buffer);
    parsed = parseReceipt(text);
    if (!parsed) {
      console.log('[receipt-scan] OCR text (no parse):\n', text.slice(0, 400));
      return res.status(422).json({ success:false, message:'Could not read the screenshot. Try a clearer image.', raw: text.slice(0, 300) });
    }
    console.log('[receipt-scan] ocr parsed:', JSON.stringify(parsed));
    res.json({ success:true, data: parsed });
  } catch (err) {
    console.error('Receipt scan error:', err.message);
    res.status(500).json({ success:false, message:'Failed to scan image' });
  }
};

module.exports = { scan };
