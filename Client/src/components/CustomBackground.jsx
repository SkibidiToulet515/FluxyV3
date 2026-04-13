import { useState } from 'react';
import './CustomBackground.css';

export default function CustomBackground({ url, type }) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) return null;

  if (type === 'video') {
    return (
      <video
        className="custom-bg-media custom-bg-video"
        src={url}
        autoPlay
        loop
        muted
        playsInline
        preload="none"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <img
      className="custom-bg-media custom-bg-image"
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
