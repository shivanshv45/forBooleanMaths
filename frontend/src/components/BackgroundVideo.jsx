import { useEffect, useRef } from 'react';

// slowed down and sat behind everything, so it reads as texture rather than motion
export default function BackgroundVideo({ playbackRate = 0.55 }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  return (
    <video ref={videoRef} className="bg-video" autoPlay loop muted playsInline>
      <source src="/video/slate.webm" type="video/webm" />
      <source src="/video/slate.mp4" type="video/mp4" />
    </video>
  );
}
