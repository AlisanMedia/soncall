import cv2
from ultralytics import YOLO
import numpy as np
import time
import csv
import os
from datetime import datetime

# Load the trained model
MODEL_PATH = '../models/best.pt'
LOG_FILE = '../feeding_log.csv'

# Thresholds
CONF_THRESHOLD = 0.6  # Minimum confidence to accept a detection
PERSISTENCE_THRESHOLD = 5  # Number of consecutive frames to confirm a new feed type (Fast response)
COOLDOWN_FRAMES = 30       # Frames to wait before considering a feed "finished" 

def init_logger():
    if not os.path.exists(LOG_FILE):
        with open(LOG_FILE, mode='w', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(["Timestamp", "FeedType", "Event"]) # Header

def log_event(feed_type, event_type):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"LOG: {timestamp} | {feed_type} | {event_type}")
    with open(LOG_FILE, mode='a', newline='') as file:
        writer = csv.writer(file)
        writer.writerow([timestamp, feed_type, event_type])

def main():
    print("AI Model Yukleniyor (Hizli Mod)...")
    try:
        model = YOLO(MODEL_PATH)
    except Exception as e:
        print(f"HATA: Model bulunamadi. {e}")
        return

    init_logger()

    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FPS, 30) # Force high FPS if camera supports it

    print("=== YEM YUKLEME TAKIP SISTEMI BAŞLATILDI ===")
    print("Günlük Dosyası: feeding_log.csv")

    # State Variables
    current_feed = None
    frame_counter = 0
    missing_counter = 0
    active_feed_frames = 0
    
    last_logged_feed = None
    prev_gray = None 

    # Motion Settings
    MOTION_THRESHOLD = 30000  # Lowered significantly (Was 500,000)

    while True:
        ret, frame = cap.read()
        if not ret: break

        # 1. Motion Detection Logic
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)
        
        is_moving = False
        if prev_gray is not None:
            frame_delta = cv2.absdiff(prev_gray, gray)
            thresh = cv2.threshold(frame_delta, 25, 255, cv2.THRESH_BINARY)[1]
            motion_score = np.sum(thresh)
            
            if motion_score > MOTION_THRESHOLD:
                is_moving = True
        
        prev_gray = gray

        # 2. Inference
        results = model(frame, verbose=False)
        probs = results[0].probs
        top1_index = probs.top1
        top1_conf = probs.top1conf.item()
        detected_class = results[0].names[top1_index]

        # Logic: Update State only if Moving AND Confident
        valid_detection = False
        if top1_conf > CONF_THRESHOLD:
            # If motion detected OR confidence is reasonably high (static pile override)
            # Override threshold lowered to 0.60 for testing
            if is_moving or top1_conf > 0.60:
                 valid_detection = True

        if valid_detection:
            if detected_class == current_feed:
                active_feed_frames += 1
                missing_counter = 0
            else:
                if active_feed_frames < PERSISTENCE_THRESHOLD:
                    current_feed = detected_class
                    active_feed_frames = 1
                else:
                    missing_counter += 1
        else:
            missing_counter += 1

        # State Transitions
        status_text = "BEKLEME (Hareket Yok)"
        color = (200, 200, 200)

        # 1. Confirm Feed Start
        if active_feed_frames > PERSISTENCE_THRESHOLD and missing_counter < 10:
            status_text = f"YUKLENIYOR: {current_feed}"
            color = (0, 255, 0) # Green
            
            if current_feed != last_logged_feed:
                log_event(current_feed, "BASLADI")
                last_logged_feed = current_feed

        # 2. Detect Feed Stop
        if missing_counter > COOLDOWN_FRAMES:
            if last_logged_feed is not None:
                log_event(last_logged_feed, "BITTI")
                last_logged_feed = None
            
            current_feed = None
            active_feed_frames = 0

        # UI Overlay
        cv2.rectangle(frame, (0, 0), (800, 80), (0, 0, 0), -1)
        cv2.putText(frame, status_text, (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 3)
        
        # Debug Info (Must show ALWAYS for testing)
        raw_text = f"[DEBUG] Raw: {detected_class} ({int(top1_conf*100)}%) | Motion: {is_moving}"
        cv2.putText(frame, raw_text, (20, 460), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
        
        # Recording Indicator
        if last_logged_feed:
            cv2.circle(frame, (600, 40), 15, (0, 0, 255), -1)
            cv2.putText(frame, "REC", (540, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        cv2.imshow('Yem Karma AI Takip', frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            if last_logged_feed: log_event(last_logged_feed, "BITTI (CIKIS)")
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
