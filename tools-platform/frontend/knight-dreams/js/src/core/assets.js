export class AssetManager {
    // private emptyImage : Bitmap;
    constructor() {
        this.loaded = 0;
        this.totalAssets = 0;
        this.getBitmap = (name) => this.bitmaps.get(name); // ?? this.emptyImage;
        this.getSample = (name) => this.samples.get(name);
        this.hasLoaded = () => this.loaded >= this.totalAssets;
        this.bitmaps = new Map();
        this.samples = new Map();
        // Faster than dealing with undefined
        // this.emptyImage = new Image(1, 1);
    }
    addBitmap(name, bmp) {
        this.bitmaps.set(name, bmp);
    }
    loadBitmap(name, path) {
        const img = new Image();
        img.onload = () => {
            this.addBitmap(name, img);
            ++this.loaded;
        };
        img.src = path;
        ++this.totalAssets;
    }
    addSample(name, sample) {
        this.samples.set(name, sample);
    }
}
