from icrawler.builtin import BingImageCrawler
import os
import shutil

# Define search terms for better realism (Turkish & English)
# Define search terms for better realism (Turkish & English)
# We search for diverse conditions (texture, pile, close-up)
FEED_SEARCH_TERMS = {
    # Mevcutlar
    'Silaj': ['mısır silajı', 'corn silage pile', 'silage texture close up', 'misir silaji dökülmüş'],
    'Saman': ['balya saman', 'straw bale texture', 'buğday samanı', 'dry hay close up'],
    'Yonca': ['kuru yonca balyası', 'lucerne hay', 'alfalfa hay texture', 'yeşil yonca yemi'],
    'Arpa_Ezmesi': ['arpa ezmesi yem', 'rolled barley feed', 'arpa kırması', 'barley grain texture'],
    'Misir': ['dane mısır yem', 'crack corn feed', 'kurutulmuş mısır', 'whole corn grain'],
    
    # Yeni Eklenenler (Genişletilmiş Paket)
    'Bugday': ['buğday yemi', 'wheat grain feed', 'buğday tanesi', 'durum wheat texture'],
    'Soya_Kuspesi': ['soya küspesi', 'soybean meal feed', 'soya fasulyesi küspesi', 'soybean meal texture'],
    'Pamuk_Tohumu': ['pamuk tohumu yem', 'cotton seed feed', 'pamuk çiğidi', 'whole cotton seed'],
    'Ayciegi_Kuspesi': ['ayçiçeği küspesi', 'sunflower meal feed', 'ayçiçek küspesi', 'sunflower seed meal'],
    'Pancar_Kuspesi': ['şeker pancarı küspesi', 'sugar beet pulp feed', 'kuru pancar küspesi', 'beet pulp shreds'],
    'Kepek': ['buğday kepeği', 'wheat bran feed', 'razmol yem', 'wheat bran texture'],
    'Yulaf': ['yulaf ezmesi yem', 'oats feed horses', 'yulaf tanesi', 'rolled oats feed'],
}

DATA_DIR = os.path.join("..", "data", "raw")

def clean_dirs():
    """Safety clean logic if needed, currently just ensures existence"""
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

def download_images():
    print("=== İNTERNETTEN YEM VERİSİ İNDİRİLİYOR ===")
    
    for feed_name, queries in FEED_SEARCH_TERMS.items():
        save_path = os.path.join(DATA_DIR, feed_name)
        
        if not os.path.exists(save_path):
            os.makedirs(save_path)
            
        # SMART SKIP: If we already have enough images, skip to save time/bandwidth
        existing_count = len([name for name in os.listdir(save_path) if os.path.isfile(os.path.join(save_path, name))])
        if existing_count > 40:
             print(f"---> [{feed_name}] Zaten {existing_count} adet var. Atlanıyor...")
             continue

        print(f"\n---> [{feed_name}] İndiriliyor... (Hedef: 50+ Resim)")
        
        # We use Bing Image Crawler as it is usually more reliable without API keys than Google
        crawler = BingImageCrawler(storage={'root_dir': save_path})
        
        # Search for each term to get variety
        for query in queries:
            print(f"   Arama: '{query}'")
            crawler.crawl(keyword=query, max_num=20, file_idx_offset='auto')
            
    print("\n=== TÜM İNDİRMELER TAMAMLANDI ===")
    print("Lütfen 'data/raw' klasörünü kontrol edin ve hatalı resimleri (logo, reklam vb.) silin.")

if __name__ == "__main__":
    download_images()
