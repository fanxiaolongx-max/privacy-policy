import { Vector } from "../common/vector.js";
const createCanvasElement = (width, height) => {
    const styleArg = "position: absolute; top: 0; left: 0; z-index: -1;";
    let div;
    let canvas;
    canvas = document.createElement("canvas");
    canvas.setAttribute("style", styleArg);
    canvas.setAttribute("style", styleArg +
        "image-rendering: optimizeSpeed;" +
        "image-rendering: pixelated;" +
        "image-rendering: -moz-crisp-edges;");
    canvas.width = width;
    canvas.height = height;
    div = document.createElement("div");
    div.setAttribute("style", styleArg);
    div.appendChild(canvas);
    document.body.appendChild(div);
    return [
        canvas,
        canvas.getContext("2d")
    ];
};
;
;
export class Canvas {
    constructor(width, height) {
        this.activeColor = "#ffffff";
        this.width = width;
        this.height = height;
        [this.canvas, this.ctx] = createCanvasElement(width, height);
        this.ctx.imageSmoothingEnabled = false;
        this.translation = new Vector();
        window.addEventListener("resize", () => {
            this.resize(window.innerWidth, window.innerHeight);
        });
        this.resize(window.innerWidth, window.innerHeight);
    }
    resize(width, height) {
        let m = Math.min(width / this.width, height / this.height);
        if (m > 1.0)
            m |= 0;
        this.canvas.style.width = String((m * this.width) | 0) + "px";
        this.canvas.style.height = String((m * this.height) | 0) + "px";
        this.canvas.style.left = String((width / 2 - m * this.width / 2) | 0) + "px";
        this.canvas.style.top = String((height / 2 - m * this.height / 2) | 0) + "px";
    }
    clear(colorStr) {
        const c = this.ctx;
        c.fillStyle = colorStr;
        c.fillRect(0, 0, this.width, this.height);
        c.fillStyle = this.activeColor;
    }
    fillColor(colorStr) {
        this.ctx.fillStyle = (this.activeColor = colorStr);
    }
    fillRect(x = 0, y = 0, w = this.width, h = this.height) {
        const c = this.ctx;
        c.fillRect((x + this.translation.x) | 0, (y + this.translation.y) | 0, w | 0, h | 0);
    }
    fillCircle(cx, cy, radius) {
        const c = this.ctx;
        let r;
        let ny;
        cx += this.translation.x;
        cy += this.translation.y;
        cx |= 0;
        cy |= 0;
        for (let y = -radius; y <= radius; ++y) {
            ny = y / radius;
            if ((r = Math.round(Math.sqrt(1 - ny * ny) * radius)) <= 0)
                continue;
            c.fillRect(cx - r, cy + y, r * 2, 1);
        }
    }
    fillRing(cx, cy, innerRadius, outerRadius) {
        const c = this.ctx;
        let r1;
        let r2;
        let ny1;
        let ny2;
        innerRadius |= 0;
        outerRadius |= 0;
        if (innerRadius >= outerRadius)
            return;
        cx += this.translation.x;
        cy += this.translation.y;
        cx |= 0;
        cy |= 0;
        for (let y = -outerRadius; y <= outerRadius; ++y) {
            ny1 = y / outerRadius;
            if ((r1 = Math.round(Math.sqrt(1 - ny1 * ny1) * outerRadius)) <= 0)
                continue;
            r2 = 0;
            if (Math.abs(y) < innerRadius) {
                ny2 = y / innerRadius;
                r2 = Math.round(Math.sqrt(1 - ny2 * ny2) * innerRadius);
            }
            if (r2 <= 0) {
                c.fillRect(cx - r1, cy + y, r1 * 2, 1);
            }
            else {
                // Left-most part
                c.fillRect(cx - r1, cy + y, r1 - r2, 1);
                // Right-most part
                c.fillRect(cx + r2, cy + y, r1 - r2, 1);
            }
        }
    }
    fillCircleOutside(r, cx = this.width / 2, cy = this.height / 2) {
        const c = this.ctx;
        const start = Math.max(0, cy - r) | 0;
        const end = Math.min(this.height, cy + r) | 0;
        if (start > 0)
            c.fillRect(0, 0, this.width, start);
        if (end < this.height)
            c.fillRect(0, end, this.width, this.height - end);
        let dy;
        let px1;
        let px2;
        for (let y = start; y < end; ++y) {
            dy = y - cy;
            if (Math.abs(dy) >= r) {
                c.fillRect(0, y, this.width, 1);
                continue;
            }
            px1 = Math.round(cx - Math.sqrt(r * r - dy * dy));
            px2 = Math.round(cx + Math.sqrt(r * r - dy * dy));
            if (px1 > 0)
                c.fillRect(0, y, px1, 1);
            if (px2 < this.width)
                c.fillRect(px2, y, this.width - px1, 1);
        }
        return this;
    }
    drawBitmap(bmp, dx = 0, dy = 0, sx = 0, sy = 0, sw = bmp.width, sh = bmp.height, flip = 0 /* Flip.None */) {
        const c = this.ctx;
        const saveState = flip != 0 /* Flip.None */;
        dx += this.translation.x;
        dy += this.translation.y;
        sx |= 0;
        sy |= 0;
        sw |= 0;
        sh |= 0;
        dx |= 0;
        dy |= 0;
        if (saveState) {
            c.save();
        }
        if ((flip & 1 /* Flip.Horizontal */) != 0) {
            c.translate(sw, 0);
            c.scale(-1, 1);
            dx *= -1;
        }
        if ((flip & 2 /* Flip.Vertical */) != 0) {
            c.translate(0, sh);
            c.scale(1, -1);
            dy *= -1;
        }
        c.drawImage(bmp, sx, sy, sw, sh, dx, dy, sw, sh);
        if (saveState) {
            c.restore();
        }
    }
    drawVerticallyWavingBitmap(bmp, dx, dy, period, amplitude, shift) {
        const c = this.ctx;
        dx += this.translation.x;
        dy += this.translation.y;
        let y;
        let t;
        for (let x = 0; x < bmp.width; ++x) {
            t = shift + (x / bmp.width) * period;
            y = Math.round(Math.sin(t) * amplitude);
            c.drawImage(bmp, x | 0, 0, 1, bmp.height, (dx + x) | 0, (dy + y) | 0, 1, bmp.height);
        }
    }
    drawText(font, str, dx, dy, xoff = 0.0, yoff = 0.0, align = 0 /* TextAlign.Left */) {
        //  if (font === undefined)
        //    return;
        const cw = (font.width / 16) | 0;
        const ch = cw;
        let x = dx;
        let y = dy;
        let chr;
        if (align == 1 /* TextAlign.Center */) {
            dx -= (str.length * (cw + xoff)) / 2.0;
            x = dx;
        }
        // Unused
        /*
        else if (align == TextAlign.Right) {
            
            dx -= (str.length * (cw + xoff));
            x = dx;
        }
        */
        for (let i = 0; i < str.length; ++i) {
            chr = str.charCodeAt(i);
            if (chr == '\n'.charCodeAt(0)) {
                x = dx;
                y += ch + yoff;
                continue;
            }
            chr -= 32;
            this.drawBitmap(font, x, y, (chr % 16) * cw, ((chr / 16) | 0) * ch, cw, ch);
            x += cw + xoff;
        }
    }
    drawFunkyWaveEffectBitmap(bmp, dx, dy, t, amplitude, latitude, maxOffset) {
        const c = this.ctx;
        const offset = 1 + maxOffset * t;
        // let xoff : number;
        // let yoff : number;
        // dy += bmp.height/2;
        for (let y = 0; y < bmp.height; ++y) {
            // xoff = Math.sin((Math.PI*2*latitude)/bmp.height*y + t*(Math.PI*latitude))*amplitude*t;
            // yoff = (y - bmp.height/2) * offset;
            c.drawImage(bmp, 0, y, bmp.width, 1, (dx + Math.sin((Math.PI * 2 * latitude) / bmp.height * y + t * (Math.PI * latitude)) * amplitude * t) | 0, (dy + y * offset) | 0, bmp.width, 1);
        }
    }
    /*
        public setAlpha(alpha = 1.0) : void {
    
            this.ctx.globalAlpha = alpha;
        }
        */
    moveTo(x = 0, y = 0) {
        this.translation.x = x;
        this.translation.y = y;
    }
    move(x, y) {
        this.translation.x += x;
        this.translation.y += y;
    }
}
