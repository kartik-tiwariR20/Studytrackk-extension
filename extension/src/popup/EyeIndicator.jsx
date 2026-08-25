import React from 'react';

// state: 'off' | 'watching' | 'alert'
export default function EyeIndicator({ state }) {
  return (
    <div className={`eye-ring eye-ring--${state}`}>
      <svg
        viewBox="0 0 120 120"
        width="96"
        height="96"
        className={`eye-svg eye-svg--${state}`}
        role="img"
        aria-label={
          state === 'alert'
            ? 'Drowsiness detected'
            : state === 'watching'
            ? 'Monitoring is on'
            : 'Monitoring is off'
        }
      >
        <circle cx="60" cy="60" r="56" className="eye-ring-track" />
        <circle cx="60" cy="60" r="56" className="eye-ring-progress" />
        <g className="eye-shape">
          <path
            className="eye-lid"
            d="M18 60 C 32 34, 88 34, 102 60 C 88 86, 32 86, 18 60 Z"
          />
          <circle cx="60" cy="60" r="14" className="eye-pupil" />
        </g>
      </svg>
    </div>
  );
}
