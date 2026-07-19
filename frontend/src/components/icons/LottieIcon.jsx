import Lottie from 'lottie-react';

/**
 * LottieIcon — plays a Lottie JSON animation
 * Props:
 *   animationData  — imported JSON (required)
 *   size           — px (default 80)
 *   loop           — bool (default false)
 *   autoplay       — bool (default true)
 *   style          — extra styles
 */
export default function LottieIcon({ animationData, size = 80, loop = false, autoplay = true, style }) {
  if (!animationData) return null;
  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      autoplay={autoplay}
      style={{ width: size, height: size, ...style }}
    />
  );
}
