# Tracksy analytics: setup guide (GTM + GA4)

The app sends clean, documented events to the Google Tag Manager data layer (`window.dataLayer`). GTM turns them into GA4 events. The app side is done; this guide covers the two things that live in your Google accounts: **the GTM container** and **GA4 settings and reports**.

- GTM container: `GTM-KMVKKZK8` (already installed in `index.html`; production builds only, via `analytics/vite-gtm-plugin.mjs`, which defaults to this container because `.env` files are git-ignored in this repo).
- Event reference (every event, parameter and allowed value): [`EVENTS.md`](./EVENTS.md).
- Importable container: [`gtm-container.json`](./gtm-container.json).

## 1. Import the GTM container (about 10 minutes)

> I could not import-test this file against your GTM account. Import it into a **new workspace** and use **Preview** before publishing, so nothing live changes until you are happy.

1. In GTM open container `GTM-KMVKKZK8` → **Workspaces → New** (name it `Analytics v1`).
2. **Admin → Import Container** → choose `gtm-container.json` → Workspace: **Existing → Analytics v1** → Import option: **Merge** → **Rename conflicting tags, triggers, and variables**.
3. Open **Variables → `GA4 Measurement ID`** and replace `G-XXXXXXXXXX` with your GA4 Measurement ID (GA4 → Admin → Data streams → your web stream).
4. Click **Preview**, enter your site URL, and click around (see [DebugView checklist](#4-debugview-checklist)). Every action should show the matching GA4 tag firing once.
5. **Submit → Publish**.

What was imported: 1 GA4 configuration tag (sends no automatic page view), 46 GA4 event tags with one custom-event trigger each, 31 variables (the measurement id, one data-layer variable per parameter, and an event-settings variable with the user properties).

## 2. GA4 Admin settings

| Where | Setting | Why |
|---|---|---|
| Data streams → web stream → **Enhanced measurement** → gear | Turn **off** "Page changes based on browser history events" (and any other auto events you don't want) | The app already sends `page_view` on every route change. Leaving this on double-counts |
| Data settings → **Data retention** | Event data retention **14 months** | Longest available; needed for year-over-year |
| Data settings → **Data collection** | Turn **off** Google signals data collection | Not needed, and avoids ad-personalisation features |
| Data settings → **Data sharing settings** | Turn off everything you don't use | Privacy |
| Data streams → **Configure tag settings → Define internal traffic** + Data filters | Add your office/home IPs and activate the filter | Keeps your own testing out of the numbers |
| Reporting identity | **Blended** (includes User-ID) | `user_id` is a hashed id, which lets GA4 join sessions across devices |
| Custom definitions | Create the event-scoped and user-scoped dimensions listed in [`EVENTS.md`](./EVENTS.md#custom-definitions-to-register-in-ga4-admin--custom-definitions) | Without them, the parameters exist but can't be used in reports |
| Events (after 24 hours of data) | Mark as **Key event**: `sign_up`, `account_created`, `transaction_added`, `budget_created`, `goal_created`, `import_completed` | Conversion reporting and the activation funnel |

Custom dimensions take up to 24 hours to start populating, and only apply to data collected after they are created.

## 3. Reports to build (GA4 → Explore)

| Question | How to build it |
|---|---|
| **How many people sign up and activate?** | New **Funnel exploration**. Steps: 1 `sign_up` → 2 `account_created` → 3 `transaction_added` → 4 `budget_created` **or** `goal_created`. Make it an *open* funnel with a 7-day window; breakdown by *Platform* |
| **Do people come back?** | New **Cohort exploration**. Cohort inclusion: `sign_up`. Return criteria: `transaction_added`. Granularity weekly, 8 weeks |
| **Which features get used?** | **Free form**. Rows: *Event name*. Values: *Event count*, *Total users*. Filter *Event name* matches regex `^(transaction_|budget_|goal_|recurring_|debt_|payoff_|import_|receipt_|category_|family_|forecast_|insights_)` |
| **Is the forecast useful?** | Free form. Rows: *Page path*. Values: *Views*, *Users*. Filter *Page path* contains `/forecast`. Add `forecast_banner_clicked` (by *Cash-flow banner state*) and `forecast_range_changed` |
| **Is the debt coach used?** | Events `payoff_method_selected` and `payoff_extra_set` (by *Extra payment bucket*), plus views of `/debts?tab=payoff` |
| **Import and scan success** | Funnel: `import_previewed` → `import_completed`. Separate table: `receipt_scanned` by *Operation succeeded* |
| **How do people add transactions?** | `transaction_added` by *Transaction type* and *How the transaction was created* (manual / import / scan) |
| **Is anything broken?** | Free form. Rows: *API area*, *HTTP status*. Values: *Event count*. Event `api_error` (5xx and network failures only) |
| **Web vs Android app** | Add the user dimension *Platform* to any report |
| **How many choose to opt out?** | Event `analytics_opt_out_changed` by *Usage analytics switched on* |

Standard metrics you get without any extra work: active users (daily/weekly/monthly), new users, engagement time, and top pages.

## 4. DebugView checklist

In GTM Preview (or GA4 → Admin → DebugView), perform each action once and confirm exactly one event:

- Open `/login` → `page_view` (title "Sign in"), no query string in the URL.
- Sign in → `login` (`method=password`), then a `user_context` push; the GA4 config tag re-fires.
- Dashboard → `page_view`; click the cash-flow strip → `forecast_banner_clicked`.
- Add an expense → `transaction_added` (`tx_type=expense`, `tx_source=manual`) and **no amount** anywhere.
- Open `/debts?tab=payoff` → `page_view` with `?tab=payoff`; change the strategy → `payoff_method_selected`.
- Search for something → `search_used` and the URL shows `/transactions` only (the search text is never sent).
- Settings → toggle "Share anonymous usage data" off → one last `analytics_opt_out_changed`, then no further events.

## 5. What is never sent

By design the app's allow-list drops anything else before it reaches the data layer. **Never sent:** email, name, phone, password or tokens, transaction descriptions, merchant names, account/goal/budget/family names, search text, receipt or statement contents, and **any amount or balance**. User ids are a SHA-256 hash, not the database id. URLs are stripped of query strings (except `tab=`) and ids/tokens.

## 6. Privacy and consent (decision recorded)

The product owner chose to load analytics **without a consent banner**. Be aware:

- Visitors from the EU/UK (GDPR/ePrivacy) and India (DPDP Act) can be legally required to opt in to analytics cookies. This setup relies on the allow-list (no personal data), an in-app opt-out (Settings → Privacy) and respect for the browser's Global Privacy Control, which reduces but does not remove that exposure.
- Recommended follow-ups: publish a privacy policy that names Google Analytics and what is collected, and consider adding Google Consent Mode v2 with a small banner later. The events here would not change; only the GTM consent settings and a banner would be added.

## 7. Changing or adding events

1. Add the event (and any new parameter) to `src/lib/analyticsEvents.js`.
2. Call `track('event_name', { ... })` where the action **succeeds** (after the API call, never in a `catch`).
3. Run `node analytics/generate-gtm.mjs` and commit the regenerated `gtm-container.json` and `EVENTS.md`.
4. In GTM, import the new container into a new workspace using **Merge → Overwrite conflicting** only if you haven't customised the tags; otherwise add the single new tag and trigger by hand.
5. `npm test` enforces that every catalogue event is fired, nothing outside the catalogue is fired, and the committed container matches the catalogue.

## 8. Troubleshooting

- **"Google tag wasn't detected" when setting up the GA4 stream:** the page must load the container *and* the container must have a **published** version that contains the GA4 configuration tag. Import and publish `gtm-container.json` (section 1), then retry detection. Also check the deployed HTML contains `GTM-KMVKKZK8` and not `%VITE_GTM_ID%`.
- **No data at all:** development builds never load GTM (no `VITE_GTM_ID`). Check the deployed site: in the browser console, `window.google_tag_manager['GTM-KMVKKZK8']` should exist and `window.dataLayer` should list events.
- **GTM loads but GA4 shows nothing:** the `GA4 Measurement ID` variable still says `G-XXXXXXXXXX`, or the container version isn't published.
- **Ad blockers** block GTM for a share of users, so GA4 counts are a lower bound.
- **Events but no custom dimension values:** the dimensions weren't registered yet, or they were registered after the data was collected.
