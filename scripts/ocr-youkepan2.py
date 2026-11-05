"""OCR《大佛頂首楞嚴經（有科判）》第二版：頁面旋轉 90°、用 chi_tra 橫排模型。

用法：python scripts/ocr-youkepan2.py
續跑：已存在頁面會跳過。
"""
import json
import os

import pypdfium2 as pdfium
import pytesseract
from PIL import ImageOps

BASE = os.path.dirname(__file__)
PDF = os.path.join(BASE, "..", "vendor", "大佛頂首楞嚴經（有科判）.pdf")
OUT = os.path.join(BASE, "..", "data", "kepan", "youkepan-ocr2.jsonl")

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
os.environ["TESSDATA_PREFIX"] = os.path.join(BASE, "..", "vendor", "tessdata")

done = set()
if os.path.exists(OUT):
    with open(OUT, encoding="utf-8") as fh:
        for line in fh:
            try:
                done.add(json.loads(line)["page"])
            except Exception:
                pass

pdf = pdfium.PdfDocument(PDF)
with open(OUT, "a", encoding="utf-8") as out:
    for i in range(len(pdf)):
        if i in done:
            continue
        img = pdf[i].render(scale=400 / 72).to_pil().convert("L")
        img = ImageOps.autocontrast(img).rotate(90, expand=True)
        try:
            text = pytesseract.image_to_string(img, lang="chi_tra", config="--psm 6")
        except Exception as e:
            text = ""
            print("ERR", i, str(e)[:50], flush=True)
        out.write(json.dumps({"page": i, "text": text}, ensure_ascii=False) + "\n")
        out.flush()
        if i % 10 == 0:
            print("page", i, "chars", len(text), flush=True)
print("done", flush=True)
