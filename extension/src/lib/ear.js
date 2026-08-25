// ear.js — Eye Aspect Ratio calculation, ported from the original
// eye_detection.py prototype (MediaPipe FaceLandmarker landmark indices).

// MediaPipe Face Mesh landmark indices for each eye, ordered
// [left_corner, top_1, top_2, right_corner, bottom_2, bottom_1]
export const LEFT_EYE = [33, 160, 158, 133, 153, 144];
export const RIGHT_EYE = [362, 385, 387, 263, 373, 380];

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// landmarks: array of {x, y, z} normalized MediaPipe landmarks for one face.
export function eyeAspectRatio(landmarks, eyeIndices) {
  const [p1, p2, p3, p4, p5, p6] = eyeIndices.map((i) => landmarks[i]);
  const vertical1 = dist(p2, p6);
  const vertical2 = dist(p3, p5);
  const horizontal = dist(p1, p4);
  if (horizontal === 0) return 0;
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

export function averageEar(landmarks) {
  const left = eyeAspectRatio(landmarks, LEFT_EYE);
  const right = eyeAspectRatio(landmarks, RIGHT_EYE);
  return (left + right) / 2;
}
