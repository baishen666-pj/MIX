"""Generate MIX brand icons (ICO + PNGs) using Pillow."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

ICON_DIR = Path(__file__).resolve().parent.parent / "electron" / "build"

BG = (26, 26, 46)        # #1a1a2e
ACCENT1 = (0, 210, 255)   # #00d2ff
ACCENT2 = (123, 47, 247)  # #7b2ff7
WHITE = (240, 240, 255)

def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded rectangle background
    margin = max(2, size // 16)
    radius = size // 5
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=radius,
        fill=BG,
    )

    # Gradient bar at top (simulate with two overlapping rects)
    bar_h = max(2, size // 20)
    draw.rounded_rectangle(
        [margin, margin, size - margin, margin + radius],
        radius=radius,
        fill=ACCENT1,
    )
    draw.rectangle(
        [margin, margin + bar_h, size - margin, margin + radius],
        fill=BG,
    )

    # "M" letter
    font_size = int(size * 0.5)
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except OSError:
        font = ImageFont.load_default()

    text = "M"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) / 2
    y = (size - th) / 2 + size * 0.05
    draw.text((x, y), text, fill=WHITE, font=font)

    return img

def main():
    ICON_DIR.mkdir(parents=True, exist_ok=True)

    # Generate PNGs for Linux/macOS
    for size in [16, 32, 48, 64, 128, 256, 512, 1024]:
        icon = make_icon(size)
        icon.save(ICON_DIR / f"icon-{size}.png")
        print(f"  icon-{size}.png")

    # Generate ICO for Windows (multi-size)
    ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    ico_images = [make_icon(s) for s, _ in ico_sizes]
    ico_images[0].save(
        ICON_DIR / "icon.ico",
        format="ICO",
        sizes=ico_sizes,
        append_images=ico_images[1:],
    )
    print(f"  icon.ico ({len(ico_sizes)} sizes)")

    # Main icon.png (512x512)
    icon512 = make_icon(512)
    icon512.save(ICON_DIR / "icon.png")
    print("  icon.png (512x512)")

    print(f"Icons generated in {ICON_DIR}")

if __name__ == "__main__":
    main()
