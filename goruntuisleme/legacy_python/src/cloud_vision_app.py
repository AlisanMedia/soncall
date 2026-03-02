import cv2
import os
import base64
import time
import threading
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from openai import OpenAI
from dotenv import load_dotenv

# Load API Key
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    print("HATA: .env dosyasında OPENAI_API_KEY bulunamadı!")
    exit()

client = OpenAI(api_key=api_key)

# Global State for Threading
current_analysis = "Sistem Hazir. Bekleniyor."
is_analyzing = False

def encode_image(image):
    _, buffer = cv2.imencode('.jpg', image)
    return base64.b64encode(buffer).decode('utf-8')

def put_text_utf8(img, text, position, color=(0, 255, 0), font_size=20):
    """Draws text with Turkish character support using PIL"""
    img_pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(img_pil)
    
    # Try to load a font, fallback to default if necessary
    try:
        # Windows usually has arial.ttf
        font = ImageFont.truetype("arial.ttf", font_size)
    except IOError:
        font = ImageFont.load_default()

    draw.text(position, text, font=font, fill=color)
    return cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)

def thread_analyze(frame):
    """Runs OpenAI analysis in a separate thread"""
    global current_analysis, is_analyzing
    is_analyzing = True
    current_analysis = "AI Dusunuyor..."
    
    try:
        base64_img = encode_image(frame)
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": """
                    SEN BİR 'YEM KARMA MAKİNESİ GÖRÜNTÜ ANALİZ SİSTEMİ'SİN.
                    GÖREVİN: Depoya yüklenen hammaddenin tarımsal niteliğini doğrulamak.
                    
                    KURALLAR:
                    1. SADECE YEM VE TAHIL ANALİZİ YAP (Mısır, Silaj, Yonca, Arpa, Buğday, Küspe, Saman vb.).
                    2. EĞER GÖRÜNTÜDE YEM YOKSA (İnsan, Araba, Kedi, Telefon vb.):
                       - Cevabın SADECE şu olmalı: "⚠️ YABANCI CISIM / YEM DEGIL"
                    3. Yem ise şunları raporla (TÜRKÇE KARAKTER KULLANABİLİRSİN):
                       - ÜRÜN: (Örn: Mısır Silajı)
                       - FORM: (Örn: İnce Kıyım / Dane / Ezme)
                       - KALİTE: (Görsel olarak küf, bozulma veya nem durumu)
                    
                    ÇIKIŞ FORMATI ÖRNEK:
                    "MISIR SILAJI (Ince Kiyim) - Temiz Gorunuyor, Nem Orani Iyi."
                    """
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Bu nedir?"},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_img}"
                            },
                        },
                    ],
                }
            ],
            max_tokens=60
        )
        current_analysis = response.choices[0].message.content
    except Exception as e:
        current_analysis = f"Hata: {e}"
    finally:
        is_analyzing = False

def main():
    cap = cv2.VideoCapture(0)
    # Set resolution for better speed/quality tradeoff
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    
    print("=== CIFTCI AI (GPT-4o) - HIZLI MOD ===")
    
    live_mode = False
    last_time = time.time()
    
    while True:
        ret, frame = cap.read()
        if not ret: break

        current_time = time.time()

        # UI Overlay (Top)
        # We use a black rectangle for bg, then PIL for text
        cv2.rectangle(frame, (0, 0), (1280, 50), (0, 0, 0), -1)
        
        mode_str = "CANLI MOD (AKTIF)" if live_mode else "MANUEL MOD (SPACE'e Bas)"
        color = (255, 50, 50) if live_mode else (200, 200, 200) # Blue-ish for live
        
        frame = put_text_utf8(frame, f"DURUM: {mode_str} | [L] Mod Degistir | [Q] Cikis", (20, 10), color, 24)
        
        # Result Bar (Bottom)
        cv2.rectangle(frame, (0, 650), (1280, 720), (0, 0, 0), -1)
        
        # Color based on status
        status_color = (0, 255, 255) if is_analyzing else (0, 255, 0)
        frame = put_text_utf8(frame, current_analysis, (20, 670), status_color, 22)

        # Show Status Indicator (Circle)
        if is_analyzing:
            cv2.circle(frame, (1240, 30), 15, (0, 255, 255), -1) # Yellow working
        elif live_mode:
            cv2.circle(frame, (1240, 30), 15, (0, 255, 0), -1) # Green active

        cv2.imshow('Ciftlik Yem Analiz AI', frame)
        
        key = cv2.waitKey(1) & 0xFF
        
        # LIVE MODE LOGIC (Every 3 seconds, non-blocking)
        if live_mode and (current_time - last_time > 3.0) and not is_analyzing:
            threading.Thread(target=thread_analyze, args=(frame.copy(),)).start()
            last_time = current_time
        
        # KEYBOARD CONTROLS
        if key == ord('q'):
            break
        elif key == ord('l'):
            live_mode = not live_mode
        elif key == ord(' ') and not live_mode and not is_analyzing:
            threading.Thread(target=thread_analyze, args=(frame.copy(),)).start()

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
