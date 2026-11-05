import { useSearchParams } from 'react-router-dom';
import { Topbar, SubTabs } from '../components/ui';
import { Analytics } from './OtherPages';
import SmartInsights from './SmartInsights';

/* Insights = the numbers (Analytics) + the advice (Smart insights), in one place. */
export default function Insights() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'tips' ? 'tips' : 'analytics';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <Topbar title="Insights" subtitle="Where your money goes — and what to do about it" />
      <SubTabs
        tabs={[{ key: 'analytics', label: 'Analytics' }, { key: 'tips', label: 'Smart insights' }]}
        active={tab}
        onChange={(k) => setParams(k === 'analytics' ? {} : { tab: k }, { replace: true })}
      />
      {tab === 'tips' ? <SmartInsights embedded /> : <Analytics embedded />}
    </div>
  );
}
