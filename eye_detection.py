import cv2
import time
import numpy as np
import mediapipe as mp
import pygame
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

EAR_THRESHOLD = 0.21
CLOSED_SECONDS_TO_ALERT = 2.5
MODEL_PATH = "face_landmarker.task"
ALARM_SOUND_PATH = "wake_up.mp3"

LEFT_EYE = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33, 160, 158, 133, 153, 144]

pygame.mixer.init()
pygame.mixer.music.load(ALARM_SOUND_PATH)

base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
options = vision.FaceLandmarkerOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.VIDEO,
    num_faces=1
)
landmarker = vision.FaceLandmarker.create_from_options(options)

def eye_aspect_ratio(landmarks, eye_points, w, h):
    coords = [(landmarks[i].x * w, landmarks[i].y * h) for i in eye_points]
    p1, p2, p3, p4, p5, p6 = coords

    vertical1 = np.linalg.norm(np.array(p2) - np.array(p6))
    vertical2 = np.linalg.norm(np.array(p3) - np.array(p5))
    horizontal = np.linalg.norm(np.array(p1) - np.array(p4))

    ear = (vertical1 + vertical2) / (2.0 * horizontal)
    return ear

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    raise RuntimeError("Could not open webcam. Check your camera connection/permissions.")

eyes_closed_since = None
frame_timestamp_ms = 0
alarm_playing = False

print("Starting webcam... press 'q' in the video window to quit.")

while cap.isOpened():
    success, frame = cap.read()
    if not success:
        print("Failed to grab frame from webcam.")
        break

    frame = cv2.flip(frame, 1)
    h, w = frame.shape[:2]
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

    frame_timestamp_ms += 33
    result = landmarker.detect_for_video(mp_image, frame_timestamp_ms)

    status_text = "No face detected"
    status_color = (0, 165, 255)

    if result.face_landmarks:
        landmarks = result.face_landmarks[0]

        left_ear = eye_aspect_ratio(landmarks, LEFT_EYE, w, h)
        right_ear = eye_aspect_ratio(landmarks, RIGHT_EYE, w, h)
        avg_ear = (left_ear + right_ear) / 2.0

        for idx in LEFT_EYE + RIGHT_EYE:
            px = int(landmarks[idx].x * w)
            py = int(landmarks[idx].y * h)
            cv2.circle(frame, (px, py), 2, (0, 255, 0), -1)

        if avg_ear < EAR_THRESHOLD:
            if eyes_closed_since is None:
                eyes_closed_since = time.time()
            elapsed = time.time() - eyes_closed_since

            if elapsed >= CLOSED_SECONDS_TO_ALERT:
                status_text = "EYES CLOSED - WAKE UP!"
                status_color = (0, 0, 255)

                if not alarm_playing:
                    pygame.mixer.music.play(loops=-1)
                    alarm_playing = True
            else:
                status_text = f"Eyes closing... ({elapsed:.1f}s)"
                status_color = (0, 255, 255)
        else:
            eyes_closed_since = None
            status_text = f"Eyes Open (EAR: {avg_ear:.2f})"
            status_color = (0, 255, 0)

            if alarm_playing:
                pygame.mixer.music.stop()
                alarm_playing = False

    cv2.putText(frame, status_text, (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, status_color, 2)

    cv2.imshow("Eye Detection Test (MediaPipe EAR)", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

pygame.mixer.music.stop()
cap.release()
cv2.destroyAllWindows()