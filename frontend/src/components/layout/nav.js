// One source for navigation: the desktop sidebar, the mobile "More" sheet, the command palette and the
// mobile header title all read this, so a new screen is added in one place.
import {
  House, ArrowsLeftRight, Wallet, Target, ChartPie, Users,
  CreditCard, ArrowsClockwise, UploadSimple, ChartLineUp, TrendUp,
} from '@phosphor-icons/react';
import { FEATURES } from '../../config/features';

export const NAV_GROUPS = [
  { label: null, items: [
    { path: '/',             tKey: 'nav_dashboard',    label: 'Dashboard',    Icon: House           },
  ] },
  { label: 'Money', items: [
    { path: '/transactions', tKey: 'nav_transactions', label: 'Transactions', Icon: ArrowsLeftRight },
    { path: '/wallet',       tKey: 'nav_accounts',     label: 'Accounts',     Icon: Wallet          },
    { path: '/recurring',    tKey: 'nav_recurring',    label: 'Recurring',    Icon: ArrowsClockwise },
    { path: '/import',       tKey: 'nav_import',       label: 'Import',       Icon: UploadSimple, soon: !FEATURES.import },
  ] },
  { label: 'Plan & analyze', items: [
    { path: '/budget',       tKey: 'nav_budget',       label: 'Budget',       Icon: ChartPie        },
    { path: '/goals',        tKey: 'nav_goals',        label: 'Goals',        Icon: Target          },
    { path: '/debts',        tKey: 'nav_debts',        label: 'Debts',        Icon: CreditCard      },
    { path: '/forecast',                                label: 'Forecast',     Icon: ChartLineUp     },
    { path: '/insights',                                label: 'Insights',     Icon: TrendUp         },
  ] },
  { label: 'Household', items: [
    { path: '/family',                                  label: 'Family',       Icon: Users, soon: !FEATURES.family },
  ] },
];

export const ALL_PAGES = [
  ...NAV_GROUPS.flatMap(g => g.items),
  { path: '/categories', label: 'Categories', Icon: ChartPie },
];

/** Title for the mobile header, from the current path. */
export function pageTitle(pathname) {
  if (pathname === '/settings') return 'Settings';
  const hit = ALL_PAGES.filter(p => p.path !== '/').find(p => pathname.startsWith(p.path));
  return hit?.label || 'Tracksy';
}
