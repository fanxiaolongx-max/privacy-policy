#!/usr/bin/env python3
"""Generate the Windows portable-edition icon from the primary app icon."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "frontend" / "assets" / "icon-windows.png"
OUTPUT_BASE_ICO = ROOT / "frontend" / "assets" / "icon-windows.ico"
OUTPUT_PNG = ROOT / "frontend" / "assets" / "icon-windows-portable.png"
OUTPUT_ICO = ROOT / "frontend" / "assets" / "icon-windows-portable.ico"
OUTPUT_SPLASH = ROOT / "frontend" / "assets" / "portable-splash.bmp"
ICON_SIZES = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def load_badge_font(size: int) -> ImageFont.FreeTypeFont:
    candidates = (
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    )
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def load_ui_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = (
        Path("/System/Library/Fonts/STHeiti Medium.ttc" if bold else "/System/Library/Fonts/STHeiti Light.ttc"),
        Path("C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc"),
        Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc" if bold else "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
    )
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return load_badge_font(size)


def create_portable_splash(icon: Image.Image) -> None:
    width, height = 620, 340
    splash = Image.new("RGB", (width, height), (10, 18, 36))
    pixels = splash.load()
    for y in range(height):
        for x in range(width):
            teal = max(0.0, 1.0 - ((x - 80) ** 2 + (y - 20) ** 2) ** 0.5 / 360)
            violet = max(0.0, 1.0 - ((x - 580) ** 2 + (y - 320) ** 2) ** 0.5 / 420)
            pixels[x, y] = (
                int(10 + 9 * violet),
                int(18 + 22 * teal + 8 * violet),
                int(36 + 24 * teal + 20 * violet),
            )
    draw = ImageDraw.Draw(splash, "RGBA")
    draw.rounded_rectangle((18, 18, width - 18, height - 18), radius=28, outline=(255, 255, 255, 58), width=2)
    draw.ellipse((470, -70, 690, 150), fill=(56, 189, 248, 18))
    draw.ellipse((-80, 210, 170, 460), fill=(139, 92, 246, 18))
    splash.paste(icon.resize((72, 72), Image.Resampling.LANCZOS), (44, 42), icon.resize((72, 72), Image.Resampling.LANCZOS))
    draw.text((132, 49), "Tools Platform", font=load_ui_font(28, bold=True), fill=(248, 250, 252, 255))
    draw.text((133, 86), "PORTABLE WORKSPACE", font=load_badge_font(11), fill=(153, 246, 228, 220))
    draw.text((44, 155), "正在准备绿色便携版", font=load_ui_font(22, bold=True), fill=(248, 250, 252, 255))
    draw.text((44, 193), "解压本地组件与运行环境，请稍候…", font=load_ui_font(14), fill=(203, 213, 225, 210))
    draw.rounded_rectangle((44, 258, width - 44, 268), radius=5, fill=(2, 8, 23, 110), outline=(255, 255, 255, 26))
    draw.rounded_rectangle((44, 258, 340, 268), radius=5, fill=(45, 212, 191, 235))
    draw.text((44, 286), "首次运行或版本更新时，准备时间可能稍长。", font=load_ui_font(11), fill=(148, 163, 184, 185))
    splash.save(OUTPUT_SPLASH, "BMP")


def main() -> None:
    base = Image.open(SOURCE).convert("RGBA").resize((256, 256), Image.Resampling.LANCZOS)
    base.save(OUTPUT_BASE_ICO, "ICO", sizes=ICON_SIZES)
    canvas = base.copy()
    draw = ImageDraw.Draw(canvas)

    # A compact emerald "P" badge stays recognizable at Windows desktop sizes
    # while preserving the installer edition's original atom mark.
    badge_box = (168, 168, 248, 248)
    draw.rounded_rectangle(
        badge_box,
        radius=21,
        fill=(16, 185, 129, 255),
        outline=(255, 255, 255, 255),
        width=6,
    )
    font = load_badge_font(50)
    text_box = draw.textbbox((0, 0), "P", font=font, stroke_width=1)
    text_width = text_box[2] - text_box[0]
    text_height = text_box[3] - text_box[1]
    text_x = (badge_box[0] + badge_box[2] - text_width) / 2
    text_y = (badge_box[1] + badge_box[3] - text_height) / 2 - text_box[1] - 1
    draw.text(
        (text_x, text_y),
        "P",
        font=font,
        fill=(255, 255, 255, 255),
        stroke_width=1,
        stroke_fill=(255, 255, 255, 255),
    )

    canvas.save(OUTPUT_PNG, "PNG", optimize=True)
    canvas.save(OUTPUT_ICO, "ICO", sizes=ICON_SIZES)
    create_portable_splash(canvas)
    print(f"Generated {OUTPUT_BASE_ICO}")
    print(f"Generated {OUTPUT_PNG}")
    print(f"Generated {OUTPUT_ICO}")
    print(f"Generated {OUTPUT_SPLASH}")


if __name__ == "__main__":
    main()
