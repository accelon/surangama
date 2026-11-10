# -*- coding: utf-8 -*-
"""生成四張手機版示意圖（1080 寬）。執行：python make-figs.py"""
from PIL import Image, ImageDraw, ImageFont

S = 2                      # 以 2 倍繪製，再縮回 1080，邊緣較順
W = 1080
BG = (251, 248, 240)
INK = (26, 26, 26)
MUTED = (90, 90, 90)
ACCENT = (138, 75, 30)
GREEN = (47, 93, 69)
GOLD = (185, 138, 47)
RED = (160, 44, 44)
LINE = (221, 212, 194)

REG = r"C:\Windows\Fonts\msjh.ttc"
BOLD = r"C:\Windows\Fonts\msjhbd.ttc"


def F(size, bold=False):
    return ImageFont.truetype(BOLD if bold else REG, int(size * S))


def new(h):
    im = Image.new("RGB", (W * S, h * S), BG)
    return im, ImageDraw.Draw(im)


def text(d, xy, s, size, color=INK, bold=False, anchor="la"):
    d.text((xy[0] * S, xy[1] * S), s, font=F(size, bold), fill=color, anchor=anchor)


def tw(d, s, size, bold=False):
    return d.textlength(s, font=F(size, bold)) / S


def rrect(d, box, r, fill):
    d.rounded_rectangle([box[0] * S, box[1] * S, box[2] * S, box[3] * S], radius=r * S, fill=fill)


def save(im, name, h):
    im.resize((W, h), Image.LANCZOS).save(name, optimize=True)
    print(name, (W, h))


# ---------------------------------------------------------------- 圖一 原料
def fig_entry():
    H = 1300
    im, d = new(H)
    text(d, (48, 44), "方法 · 一", 24, ACCENT, True)
    text(d, (48, 84), "詞條不是寫出來的，", 64, INK, True)
    text(d, (48, 161), "是最後編出來的", 64, INK, True)
    text(d, (48, 250), "以楞嚴為例：底下是原料，", 36, MUTED)
    text(d, (48, 302), "上面是讀者看到的那一百字。", 36, MUTED)

    layers = [
        (649, 180, GREEN, (255, 255, 255), "讀者看到的一百字", ["點一下，展開到原文"]),
        (827, 180, (207, 224, 214), (36, 64, 47), "詞條種子 113 條", ["人物、名相、論點、主張", "當代見解、注疏題解、版本"]),
        (925, 170, (226, 216, 194), (74, 58, 36), "11 家注疏 310 萬字", ["9 家科判 11,007 節"]),
        (984, 180, (239, 231, 215), (74, 58, 36), "主文 3,732 句", ["每一句有固定的號碼", "注疏、科判、別譯都指著它"]),
    ]
    y = 380
    for w, h, fill, fg, title, notes in layers:
        x0 = 540 - w / 2
        rrect(d, (x0, y, x0 + w, y + h), 12, fill)
        ty = y + h / 2 - (22 if notes else 0)
        text(d, (540, ty), title, 44, fg, True, "mm")
        ny = ty + 46
        for n in notes:
            text(d, (540, ny), n, 32, fg, False, "mm")
            ny += 42
        y += h + 20

    text(d, (540, 1176), "↑ 由下往上：一層一層編譯", 32, GREEN, True, "mm")
    text(d, (540, 1226), "↓ 由上往下：每一句都回得到出處", 32, ACCENT, True, "mm")
    save(im, "fig-entry-anatomy.png", H)


