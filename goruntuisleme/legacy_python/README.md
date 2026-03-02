# Yem Tanıma Sistemi (Feed Recognition System)

Bu proje, yem karma makineleri için görüntü işleme tabanlı bir yem tanıma sistemi geliştirmeyi amaçlar.

## Kurulum

1.  Gerekli kütüphaneleri yükleyin:
    ```bash
    pip install -r requirements.txt
    ```

## Veri Toplama (Data Collection)

Modeli eğitmek için öncelikle kendi ortamınızdan yem fotoğrafları toplamanız gerekmektedir. Hazırladığımız araç bu işi kolaylaştırır.

1.  Scripti çalıştırın:
    ```bash
    cd src
    python data_collector.py
    ```
2.  Kamera açılacaktır. Yemi kameraya gösterin ve aşağıdaki tuşlara basarak kaydedin:
    -   **'1'**: Silaj
    -   **'2'**: Saman
    -   **'3'**: Yonca
    -   **'4'**: Arpa Ezmesi
    -   **'5'**: Mısır
    -   **'q'**: Çıkış

Resimler otomatik olarak `data/raw/{YemAdi}` klasörüne kaydedilecektir.

## Sonraki Adımlar
Veri toplama işlemi bittikten sonra, bu verileri kullanarak Yapay Zeka modelini eğiteceğiz.
