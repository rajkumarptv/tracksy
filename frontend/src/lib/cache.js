/* ═══════════════════════════════════════════════════════════════════════
   Centralised cache invalidation.

   PROBLEM THIS SOLVES
   Financial data is read by many screens under different query keys
   (the dashboard reads `dash-summary-cur`, the list reads `transactions`,
   the chart reads `cat-breakdown`, …). Previously each mutation invalidated
   only its *own* key, so deleting a transaction left the dashboard showing
   stale rows until its 5-minute staleTime expired — or forever, because the
   cache is persisted to localStorage for 24h.

   SOLUTION
   Any write that can affect money invalidates the whole financial domain in
   one call. `refetchType: 'all'` is essential: by default react-query only
   refetches *active* (mounted) queries and merely marks inactive ones stale.
   The dashboard is inactive while you're on the Transactions screen, so
   without this it would refetch late (or serve the persisted copy first).
═══════════════════════════════════════════════════════════════════════ */

/** Every query key prefix whose data derives from transactions / wallets. */
export const FINANCE_KEYS = new Set([
  // transactions
  'transactions', 'tx-trend', 'recent-tx-dash', 'bills',
  // accounts / wallets
  'wallets',
  // dashboard aggregates
  'dash-summary-cur', 'dash-summary-prev', 'dashboard-summary',
  'cat-breakdown', 'money-flow', 'analytics-stats',
  // planning
  'budgets', 'budget-trend', 'goals', 'recurring', 'forecast', 'smart-insights',
  // net worth
  'nw-history',
]);

/**
 * Invalidate + refetch every finance-related query, mounted or not.
 * Call after ANY create / update / delete of a transaction, wallet,
 * budget, goal, recurring rule or liability payment.
 *
 * @param {import('@tanstack/react-query').QueryClient} qc
 */
export function invalidateFinance(qc) {
  return qc.invalidateQueries({
    predicate: (q) => FINANCE_KEYS.has(String(q.queryKey?.[0])),
    refetchType: 'all',
  });
}

/**
 * Hard reset — drops cached finance data entirely (not just marks stale).
 * Use after bulk destructive actions (reset data, bulk delete) so nothing
 * stale can be served from the persisted localStorage snapshot.
 */
export function resetFinance(qc) {
  qc.removeQueries({
    predicate: (q) => FINANCE_KEYS.has(String(q.queryKey?.[0])),
  });
  return invalidateFinance(qc);
}
