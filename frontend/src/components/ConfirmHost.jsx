import { useEffect, useState } from 'react';
import { registerConfirmHost } from '../lib/confirm';
import Sheet from './ui/Sheet';
import Button from './ui/Button';

export default function ConfirmHost() {
  const [req, setReq] = useState(null);
  useEffect(() => registerConfirmHost(setReq), []);
  const done = (v) => { req?.resolve(v); setReq(null); };
  return (
    <Sheet open={!!req} onClose={() => done(false)} title="Please confirm"
      footer={req && <>
        <Button onClick={() => done(false)}>Cancel</Button>
        <Button variant={req.danger ? 'danger' : 'primary'} onClick={() => done(true)}>{req.confirmLabel}</Button>
      </>}>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{req?.message}</p>
    </Sheet>
  );
}
