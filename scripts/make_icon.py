"""Generuje ikonę aplikacji Grant CRM Premium AI."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "app_icon.ico"
OUT.parent.mkdir(parents=True, exist_ok=True)

SIZE = 256
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Tło - gradient (symulowany kilkoma okręgami)
for i in range(SIZE, 0, -2):
    t = i / SIZE
    r = int(99 * t + 30 * (1 - t))
    g = int(102 * t + 64 * (1 - t))
    b = int(241 * t + 175 * (1 - t))
    draw.rounded_rectangle(
        [(SIZE - i) // 2, (SIZE - i) // 2, (SIZE + i) // 2, (SIZE + i) // 2],
        radius=int(48 * t),
        fill=(r, g, b, 255),
    )

# Litera "G" w środku
try:
    font = ImageFont.truetype("arialbd.ttf", 150)
except OSError:
    font = ImageFont.load_default()

text = "G"
bbox = draw.textbbox((0, 0), text, font=font)
w = bbox[2] - bbox[0]
h = bbox[3] - bbox[1]
draw.text(
    ((SIZE - w) / 2 - bbox[0], (SIZE - h) / 2 - bbox[1] - 8),
    text,
    fill=(255, 255, 255, 255),
    font=font,
)

# Mała "iskra AI" w prawym górnym rogu
spark = [(196, 40), (212, 70), (244, 78), (212, 88), (200, 118), (188, 88), (160, 78), (188, 70)]
draw.polygon(spark, fill=(255, 215, 0, 255))

sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
img.save(OUT, format="ICO", sizes=sizes)
print(f"Zapisano: {OUT}")
