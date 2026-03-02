import os
import shutil
import random
from pathlib import Path

# Config
RAW_DATA_DIR = Path("../data/raw")
DATASET_DIR = Path("../dataset")
TRAIN_IMG_DIR = DATASET_DIR / "train" / "images"
VAL_IMG_DIR = DATASET_DIR / "val" / "images"

# YOLO Classification Format: 
# Ultralytics YOLOv8 for classification expects data in:
# root/train/class1/img1.jpg
# root/val/class1/img1.jpg
# BUT here user asked for object detection style feedback ("show on screen").
# Since we don't have bounding box annotations yet, we will use CLASSIFICATION mode first.
# This is much easier for the user: just put images in folders.

# However, the user wants "detection" eventually. 
# For now, let's stick to Classification as it's the only feasible unsupervised way.
# If we want Detection (bounding boxes), user needs to label with LabelImg.

# STRATEGY CHANGE: We will use YOLOv8-CLS (Classification) model.
# It tells "What is in the image" (e.g. "Silaj %99").
# This doesn't need bounding boxes, just folders.

def prepare_classification_dataset():
    # Clear existing dataset
    if DATASET_DIR.exists():
        shutil.rmtree(DATASET_DIR)
    
    # Create structure: dataset/train/class_name/xxx.jpg
    for split in ['train', 'val']:
        for class_dir in RAW_DATA_DIR.iterdir():
            if class_dir.is_dir():
                (DATASET_DIR / split / class_dir.name).mkdir(parents=True, exist_ok=True)

    # Split and Copy
    for class_dir in RAW_DATA_DIR.iterdir():
        if not class_dir.is_dir(): continue
        
        images = list(class_dir.glob("*.jpg"))
        random.shuffle(images)
        
        split_idx = int(len(images) * 0.8) # 80% train
        train_imgs = images[:split_idx]
        val_imgs = images[split_idx:]
        
        print(f"Processing {class_dir.name}: {len(train_imgs)} train, {len(val_imgs)} val")
        
        for img in train_imgs:
            shutil.copy2(img, DATASET_DIR / "train" / class_dir.name / img.name)
            
        for img in val_imgs:
            shutil.copy2(img, DATASET_DIR / "val" / class_dir.name / img.name)

    print("Dataset preparation complete!")

if __name__ == "__main__":
    prepare_classification_dataset()
