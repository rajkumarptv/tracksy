import './primitives.css';

export default function Skeleton({ width = '100%', height = 16, radius, style }) {
  return <span className="ds-skel" aria-hidden="true" style={{ width, height, borderRadius: radius, ...style }} />;
}

/** A few stacked lines, for list and card loading states. */
export function SkeletonLines({ lines = 3, gap = 10 }) {
  return (
    <div role="status" aria-label="Loading" style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} />)}
    </div>
  );
}
