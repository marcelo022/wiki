# Gera os ícones do app (fogueira estilizada) em várias densidades.
import sys, os, math
from PIL import Image, ImageDraw, ImageFilter
out = sys.argv[1]
def icon(size):
    S = 512
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, S, S), 110, fill=(14, 10, 14, 255))
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0)); g = ImageDraw.Draw(glow)
    g.ellipse((96, 150, 416, 470), fill=(255, 120, 30, 120)); glow = glow.filter(ImageFilter.GaussianBlur(60))
    im = Image.alpha_composite(im, glow); d = ImageDraw.Draw(im)
    d.line((150, 420, 362, 360), fill=(90, 70, 48), width=34); d.line((362, 420, 150, 360), fill=(90, 70, 48), width=34)
    d.polygon([(256, 90), (340, 300), (300, 400), (212, 400), (172, 300)], fill=(255, 140, 40))
    d.polygon([(256, 170), (306, 320), (282, 400), (230, 400), (206, 320)], fill=(255, 220, 120))
    d.line((270, 410, 236, 120), fill=(200, 200, 215), width=18)
    d.polygon([(236, 120), (226, 70), (248, 118)], fill=(200, 200, 215))
    d.line((205, 170, 265, 178), fill=(150, 120, 80), width=14)
    return im.resize((size, size), Image.LANCZOS)
for name, sz in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    p = os.path.join(out, 'mipmap-' + name); os.makedirs(p, exist_ok=True)
    icon(sz).save(os.path.join(p, 'ic_launcher.png'))
icon(512).save(os.path.join(out, '..', 'icon-512.png'))
