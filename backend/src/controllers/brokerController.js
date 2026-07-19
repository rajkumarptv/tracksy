const https = require('https');

const DHAN_BASE = 'https://api.dhan.co';

function dhanRequest(path, accessToken, clientId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.dhan.co',
      path,
      method: 'GET',
      headers: {
        'access-token': accessToken,
        'client-id': clientId,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { reject(new Error('Invalid JSON from Dhan API')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Dhan API timeout')); });
    req.end();
  });
}

// POST /broker/dhan/holdings
// Body: { access_token, client_id }
const getDhanHoldings = async (req, res) => {
  try {
    const { access_token, client_id } = req.body;
    if (!access_token || !client_id) {
      return res.status(400).json({ success: false, message: 'access_token and client_id are required' });
    }

    const [holdingsRes, fundsRes] = await Promise.allSettled([
      dhanRequest('/holdings', access_token, client_id),
      dhanRequest('/fundlimit', access_token, client_id),
    ]);

    if (holdingsRes.status === 'rejected') {
      return res.status(502).json({ success: false, message: holdingsRes.reason?.message || 'Dhan holdings API failed' });
    }

    const hr = holdingsRes.value;
    if (hr.status === 401) {
      return res.status(401).json({ success: false, message: 'Invalid Dhan credentials. Check your Client ID and Access Token.' });
    }
    if (hr.status !== 200) {
      return res.status(502).json({ success: false, message: `Dhan API returned status ${hr.status}` });
    }

    const rawHoldings = Array.isArray(hr.data) ? hr.data : (hr.data?.data || []);

    const holdings = rawHoldings.map((h) => ({
      tradingSymbol:  h.tradingSymbol   || h.trading_symbol || '',
      exchange:       h.exchange        || 'NSE',
      isin:           h.isin            || h.securityId     || '',
      totalQty:       parseFloat(h.totalQty      || h.total_qty      || h.quantity       || 0),
      availableQty:   parseFloat(h.availableQty  || h.available_qty  || h.totalQty       || 0),
      avgCostPrice:   parseFloat(h.avgCostPrice  || h.avg_cost_price || h.averageCostPrice || 0),
      lastTradedPrice:parseFloat(h.lastTradedPrice || h.ltp || h.last_trade_price || 0),
      dayChange:      parseFloat(h.dayChange      || h.day_change     || 0),
      dayChangePct:   parseFloat(h.dayChangePct   || h.day_change_pct || 0),
      invested:       parseFloat(h.totalQty || 0) * parseFloat(h.avgCostPrice || 0),
      currentValue:   parseFloat(h.totalQty || 0) * parseFloat(h.lastTradedPrice || h.avgCostPrice || 0),
    }));

    let funds = null;
    if (fundsRes.status === 'fulfilled' && fundsRes.value.status === 200) {
      const fd = fundsRes.value.data;
      funds = {
        availableBalance: parseFloat(fd.availabelBalance || fd.available_balance || fd.availableBalance || 0),
        usedMargin:       parseFloat(fd.utilizedAmount   || fd.used_margin       || 0),
      };
    }

    res.json({ success: true, data: { holdings, funds } });
  } catch (err) {
    console.error('Dhan broker error:', err.message);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

module.exports = { getDhanHoldings };
