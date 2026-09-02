const { query } = require('../db');

/* ── Transaction → money-flow bucket classification ──────────────────────── */
const COMMITMENT = ['loan','emi','insurance','credit','card payment','bank payment','mortgage','tax','bill','utilit','electric','water','gas','recharge','mobile','rent','subscription'];
const ESSENTIAL  = ['grocer','food','dining','fuel','petrol','medical','health','pharmac','education','school','fee','transport','commute'];
const OPTIONAL   = ['travel','shopping','entertain','movie','game','gift','hobby','restaurant','cafe','misc','other'];

function classify(type, transferDir, categoryName) {
  if (type === 'transfer') return transferDir === 'in' ? null : 'transfers';
  if (type !== 'expense') return null;
  const c = (categoryName || '').toLowerCase();
  if (COMMITMENT.some(k => c.includes(k))) return 'commitments';
  if (ESSENTIAL.some(k => c.includes(k)))  return 'essential';
  if (OPTIONAL.some(k => c.includes(k)))   return 'optional';
  return 'optional';
}

const inr = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// GET /api/analytics/overview?start_date&end_date
const getOverview = async (req, res) => {
  try {
    const userId = req.user.userId;
    let { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      const now = new Date();
      start_date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
      end_date   = `${now.getFullYear()}-${String(now.getMonth()+2).padStart(2,'0')}-01`;
    }

    const r = await query(`
      SELECT t.type, t.amount, t.payment_name, t.transaction_date, t.transfer_direction,
             c.name AS category_name, c.emoji AS category_emoji
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id=$1 AND t.status='completed'
        AND t.transaction_date >= $2 AND t.transaction_date < $3
      ORDER BY t.transaction_date
    `, [userId, start_date, end_date]);
    const rows = r.rows.map(x => ({ ...x, amount: parseFloat(x.amount || 0) }));

    // ── KPIs ──
    let moneyIn = 0, moneyOut = 0, inCount = 0, outCount = 0;
    rows.forEach(t => {
      if (t.type === 'income' || (t.type === 'transfer' && t.transfer_direction === 'in')) { moneyIn += t.amount; inCount++; }
      else if (t.type === 'expense' || (t.type === 'transfer' && t.transfer_direction === 'out')) { moneyOut += t.amount; outCount++; }
    });

    // ── Money-flow buckets ──
    const buckets = { commitments:{amount:0,count:0}, transfers:{amount:0,count:0,recipients:new Set()}, essential:{amount:0,count:0}, optional:{amount:0,count:0} };
    rows.forEach(t => {
      const b = classify(t.type, t.transfer_direction, t.category_name);
      if (!b) return;
      buckets[b].amount += t.amount; buckets[b].count++;
      if (b === 'transfers' && t.payment_name) buckets.transfers.recipients.add(t.payment_name.trim().toLowerCase());
    });
    const totalOut = moneyOut || 1;
    const moneyFlow = [
      { key:'commitments', label:'Financial Commitments', amount:inr(buckets.commitments.amount), count:buckets.commitments.count, pct:inr(buckets.commitments.amount/totalOut*100) },
      { key:'transfers',   label:'Transfers to People',   amount:inr(buckets.transfers.amount),   count:buckets.transfers.count,   pct:inr(buckets.transfers.amount/totalOut*100), recipients:buckets.transfers.recipients.size },
      { key:'essential',   label:'Essential Living',      amount:inr(buckets.essential.amount),   count:buckets.essential.count,   pct:inr(buckets.essential.amount/totalOut*100) },
      { key:'optional',    label:'Optional Lifestyle',    amount:inr(buckets.optional.amount),    count:buckets.optional.count,    pct:inr(buckets.optional.amount/totalOut*100) },
    ];

    // ── Category breakdown (expenses) ──
    const catMap = {};
    rows.filter(t => t.type === 'expense').forEach(t => {
      const name = t.category_name || 'Uncategorized';
      (catMap[name] = catMap[name] || { name, emoji: t.category_emoji, amount:0, count:0 });
      catMap[name].amount += t.amount; catMap[name].count++;
    });
    const expenseTotal = Object.values(catMap).reduce((s,c)=>s+c.amount,0) || 1;
    const categories = Object.values(catMap)
      .map(c => ({ ...c, amount:inr(c.amount), pct:inr(c.amount/expenseTotal*100) }))
      .sort((a,b)=>b.amount-a.amount);

    // ── Weekly (by day-of-month buckets) ──
    const weeks = [0,0,0,0,0];
    rows.filter(t => t.type==='expense' || (t.type==='transfer' && t.transfer_direction==='out')).forEach(t => {
      const day = new Date(t.transaction_date).getDate();
      weeks[Math.min(4, Math.floor((day-1)/7))] += t.amount;
    });
    const weekly = weeks.map((v,i)=>({ week:i+1, label:`Week ${i+1}`, amount:inr(v) }));
    const topWeek = weekly.reduce((m,w)=> w.amount>m.amount?w:m, weekly[0]);

    // ── Daily ──
    const dayMap = {};
    rows.filter(t => t.type==='expense' || (t.type==='transfer' && t.transfer_direction==='out')).forEach(t => {
      const d = new Date(t.transaction_date).toISOString().split('T')[0];
      (dayMap[d] = dayMap[d] || { date:d, amount:0, count:0 });
      dayMap[d].amount += t.amount; dayMap[d].count++;
    });
    const daily = Object.values(dayMap).map(d=>({...d, amount:inr(d.amount)})).sort((a,b)=>a.date.localeCompare(b.date));
    const topDay = daily.reduce((m,d)=> !m||d.amount>m.amount?d:m, null);

    // ── Recipients / merchants (grouped by payee) ──
    const payeeMap = {};
    rows.filter(t => t.type==='expense' || (t.type==='transfer' && t.transfer_direction==='out')).forEach(t => {
      const name = (t.payment_name || '').trim() || 'Unknown';
      (payeeMap[name] = payeeMap[name] || { name, amount:0, count:0 });
      payeeMap[name].amount += t.amount; payeeMap[name].count++;
    });
    const payees = Object.values(payeeMap).map(p=>({...p, amount:inr(p.amount)})).sort((a,b)=>b.amount-a.amount);

    // ── Insights (rule-based) ──
    const insights = [];
    if (topWeek && topWeek.amount > 0) insights.push({ icon:'🔥', title:'Highest spending week', text:`You spent the most in ${topWeek.label} (₹${topWeek.amount.toLocaleString('en-IN')}).` });
    const transferPct = moneyFlow[1].pct;
    if (transferPct >= 25) insights.push({ icon:'👤', title:'High transfer dependency', text:`${transferPct}% of your outgoing money went to people via transfers.` });
    const groceries = categories.find(c=>/grocer/i.test(c.name));
    if (groceries && groceries.count >= 10) insights.push({ icon:'🛒', title:'Frequent small purchases', text:`You made ${groceries.count} grocery transactions. Planning weekly shops could cut trips.` });
    const food = categories.find(c=>/food|dining/i.test(c.name));
    if (food) insights.push({ icon:'🍔', title:'Food spending', text:`You spent ₹${food.amount.toLocaleString('en-IN')} on food across ${food.count} transactions.` });
    if (categories[0]) insights.push({ icon:'📊', title:'Top category', text:`${categories[0].name} is your biggest expense at ₹${categories[0].amount.toLocaleString('en-IN')} (${categories[0].pct}%).` });

    res.json({ success:true, data:{
      period:{ start_date, end_date },
      kpis:{ moneyIn:inr(moneyIn), moneyOut:inr(moneyOut), net:inr(moneyIn-moneyOut), inCount, outCount, txCount:rows.length,
        avgDaily: inr(moneyOut / Math.max(1, (new Date(end_date)-new Date(start_date))/86400000)) },
      moneyFlow, categories, weekly, topWeek, daily, topDay, payees, insights,
    }});
  } catch (err) {
    console.error('analytics.getOverview:', err.message);
    res.status(500).json({ success:false, message:'Server error' });
  }
};

module.exports = { getOverview };