# ---------------------------------------------------------------- 圖二 總成本
def fig_total():
    H = 1000
    im, d = new(H)
    text(d, (48, 44), "成本 · 一", 24, ACCENT, True)
    text(d, (48, 84), "同一部詞典，", 64, INK, True)
    text(d, (48, 161), "兩種編法的總成本", 64, INK, True)
    text(d, (48, 250), "單位：人年。估算口徑，不含前期讀藏。", 34, MUTED)

    def panel(y, name, ratio, items):
        text(d, (48, y), name, 48, INK, True)
        rx = 48 + tw(d, name, 48, True) + 24
        pw = tw(d, ratio, 27, True) + 36
        rrect(d, (rx, y - 4, rx + pw, y + 44), 22, (230, 239, 233))
        text(d, (rx + pw / 2, y + 20), ratio, 27, GREEN, True, "mm")
        for i, (label, val, frac) in enumerate(items):
            iy = y + 70 + i * 78
            text(d, (48, iy), label, 36, (51, 51, 51), False, "lm")
            text(d, (1032, iy), val, 44, INK, True, "rm")
            rrect(d, (48, iy + 22, 1032, iy + 58), 6, (239, 233, 220))
            rrect(d, (48, iy + 22, 48 + 984 * frac, iy + 58), 6, ACCENT if label == "紙書" else GREEN)
        return y + 70 + len(items) * 78

    panel(310, "一千條", "相差 2.4 倍", [
        ("紙書", "3.0 人年", 0.75),
        ("機器", "1.25 人年", 0.3125),
    ])
    panel(560, "一萬條", "相差 8.6 倍", [
        ("紙書", "30 人年", 0.9375),
        ("機器", "3.5 人年", 0.1094),
    ])

    text(d, (48, 830), "管線像廚具：只炒一盤，廚具的錢攤不平；", 34, (68, 68, 68))
    text(d, (48, 878), "炒到一百盤，每一盤才回到菜價。", 34, (68, 68, 68))
    text(d, (48, 926), "所以第一部貴，第二部才划算。", 34, ACCENT, True)
    save(im, "fig-cost-total.png", H)


# ---------------------------------------------------------------- 圖三 成本結構
def fig_structure():
    H = 1080
    im, d = new(H)
    text(d, (48, 44), "成本 · 二", 24, ACCENT, True)
    text(d, (48, 84), "成本結構：錢花在哪裡", 64, INK, True)
    text(d, (48, 180), "一千條，人年。兩邊都是八二開，", 35, MUTED)
    text(d, (48, 228), "差別在八的那一半。", 35, MUTED)

    def block(y, name, total, left_label, right_label, left_color):
        text(d, (48, y), name, 42, INK, True)
        text(d, (48 + tw(d, name, 42, True) + 18, y + 10), total, 30, MUTED)
        by = y + 56
        split = 48 + 984 * 0.8
        rrect(d, (48, by, 1032, by + 88), 10, left_color)
        rrect(d, (split, by, 1032, by + 88), 10, GOLD)
        d.rectangle([split * S, by * S, (split + 10) * S, (by + 88) * S], fill=GOLD)
        text(d, (48 + 984 * 0.4, by + 44), "80%", 36, (255, 255, 255), True, "mm")
        text(d, (48 + 984 * 0.9, by + 44), "20%", 36, (255, 255, 255), True, "mm")
        ky = by + 112
        d.rectangle([48 * S, ky * S, 68 * S, (ky + 20) * S], fill=left_color)
        text(d, (80, ky + 10), left_label, 31, (68, 68, 68), False, "lm")
        kx = 80 + tw(d, left_label, 31) + 40
        d.rectangle([kx * S, ky * S, (kx + 20) * S, (ky + 20) * S], fill=GOLD)
        text(d, (kx + 32, ky + 10), right_label, 31, (68, 68, 68), False, "lm")

    block(300, "紙書編法", "共 3.0 人年", "搬運 2.4 人年", "判斷 0.6 人年", ACCENT)
    block(540, "機器輔助", "共 1.25 人年", "管線 1.0 人年", "判斷 0.25 人年", GREEN)

    text(d, (48, 790), "搬運＝抄、排、校、做索引。", 30, MUTED)
    text(d, (48, 834), "算力不到 2%，圖上幾乎看不見。", 30, MUTED)

    rrect(d, (48, 890, 1032, 1040), 0, (242, 236, 224))
    d.rectangle([48 * S, 890 * S, 54 * S, 1040 * S], fill=ACCENT)
    text(d, (78, 918), "機器不貴。貴的是把管線做一次，", 36, INK, False)
    text(d, (78, 972), "以及人做判斷。", 36, ACCENT, True)
    save(im, "fig-cost-structure.png", H)


