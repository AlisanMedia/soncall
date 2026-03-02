import cv2
import os
import time

# Define the feed types (Classes)
FEED_TYPES = {
    '1': 'Silaj',
    '2': 'Saman',
    '3': 'Yonca',
    '4': 'Arpa_Ezmesi',
    '5': 'Misir'
}

DATA_DIR = os.path.join("..", "data", "raw")

def create_dirs():
    """Create directories for each feed type if they don't exist."""
    for feed_id, feed_name in FEED_TYPES.items():
        path = os.path.join(DATA_DIR, feed_name)
        os.makedirs(path, exist_ok=True)
    print(f"Data directories created at {os.path.abspath(DATA_DIR)}")

def main():
    create_dirs()
    
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return

    print("=== Yem Veri Toplama Aracı ===")
    print("Kullanım:")
    for key, name in FEED_TYPES.items():
        print(f"  [{key}] : {name} kaydet")
    print("  [q] : Çıkış")
    print("================================")

    count = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error: Failed to capture image.")
            break

        # Display the resulting frame
        cv2.imshow('Feed Data Collector', frame)

        key = cv2.waitKey(1) & 0xFF

        if key == ord('q'):
            break
        
        # Check if one of the numeric keys for feed types was pressed
        key_char = chr(key)
        if key_char in FEED_TYPES:
            feed_name = FEED_TYPES[key_char]
            
            # SMART CAPTURE: Burst mode to simulate video feed analysis
            # Captures 10 frames rapidly to get different noise patterns
            print(f"[{feed_name}] Akıllı Yakalama Başlatıldı...")
            for i in range(10):
                ret, frame = cap.read()
                if not ret: break
                
                timestamp = int(time.time() * 1000)
                filename = f"{feed_name}_{timestamp}_{i}.jpg"
                filepath = os.path.join(DATA_DIR, feed_name, filename)
                
                # Add text to frame to show it's being recorded (Visual Feedback)
                # We use a copy for display so we save the clean image
                display_frame = frame.copy()
                cv2.putText(display_frame, f"KAYIT: {feed_name} ({i+1}/10)", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                cv2.imshow('Feed Data Collector', display_frame)
                cv2.waitKey(1)
                
                cv2.imwrite(filepath, frame)
                count += 1
                time.sleep(0.05) 
            
            print(f"[{feed_name}] 10 Adet Örnek Kaydedildi. (Toplam: {count})")
            
            print(f"Toplam Resim: {count}")

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
