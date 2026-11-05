"""OCR《大佛頂首楞嚴經（有科判）》512 頁（直排），逐頁寫入 jsonl。

用法：python scripts/ocr-youkepan.py [起頁] [迄頁]
續跑：已存在的頁會跳過。
"""
import json
import os
import sys

import pypdfium2 as pdfium
import pytesseract

PDF = os.path.join(os.path.dirname(__file__), "..", "vendor", "大佛頂首楞嚴經（有科判）.pdf")
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "kepan", "youkepan-ocr.jsonl")
TESS = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

pytesseract.pytesseract.tesseract_cmd = TESS
os.environ["TESSDATA_PREFIX"] = os.path.join(os.path.dirname(__file__), "..", "vendor", "tessdata")

done = set()
if os.path.exists(OUT):
    with open(OUT, encoding="utf-8") as fh:
        for line in fh:
            try:
                done.add(json.loads(line)["page"])
            except Exception:
                pass

pdf = pdfium.PdfDocument(PDF)
start = int(sys.argv[1]) if len(sys.argv) > 1 else 0
end = int(sys.argv[2]) if len(sys.argv) > 2 else len(pdf)

with open(OUT, "a", encoding="utf-8") as out:
    for i in range(start, min(end, len(pdf))):
        if i in done:
            continue
        page = pdf[i]
        img = page.render(scale=400 / 72).to_pil()
        try:
            text = pytesseract.image_to_string(img, lang="chi_tra_vert", config="--psm 5")
        except Exception as e:
            text = ""
            print("ERR", i, str(e)[:60], flush=True)
        out.write(json.dumps({"page": i, "text": text}, ensure_ascii=False) + "\n")
        out.flush()
        if i % 10 == 0:
            print("page", i, "chars", len(text), flush=True)
print("done", start, end, flush=True)