# ---------------------------------------------------------------- 圖四 攤平曲線
def fig_curve():
    H = 1360
    im, d = new(H)
    text(d, (48, 44), "成本 · 三", 24, ACCENT, True)
    text(d, (48, 84), "每一條的價錢，", 64, INK, True)
    text(d, (48, 161), "隨規模下降", 64, INK, True)
    text(d, (48, 250), "縱軸是每一條要花幾個小時。", 35, MUTED)
    text(d, (48, 298), "紙書是平的，機器是一直往下。", 35, MUTED)

    x0, x1, y0, y1 = 124, 1000, 386, 1096
    XMAX, YMAX = 6000, 8
    X = lambda v: x0 + v / XMAX * (x1 - x0)
    Y = lambda v: y1 - v / YMAX * (y1 - y0)

    for v in range(0, 9, 2):
        d.line([x0 * S, Y(v) * S, x1 * S, Y(v) * S], fill=LINE, width=1 * S)
        text(d, (x0 - 16, Y(v)), str(v), 30, (138, 138, 138), False, "rm")
    for v in range(0, XMAX + 1, 2000):
        text(d, (X(v), y1 + 40), "0" if v == 0 else f"{v:,}", 30, (138, 138, 138), False, "mm")
        d.line([X(v) * S, y1 * S, X(v) * S, (y1 + 10) * S], fill=(201, 191, 168), width=1 * S)
    text(d, (x1, y1 + 84), "條目數", 30, (138, 138, 138), False, "rm")

    d.line([x0 * S, Y(6) * S, x1 * S, Y(6) * S], fill=ACCENT, width=4 * S)

    pts = []
    for i in range(0, 261):
        n = 300 + (XMAX - 300) * (i / 260) ** 2
        pts.append((X(n) * S, Y(min(YMAX, 2000 / n + 0.5)) * S))
    d.line(pts, fill=GREEN, width=4 * S, joint="curve")

    xc = X(364)
    yy = Y(6)
    step = 14
    cy = yy
    while cy < y1:
        d.line([xc * S, cy * S, xc * S, min(cy + 7, y1) * S], fill=RED, width=2 * S)
        cy += step
    d.ellipse([(xc - 9) * S, (yy - 9) * S, (xc + 9) * S, (yy + 9) * S], fill=RED)

    text(d, (xc + 26, yy - 86), "約 364 條", 34, RED, True)
    text(d, (xc + 26, yy - 48), "兩線交叉", 30, (138, 90, 74))
    text(d, (x1 - 6, yy - 58), "紙書：每條 6 小時", 34, ACCENT, True, "ra")

    xm, ym = X(1000), Y(2.5)
    d.ellipse([(xm - 8) * S, (ym - 8) * S, (xm + 8) * S, (ym + 8) * S], fill=GREEN)
    text(d, (xm + 20, ym - 72), "一千條", 32, GREEN, True)
    text(d, (xm + 20, ym - 36), "2.5 小時", 32, GREEN)

    text(d, (x0 + 12, Y(0.5) - 48), "機器最低 0.5 小時", 28, GREEN)
    cy = Y(0.5)
    cx = x0
    while cx < x0 + 280:
        d.line([cx * S, cy * S, min(cx + 9, x0 + 280) * S, cy * S], fill=GREEN, width=1 * S)
        cx += 18

    ly = 1214
    for color, label, bold in [(ACCENT, "紙書：每條 6 小時", False), (GREEN, "機器：管線一次＋每條半小時", False), (RED, "交叉點：約 364 條", False)]:
        d.line([48 * S, (ly + 10) * S, 78 * S, (ly + 10) * S], fill=color, width=6 * S)
        text(d, (92, ly), label, 31, (68, 68, 68), bold)
        ly += 48

    save(im, "fig-cost-curve.png", H)


if __name__ == "__main__":
    fig_entry()
    fig_total()
    fig_structure()
    fig_curve()
