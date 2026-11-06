// Analytics catalogue: the ONLY events and parameters that may reach the data layer.
// It is the single source of truth for (1) the runtime sanitizer in analytics.js,
// (2) the generated GTM container in /analytics, and (3) the setup guide.
// Pure data, no browser APIs, so Node scripts and tests can import it.
//
// Privacy rule: values are enums, booleans, bucketed counts or short codes. Never add a
// free-text, name, email, amount or id parameter here.

const bucketValues = ['0', '1', '2-5', '6-20', '21-100', '100+'];

/** Parameter definitions. type: enum | bool | int | pattern */
export const PARAMS = {
  method:         { type: 'enum', values: ['password', 'oauth'], label: 'Sign-in method' },
  tx_type:        { type: 'enum', values: ['income', 'expense', 'transfer'], label: 'Transaction type' },
  tx_source:      { type: 'enum', values: ['manual', 'import', 'scan'], label: 'How the transaction was created' },
  account_type:   { type: 'enum', values: ['bank', 'cash', 'card', 'loan', 'investment', 'wallet', 'other'], label: 'Account type' },
  budget_type:    { type: 'enum', values: ['expense', 'income'], label: 'Budget type' },
  frequency:      { type: 'enum', values: ['daily', 'weekly', 'monthly', 'yearly'], label: 'Recurring frequency' },
  debt_type:      { type: 'enum', values: ['card', 'loan', 'other'], label: 'Debt type' },
  has_rate:       { type: 'bool', label: 'Debt has an interest rate set' },
  payoff_method:  { type: 'enum', values: ['avalanche', 'snowball'], label: 'Payoff strategy' },
  extra_bucket:   { type: 'enum', values: ['0', '1k', '2k', '5k', '10k+'], label: 'Extra payment bucket' },
  forecast_days:  { type: 'int', max: 365, label: 'Forecast horizon (days)' },
  banner_state:   { type: 'enum', values: ['warning', 'ok'], label: 'Cash-flow banner state' },
  ui_tab:         { type: 'enum', values: ['overview', 'spending', 'trends', 'subs', 'tips', 'analytics', 'smart', 'payoff'], label: 'Tab viewed' },
  count_bucket:   { type: 'enum', values: bucketValues, label: 'Count (bucketed)' },
  success:        { type: 'bool', label: 'Operation succeeded' },
  theme:          { type: 'enum', values: ['light', 'dark'], label: 'Theme chosen' },
  currency:       { type: 'pattern', pattern: /^[A-Z]{3}$/, label: 'Currency code' },
  language:       { type: 'pattern', pattern: /^[a-z]{2}(-[A-Za-z]{2,4})?$/, label: 'Language code' },
  scope:          { type: 'enum', values: ['transactions', 'budgets', 'goals', 'all'], label: 'Data reset scope' },
  analytics_enabled: { type: 'bool', label: 'Usage analytics switched on' },
  error_area:     { type: 'pattern', pattern: /^[a-z][a-z-]{0,23}$/, label: 'API area (first path segment)' },
  error_status:   { type: 'int', max: 599, label: 'HTTP status of the failed call' },
  // page_view only. Paths are normalised in analytics.js (ids and tokens masked, query stripped).
  page_title:     { type: 'pattern', pattern: /^[A-Za-z0-9 &/-]{1,40}$/, label: 'Page name' },
  page_location:  { type: 'pattern', pattern: /^https?:\/\/[A-Za-z0-9.:-]+\/[a-z0-9/:_?=-]*$/, label: 'Normalised page URL' },
};

/** Properties describing the user, never the person. */
export const USER_PROPS = {
  user_id:       { type: 'pattern', pattern: /^[0-9a-f]{64}$/, label: 'Pseudonymous user id (SHA-256)' },
  user_currency: { type: 'pattern', pattern: /^[A-Z]{3}$/, label: 'Preferred currency' },
  user_language: { type: 'pattern', pattern: /^[a-z]{2}(-[A-Za-z]{2,4})?$/, label: 'Preferred language' },
  platform:      { type: 'enum', values: ['web', 'android'], label: 'Platform' },
  ui_theme:      { type: 'enum', values: ['light', 'dark'], label: 'Current theme' },
};

/**
 * Events. `params` lists allowed parameters; `key: true` marks a GA4 key event (conversion).
 * `ga4Name` renames the event on the way to GA4 (page views use the standard `page_view`).
 */
