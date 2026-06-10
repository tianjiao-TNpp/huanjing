# -*- coding: utf-8 -*-
"""生成 App 图标: 绿色渐变 + 带叶脉的叶片。高分辨率绘制后缩小, 抗锯齿。
输出 icons/icon-512.png, icon-192.png (满版方形, 适配 maskable)。
"""
import os, math
from PIL import Image, ImageDraw, ImageChops, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IC = os.path.join(ROOT, "icons")
S = 1024  # 超采样画布


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vgrad(size, top, bot):
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        c = lerp(top, bot, y / (size - 1))
        for x in range(size):
            px[x, y] = c
    return img


def main():
    cx = cy = S / 2
    bg = vgrad(S, (0x3D, 0xCB, 0x7E), (0x10, 0x73, 0x44))   # 清新→深绿

    # 柔光圆(增加层次)
    glow = Image.new("L", (S, S), 0)
    ImageDraw.Draw(glow).ellipse([S*0.16, S*0.12, S*0.84, S*0.80], fill=40)
    glow = glow.filter(ImageFilter.GaussianBlur(S*0.06))
    bg = Image.composite(Image.new("RGB", (S, S), (255, 255, 255)), bg, glow.point(lambda v: v))
    bg = vgrad(S, (0x3D, 0xCB, 0x7E), (0x10, 0x73, 0x44))   # 重置(保持纯净渐变)

    # ---- 叶片(竖直, 两段二次曲线= vesica) ----
    R, off = S*0.38, S*0.15
    cA = Image.new("L", (S, S), 0); ImageDraw.Draw(cA).ellipse([cx-off-R, cy-R, cx-off+R, cy+R], fill=255)
    cB = Image.new("L", (S, S), 0); ImageDraw.Draw(cB).ellipse([cx+off-R, cy-R, cx+off+R, cy+R], fill=255)
    leafmask = ImageChops.darker(cA, cB)

    # 白色(略带薄荷)渐变填充
    white = vgrad(S, (255, 255, 255), (223, 245, 233)).convert("RGBA")
    leaf = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    leaf = Image.composite(white, leaf, leafmask)

    # 叶脉(柔绿)
    veins = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    vd = ImageDraw.Draw(veins)
    g = (31, 138, 91, 235)
    midw = int(S*0.013)
    vd.line([(cx, cy-S*0.30), (cx, cy+S*0.31)], fill=g, width=midw)   # 主脉
    for t, ln in [(0.16, 0.135), (0.02, 0.155), (-0.13, 0.135)]:
        my = cy + t*S
        vd.line([(cx, my+ln*S*0.5), (cx-ln*S, my-ln*S*0.45)], fill=g, width=int(S*0.0095))
        vd.line([(cx, my+ln*S*0.5), (cx+ln*S, my-ln*S*0.45)], fill=g, width=int(S*0.0095))
    # 叶脉裁剪到叶内
    veins.putalpha(ImageChops.darker(veins.getchannel("A"), leafmask))
    leaf = Image.alpha_composite(leaf, veins)

    # 旋转, 让叶尖朝右上, 更有生气
    leaf = leaf.rotate(26, resample=Image.BICUBIC, center=(cx, cy))

    # 叶片柔和投影
    sh = leaf.getchannel("A").point(lambda v: int(v*0.35))
    shadow = Image.new("RGBA", (S, S), (8, 60, 35, 0)); shadow.putalpha(sh)
    shadow = shadow.filter(ImageFilter.GaussianBlur(S*0.018))
    shadow = ImageChops.offset(shadow, int(S*0.012), int(S*0.018))

    out = bg.convert("RGBA")
    out = Image.alpha_composite(out, shadow)
    out = Image.alpha_composite(out, leaf)

    for sz in (512, 192):
        out.convert("RGB").resize((sz, sz), Image.LANCZOS).save(os.path.join(IC, "icon-%d.png" % sz))
    # 预览大图
    out.convert("RGB").resize((256, 256), Image.LANCZOS).save(os.path.join(ROOT, "_icon_preview.png"))
    print("wrote icon-512.png / icon-192.png")


if __name__ == "__main__":
    main()
