const { parseReceipt } = require('../utils/receiptParser');
const { readReceiptWithGemini } = require('../utils/geminiReceipt');
const { readReceiptWithClaude } = require('../utils/claudeReceipt');
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

    // 1) Primary: AI vision (understands the whole receipt, no OCR/regex).
    //    Try Claude first (if configured), then Gemini. Only if both fail to
    //    even run do we fall through to Tesseract OCR.
    let parsed = null;
    let anyVisionRan = false;
    const readers = [];
    if (process.env.ANTHROPIC_API_KEY) readers.push(['claude', readReceiptWithClaude]);
    if (process.env.GEMINI_API_KEY)    readers.push(['gemini', readReceiptWithGemini]);

    for (const [name, read] of readers) {
      try {
        parsed = await read(req.file.buffer);
        anyVisionRan = true;
        if (parsed) {
          console.log(`[receipt-scan] ${name} parsed:`, JSON.stringify(parsed));
          return res.json({ success:true, data: parsed });
        }
        console.log(`[receipt-scan] ${name}: image not a readable receipt`);
      } catch (e) {
        console.warn(`[receipt-scan] ${name} unavailable:`, e.message);
      }
    }
    // A vision model ran but genuinely couldn't read a payment → unreadable.
    if (anyVisionRan) {
      return res.status(422).json({ success:false, message:'Could not read the receipt. Try a clearer image.' });
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
