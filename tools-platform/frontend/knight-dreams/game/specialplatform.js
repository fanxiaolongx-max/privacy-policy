import { Vector } from "../common/vector.js";
import { ExistingObject } from "./existingobject.js";
;
export class SpecialPlatform extends ExistingObject {
    constructor() {
        super();
        this.width = 0;
        this.type = 0 /* SpecialPlatformType.Mushroom */;
        this.pos = new Vector();
    }
    spawn(x, y, width, type) {
        this.pos.x = x;
        this.pos.y = y;
        this.width = width;
        this.type = type;
        this.exist = true;
    }
    update(globalSpeed, event) {
        if (!this.exist)
            return;
        if ((this.pos.x -= globalSpeed * event.tick) <= -this.width * 8) {
            this.exist = false;
        }
    }
    draw(canvas, bmp) {
        if (!this.exist)
            return;
        const dx = Math.round(this.pos.x);
        const dy = canvas.height - this.pos.y;
        // const mushroomHeight = ((canvas.height - dy) / 16) | 0;
        let sx;
        switch (this.type) {
            // Mushroom
            case 0 /* SpecialPlatformType.Mushroom */:
                // Hat
                for (let j = 0; j < this.width; ++j) {
                    sx = 128;
                    if (j == 0)
                        sx -= 16;
                    else if (j == this.width - 1)
                        sx += 16;
                    canvas.drawBitmap(bmp, dx - this.width * 8 + j * 16, dy, sx, 0, 16, 16);
                }
                // Ring
                canvas.drawBitmap(bmp, dx - 12, dy + 16, 124, 16, 24, 16);
                // Leg
                for (let y = 2; y < (((canvas.height - dy) / 16) | 0); ++y) {
                    canvas.drawBitmap(bmp, dx - 8, dy + y * 16, 128, 32, 16, 16);
                }
                break;
            // Floating platform
            case 1 /* SpecialPlatformType.FloatingPlatform */:
                // Soil edges
                canvas.drawBitmap(bmp, dx - this.width * 8 - 16, dy, 0, 32, 16, 16);
                canvas.drawBitmap(bmp, dx + this.width * 8, dy, 64, 32, 16, 16);
                if (this.width == 1) {
                    canvas.drawBitmap(bmp, dx - 8, dy, 80, 32, 16, 16);
                    break;
                }
                for (let j = 0; j < this.width; ++j) {
                    sx = 32;
                    if (j == 0)
                        sx -= 16;
                    else if (j == this.width - 1)
                        sx += 16;
                    canvas.drawBitmap(bmp, dx - this.width * 8 + j * 16, dy, sx, 32, 16, 16);
                }
                break;
            default:
                break;
        }
    }
    objectCollision(o, globalSpeed, event) {
        if (!this.exist)
            return;
        const y = event.screenHeight - this.pos.y;
        o.floorCollision(this.pos.x - this.width * 8, y, this.pos.x + this.width * 8, y, globalSpeed, event);
    }
}
