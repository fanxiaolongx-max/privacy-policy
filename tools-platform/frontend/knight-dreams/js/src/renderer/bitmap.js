const unpackPalette = (palette) => {
    let out = new Array();
    let len;
    for (let j = 0; j < palette.length; ++j) {
        len = (palette[j].length / 2) | 0;
        out.push(new Array(len));
        for (let i = 0; i < len; ++i) {
            out[j][i] = parseInt(palette[j].substring(i * 2, i * 2 + 2), 16);
        }
    }
    return out;
};
const convertTile = (imageData, dx, dy, dw, dh, offset, colorTable, palette) => {
    let paletteEntry;
    let i;
    for (let y = dy; y < dy + dh; ++y) {
        for (let x = dx; x < dx + dw; ++x) {
            i = y * offset + x;
            paletteEntry = palette[colorTable[(imageData.data[i * 4] / 85) | 0]];
            for (let j = 0; j < 4; ++j) {
                imageData.data[i * 4 + j] = paletteEntry[j];
            }
        }
    }
};
// Unused (for now)
/*
const convertToRGB222 = (imageData : ImageData, len : number, alphaThreshold = 128) : void => {

    for (let i = 0; i < len; ++ i) {

        for (let j = 0; j < 3; ++ j) {

            imageData.data[i*4 + j] = Math.floor(imageData.data[i*4 + j] / 85) * 85;
        }
        imageData.data[i*4 + 3] = imageData.data[i*4 + 3] < alphaThreshold ? 0 : 255;
    }
}
*/
const convertToMonochrome = (imageData, color, len) => {
    for (let i = 0; i < len; ++i) {
        for (let j = 0; j < 3; ++j) {
            imageData.data[i * 4 + j] = color[j];
        }
        imageData.data[i * 4 + 3] = imageData.data[i * 4 + 3] < 192 ? 0 : 255;
    }
};
const applyPalette = (image, colorTables, packedPalette) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, image.width, image.height);
    const w = (canvas.width / 8) | 0;
    const h = (canvas.height / 8) | 0;
    // Faster than accessing image each tile?
    const imgWidth = image.width;
    const palette = unpackPalette(packedPalette);
    let colorTable;
    let j = 0;
    for (let y = 0; y < h; ++y) {
        for (let x = 0; x < w; ++x) {
            if (j >= colorTables.length)
                continue;
            colorTable = (colorTables[j] ?? "0000").split("").map((s) => parseInt(s, 32));
            convertTile(imageData, x * 8, y * 8, 8, 8, imgWidth, colorTable, palette);
            ++j;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
};
const createCustom = (width, height, params, event, monochromeColor = undefined) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = width;
    canvas.height = height;
    event(ctx, width, height, params);
    let imageData;
    if (monochromeColor) {
        ctx.drawImage(canvas, 0, 0);
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        convertToMonochrome(imageData, monochromeColor, width * height);
        ctx.putImageData(imageData, 0, 0);
    }
    return canvas;
};
export const BitmapGenerator = {
    applyPalette: applyPalette,
    createCustom: createCustom
};
