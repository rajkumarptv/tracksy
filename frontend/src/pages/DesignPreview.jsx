import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Card, CardHeader, Stat, Field, Input, Select, Sheet, Table, Tabs, Badge, SkeletonLines } from '../components/ui';

const ROWS = [
  { id: 1, date: '12 Nov', desc: 'Salary', category: 'Income', amount: '+₹65,000' },
  { id: 2, date: '11 Nov', desc: 'Swiggy', category: 'Food', amount: '−₹480' },
  { id: 3, date: '10 Nov', desc: 'Electricity bill', category: 'Utilities', amount: '−₹2,140' },
];

/** Dev-only gallery of the design-system primitives at /design. Not shipped in production builds. */
export default function DesignPreview() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('overview');
  const [acct, setAcct] = useState('');
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px 80px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Design system</h1>

      <Card><div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <Button variant="primary" icon={<Plus size={16} />}>Primary</Button>
        <Button>Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Delete</Button>
        <Button variant="primary" loading>Saving</Button><Button size="sm">Small</Button><Button variant="primary" size="lg">Large</Button>
      </div></Card>

      <Card padded={false}>
        <CardHeader title="Cash flow" subtitle="This month" action={<Badge tone="success">On track</Badge>} />
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 20 }}>
          <Stat label="Balance" value="₹3,55,250" delta="+₹18,113 this month" deltaTone="up" />
          <Stat label="Spent" value="₹47,200" delta="−₹3,100 vs last month" deltaTone="up" />
          <Stat label="Debt" value="₹1,20,000" />
        </div>
      </Card>

      <Card padded={false}>
        <div style={{ padding: '0 12px' }}><Tabs tabs={[{ key: 'overview', label: 'Overview' }, { key: 'spending', label: 'Spending' }, { key: 'trends', label: 'Trends' }, { key: 'tips', label: 'Tips' }]} value={tab} onChange={setTab} /></div>
        <Table rows={ROWS} columns={[
          { key: 'desc', header: 'Description', primary: true },
          { key: 'date', header: 'Date' },
          { key: 'category', header: 'Category', render: r => <Badge>{r.category}</Badge> },
          { key: 'amount', header: 'Amount', align: 'right' },
        ]} />
      </Card>

      <Card>
        <Field label="Amount" hint="Enter the full amount"><Input inputMode="decimal" placeholder="0.00" /></Field>
        <Field label="Name" error="Name is required"><Input defaultValue="" /></Field>
        <Field label="Account"><Select value={acct} onChange={setAcct} placeholder="Choose account" options={[{ value: 'a', label: 'HDFC Savings' }, { value: 'b', label: 'Cash wallet' }]} /></Field>
      </Card>

      <Card><SkeletonLines lines={4} /></Card>

      <Button variant="primary" onClick={() => setOpen(true)}>Open sheet</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Add goal"
        footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => setOpen(false)}>Save</Button></>}>
        <Field label="Goal name"><Input placeholder="Emergency fund" /></Field>
        <Field label="Target amount"><Input inputMode="decimal" placeholder="100000" /></Field>
      </Sheet>
    </div>
  );
}
