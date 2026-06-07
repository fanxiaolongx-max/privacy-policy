import re
from pathlib import Path

TARGET = Path(__file__).resolve().parent / 'js' / 'pages' / 'praudit' / 'main.js'

with open(TARGET, 'r') as f:
    content = f.read()

# 1. Update renderBlock return object
content = content.replace("isSummary: el.classList.contains('print-summary-page'),", "isCover: el.classList.contains('print-cover-page'),\n                        isSummary: el.classList.contains('print-summary-page'),")

# 2. Update blocks filter
content = content.replace(".filter(el => el.classList.contains('print-summary-page')", ".filter(el => el.classList.contains('print-cover-page') || el.classList.contains('print-summary-page')")

# 3. Update page break logic (before adding block)
content = content.replace("if (block.isSummary && hasContentOnPage) addNewPage();", "if (block.isCover && hasContentOnPage) addNewPage();\n                    if (block.isSummary && hasContentOnPage) addNewPage();")

# 4. Update page break logic (after adding block)
content = content.replace("if (block.isSummary) {\n                        if (i < blocks.length - 1) addNewPage();", "if (block.isCover) {\n                        if (i < blocks.length - 1) addNewPage();\n                    } else if (block.isSummary) {\n                        if (i < blocks.length - 1) addNewPage();")

# 5. Inject watermark before html2canvas
injection = """
                    const wm = document.createElement('div');
                    wm.className = 'watermark';
                    wm.style.position = 'absolute';
                    wm.style.top = '0';
                    wm.style.left = '0';
                    wm.style.width = '100%';
                    wm.style.height = '100%';
                    wm.style.zIndex = '9999';
                    const originalPosition = el.style.position;
                    if (!originalPosition || originalPosition === 'static') {
                        el.style.position = 'relative';
                    }
                    el.appendChild(wm);

                    const elementRect = el.getBoundingClientRect();
"""

content = content.replace("const elementRect = el.getBoundingClientRect();", injection.strip() + "\n")

# 6. Remove watermark after html2canvas
removal = """
                    if (wm && wm.parentNode === el) el.removeChild(wm);
                    el.style.position = originalPosition;
                    
                    const baseWidth = contentWidth;
"""

content = content.replace("const baseWidth = contentWidth;", removal.strip() + "\n")

with open(TARGET, 'w') as f:
    f.write(content)