export const EVENTS = {
  // Page views (pushed by <PageViewTracker/>, sent to GA4 as page_view)
  virtual_page_view: { area: 'Navigation', ga4Name: 'page_view', params: ['page_location', 'page_title'], desc: 'Every route change, with ids/tokens/query stripped' },

  // Acquisition
  sign_up:  { area: 'Acquisition', key: true, params: ['method'], desc: 'New account created' },
  login:    { area: 'Acquisition', params: ['method'], desc: 'Signed in' },
  logout:   { area: 'Acquisition', params: [], desc: 'Signed out' },

  // Navigation and discovery
  search_used:               { area: 'Navigation', params: [], desc: 'Used the global search (the query is never sent)' },
  forecast_banner_clicked:   { area: 'Forecast', params: ['banner_state'], desc: 'Clicked the Dashboard cash-flow strip' },
  forecast_range_changed:    { area: 'Forecast', params: ['forecast_days'], desc: 'Changed the forecast horizon' },
  insights_tab_viewed:       { area: 'Insights', params: ['ui_tab'], desc: 'Opened a tab inside Insights' },

  // Activation
  account_created:    { area: 'Activation', key: true, params: ['account_type'], desc: 'Added a bank/cash/card/wallet account' },
  transaction_added:  { area: 'Activation', key: true, params: ['tx_type', 'tx_source'], desc: 'Recorded an income, expense or transfer' },
  budget_created:     { area: 'Activation', key: true, params: ['budget_type'], desc: 'Created a budget' },
  goal_created:       { area: 'Activation', key: true, params: [], desc: 'Created a savings goal' },

  // Transactions
  transaction_edited:           { area: 'Transactions', params: ['tx_type'], desc: 'Edited a transaction' },
  transaction_deleted:          { area: 'Transactions', params: [], desc: 'Deleted a transaction' },
  transaction_category_changed: { area: 'Transactions', params: [], desc: 'Changed a transaction category inline' },
  transactions_exported:        { area: 'Transactions', params: [], desc: 'Exported transactions to CSV' },

  // Planning
  budget_updated:   { area: 'Planning', params: ['budget_type'], desc: 'Edited a budget' },
  goal_funded:      { area: 'Planning', params: [], desc: 'Added money to a goal' },
  goal_deleted:     { area: 'Planning', params: [], desc: 'Deleted a goal' },
  recurring_created:{ area: 'Planning', params: ['tx_type', 'frequency'], desc: 'Created a recurring rule' },
  recurring_run:    { area: 'Planning', params: ['count_bucket'], desc: 'Ran recurring rules now' },
  recurring_deleted:{ area: 'Planning', params: [], desc: 'Deleted a recurring rule' },

  // Debt
  debt_added:             { area: 'Debt', params: ['debt_type', 'has_rate'], desc: 'Added a debt' },
  account_payment_made:   { area: 'Debt', params: ['account_type'], desc: 'Recorded a card/loan payment' },
  payoff_method_selected: { area: 'Debt', params: ['payoff_method'], desc: 'Chose avalanche or snowball' },
  payoff_extra_set:       { area: 'Debt', params: ['extra_bucket'], desc: 'Tried an extra monthly payment in the planner' },

  // Import
  import_previewed:  { area: 'Import', params: [], desc: 'Previewed a statement import' },
  import_completed:  { area: 'Import', key: true, params: ['count_bucket'], desc: 'Imported a statement' },
  receipt_scanned:   { area: 'Import', params: ['success'], desc: 'Scanned a receipt or payment screenshot' },

  // Other features
  category_created:  { area: 'Features', params: [], desc: 'Created a category' },
  category_deleted:  { area: 'Features', params: [], desc: 'Deleted a category' },
  family_created:    { area: 'Features', params: [], desc: 'Created a family' },
  family_joined:     { area: 'Features', params: [], desc: 'Joined a family' },
  family_left:       { area: 'Features', params: [], desc: 'Left a family' },

  // Settings
  theme_changed:                 { area: 'Settings', params: ['theme'], desc: 'Switched light/dark' },
  currency_changed:              { area: 'Settings', params: ['currency'], desc: 'Changed currency' },
  language_changed:              { area: 'Settings', params: ['language'], desc: 'Changed language' },
  data_exported:                 { area: 'Settings', params: [], desc: 'Downloaded a data backup' },
  sample_data_loaded:            { area: 'Settings', params: [], desc: 'Loaded demo data' },
  sample_data_removed:           { area: 'Settings', params: [], desc: 'Removed demo data' },
  data_reset:                    { area: 'Settings', params: ['scope'], desc: 'Reset data' },
  profile_updated:               { area: 'Settings', params: [], desc: 'Edited profile' },
  password_changed:              { area: 'Settings', params: [], desc: 'Changed password' },
  notification_prefs_updated:    { area: 'Settings', params: [], desc: 'Changed notification preferences' },
  analytics_opt_out_changed:     { area: 'Settings', params: ['analytics_enabled'], desc: 'Toggled usage analytics' },

  // Reliability
  api_error: { area: 'Reliability', params: ['error_area', 'error_status'], desc: 'An API call failed (area and status only)' },
};

/** Names that must never appear as a parameter key, as a belt-and-braces check in tests. */
export const FORBIDDEN_PARAM_NAMES = [
  'email', 'name', 'first_name', 'last_name', 'phone', 'password', 'token', 'amount', 'balance',
  'description', 'merchant', 'payment_name', 'search_term', 'query', 'note', 'address',
];
