# Tracksy analytics: Google Analytics 4 setup guide

The app sends events **directly to Google Analytics 4** with the standard `gtag.js` tag. No Tag Manager is involved by default.

- GA4 Measurement ID: `G-TNP5J4QCZL` (built into production builds; see [How it is wired](#how-it-is-wired)).
- Every event, parameter and allowed value: [`EVENTS.md`](./EVENTS.md).
- Tag Manager is **optional and off**. See [Appendix: using Tag Manager instead](#appendix-using-tag-manager-instead).

## 1. After deploying, confirm the tag is detected

1. Open your live site, then in the browser console run: `typeof window.gtag` → `"function"`, and `window.__TRACKSY_GA__` → `"G-TNP5J4QCZL"`.
2. In the Network tab, filter for `collect`: you should see requests to `google-analytics.com/g/collect` after you navigate.
3. In GA4: **Admin → Data streams → your web stream → "Test your website"** (or **View tag instructions**). Detection can take a few minutes. Opening **Reports → Realtime** while you click around your site is the quickest proof.

If detection still fails, check that the deployed HTML contains `gtag/js?id=G-TNP5J4QCZL` (View source) and that an ad blocker isn't blocking Google in your own browser.

## 2. GA4 Admin settings (analytics.google.com → Admin)

| Where | Setting | Why |
|---|---|---|
| **Data streams → your stream → Enhanced measurement** (gear icon) | Turn **off** "Page changes based on browser history events" | The app already sends a clean `page_view` on every route change. Leaving this on double-counts, and would send raw URLs |
| Same screen | Turn off "Site search" | Search is a transactions search; its query must never reach Google |
| **Data collection and modification → Data retention** | Event data retention **14 months** | The longest available |
| **Data collection and modification → Data collection** | Turn **off** Google signals data collection | Not needed, avoids ad-personalisation features |
| **Data collection and modification → Data filters** (and **Data streams → Configure tag settings → Define internal traffic**) | Add your IPs as internal traffic and activate the filter | Keeps your own testing out of the numbers |
| **Reporting identity** | **Blended** (includes User-ID) | `user_id` is a hashed id, so sessions join across devices |
| **Data display → Custom definitions** | Create the event-scoped and user-scoped dimensions listed in [`EVENTS.md`](./EVENTS.md#custom-definitions-to-register-in-ga4-admin--custom-definitions) | Without them the parameters are collected but can't be used in reports |
| **Data display → Events** (an event appears here after it has been received once) | Toggle **Mark as key event**: `sign_up`, `account_created`, `transaction_added`, `budget_created`, `goal_created`, `import_completed` | Conversion reporting and the activation funnel |

Custom dimensions take up to 24 hours to populate and only apply to data collected after they exist. Menu names move a little between Google updates; use the search box at the top of GA4 if one isn't where described.

## 3. Reports to build (left menu → Explore)

| Question | How to build it |
|---|---|
| **How many people sign up and activate?** | **Funnel exploration**. Steps: `sign_up` → `account_created` → `transaction_added` → `budget_created` **or** `goal_created`. Open funnel, 7-day window, breakdown by *Platform* |
| **Do people come back?** | **Cohort exploration**. Cohort inclusion: `sign_up`. Return criteria: `transaction_added`. Weekly granularity, 8 weeks |
| **Which features get used?** | **Free form**. Rows: *Event name*. Values: *Event count*, *Total users*. Filter *Event name* matches regex `^(transaction_\|budget_\|goal_\|recurring_\|debt_\|payoff_\|import_\|receipt_\|category_\|family_\|forecast_\|insights_)` |
| **Is the forecast useful?** | Free form. Rows: *Page path*. Values: *Views*, *Users*. Filter *Page path* contains `/forecast`. Add `forecast_banner_clicked` (by *Cash-flow banner state*) and `forecast_range_changed` |
| **Is the debt coach used?** | Events `payoff_method_selected`, `payoff_extra_set` (by *Extra payment bucket*), and views of `/debts?tab=payoff` |
| **Import and scan success** | Funnel `import_previewed` → `import_completed`. Separate table: `receipt_scanned` by *Operation succeeded* |
| **How do people add transactions?** | `transaction_added` by *Transaction type* and *How the transaction was created* (manual / import / scan) |
| **Is anything broken?** | Free form. Rows: *API area*, *HTTP status*. Values: *Event count*. Event `api_error` (server errors and network failures only) |
| **Web vs Android app** | Add the user dimension *Platform* to any report |
| **How many choose to opt out?** | Event `analytics_opt_out_changed` by *Usage analytics switched on* |

Built-in, with no setup: active users (daily/weekly/monthly), new users, engagement time, top pages, and **Reports → Realtime**.

## 4. DebugView checklist

Turn on debug mode in your browser (install the Google Analytics Debugger extension), then **Admin → DebugView**. Do each action once and confirm exactly one event:

- Open `/login` → `page_view` (title "Sign in"), URL without a query string.
- Sign in → `login` (`method=password`). The user id appears as a hashed value, never an email.
- Click the Dashboard cash-flow strip → `forecast_banner_clicked`.
- Add an expense → `transaction_added` (`tx_type=expense`, `tx_source=manual`) and **no amount** anywhere.
- Open `/debts?tab=payoff` → `page_view` with `?tab=payoff`; change the strategy → `payoff_method_selected`.
- Search → `search_used`; the page URL shows `/transactions` only (the search text is never sent).
- Settings → switch "Share anonymous usage data" **off** → one last `analytics_opt_out_changed`, then nothing more.

## 5. What is never sent

The app's allow-list drops anything else before it reaches Google. **Never sent:** email, name, phone, passwords or tokens, transaction descriptions, merchant names, account/goal/budget/family names, search text, receipt or statement contents, and **any amount or balance**. The user id is a SHA-256 hash, not the database id. URLs are stripped of query strings (except `tab=`) and ids/tokens.

## 6. Privacy and consent (decision recorded)

The product owner chose to load analytics **without a consent banner**. Be aware:

- Visitors from the EU/UK (GDPR/ePrivacy) and India (DPDP Act) can be legally required to opt in to analytics cookies. This setup reduces, but does not remove, that exposure: an allow-list with no personal data, an in-app switch (Settings → Privacy), and respect for the browser's Global Privacy Control (it sets Google's `ga-disable` flag).
- Recommended follow-ups: publish a privacy policy that names Google Analytics and what is collected, and consider Google Consent Mode v2 with a small banner later. The events here would not change.

## How it is wired

| Piece | File |
|---|---|
| Event/parameter catalogue (the allow-list) | `src/lib/analyticsEvents.js` |
| `track`, page views, hashed user id, opt-out, `window.gtag` calls | `src/lib/analytics.js` |
| The `gtag.js` tag and config in the page | `index.html`, filled in by `analytics/vite-analytics-plugin.mjs` |
| Where each event fires | the page components (`track('event_name', …)` after the action succeeds) |

**The measurement id** is built into production builds, so the tag works even though `.env` files are git-ignored here. To override it (for example a staging property), set `VITE_GA_MEASUREMENT_ID` in Vercel and redeploy; dev builds load nothing unless that variable is set.

**Changing or adding events:**

1. Add the event (and any new parameter) to `src/lib/analyticsEvents.js`.
2. Call `track('event_name', { … })` where the action **succeeds**, never in a `catch`.
3. Register any new parameter as a custom dimension in GA4.
4. `npm test` enforces that every catalogued event is fired somewhere and nothing outside the catalogue is.

## Troubleshooting

- **"Google tag wasn't detected":** confirm the deployed HTML contains `gtag/js?id=G-TNP5J4QCZL` and not `%VITE_`. Try again after a few minutes, and from a browser without an ad blocker.
- **No data in reports yet:** standard reports lag by hours; use **Realtime** and **DebugView** to check immediately.
- **Events but no custom dimension values:** the dimension wasn't registered yet, or was registered after the data was collected.
- **Double page views:** "Page changes based on browser history events" is still on in Enhanced measurement (section 2).
- Ad blockers stop Google tags for some visitors, so GA4 counts are a lower bound.

## Appendix: using Tag Manager instead

Direct GA4 is the default. If you ever want Tag Manager (for non-developers to add tags without a deploy), it is still supported and tested:

1. Set `VITE_GTM_ID=GTM-KMVKKZK8` in the build environment (this automatically switches direct GA4 **off**, so nothing is sent twice).
2. Re-add the Tag Manager `<noscript>` snippet to the top of `<body>` in `index.html` if you want no-JavaScript coverage.
3. Run `node analytics/generate-gtm.mjs`, then in **tagmanager.google.com** open the container → **Admin → Import Container** → `analytics/gtm-container.json` → new workspace → **Merge** → set the `GA4 Measurement ID` constant → Preview → Publish.

The generated container contains a GA4 configuration tag, one GA4 event tag and trigger per event, and the data-layer variables. It is generated from the same catalogue, so it cannot drift from the app.
