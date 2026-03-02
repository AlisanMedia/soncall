from ultralytics import YOLO

def train():
    # Load a pretrained YOLOv8 classification model
    model = YOLO('yolov8n-cls.pt')  # nano model for speed
    
    # Train the model
    # data argument points to the dataset root directory containing train/ and val/ folders
    print("Starting training...")
    results = model.train(data='../dataset', epochs=20, imgsz=224, project='../models', name='feed_classifier')
    
    print("Training complete!")
    print(f"Best model saved at: {results.save_dir}/weights/best.pt")

if __name__ == "__main__":
    train()
