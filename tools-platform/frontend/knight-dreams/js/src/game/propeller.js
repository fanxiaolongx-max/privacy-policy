export const drawPropeller = (canvas, bmp, frame, dx, dy) => {
    const PROPELLER_FLIP = [0 /* Flip.None */, 0 /* Flip.None */, 0 /* Flip.None */, 1 /* Flip.Horizontal */];
    const PROPELLER_SX = [32, 48, 56, 48];
    const PROPELLER_SW = [16, 8, 8, 8];
    const sw = PROPELLER_SW[frame];
    canvas.drawBitmap(bmp, dx + (16 - sw) / 2, dy - 6, PROPELLER_SX[frame], 48, sw, 8, PROPELLER_FLIP[frame]);
};
