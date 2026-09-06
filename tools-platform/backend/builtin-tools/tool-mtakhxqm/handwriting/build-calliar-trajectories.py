#!/usr/bin/env python3
"""Extract a compact set of genuine online-handwriting trajectories from Calliar.

Input is the extracted `dataset/` directory from https://github.com/ARBML/calliar.
The output intentionally contains only selected x/y pen trajectories.  Timing is not
present in Calliar, so the browser player reconstructs timing from travelled distance.
"""

from __future__ import annotations

import argparse
import glob
import json
import math
import os
import re
from collections import defaultdict
from pathlib import Path

MAP = {
    "أ": ["ء", "ا"], "آ": ["؅", "ا"], "إ": ["ا", "ء"],
    "ب": ["ٮ", "."], "ت": [".", ".", "ٮ"], "ث": [".", ".", ".", "ٮ"],
    "ج": ["ح", "."], "خ": [".", "ح"], "ذ": [".", "د"], "ز": [".", "ر"],
    "ش": [".", ".", ".", "س"], "ض": [".", "ص"], "ط": ["ا", "ﺻ"],
    "ظ": [".", "ا", "ﺻ"], "غ": [".", "ع"], "ف": [".", "ٯ"],
    "ق": [".", ".", "ٯ"], "ڤ": [".", ".", ".", "ٯ"],
    "ك": ["ء", "ل"], "ن": [".", "ں"], "ؤ": ["ء", "و"],
    "ي": ["ى", ".", "."], "ئ": ["ء", "ى"], "ة": [".", ".", "ه"],
}

DIACRITICS = re.compile(r"[\u064b-\u065f\u0670]")
ARABIC_WORD = re.compile(r"[\u0621-\u063a\u0641-\u064a\u0671\u06a4\u064b-\u065f\u0670]+")
DUAL_JOINING = set("بتثجحخسشصضطظعغفقكلمنهيئ")
JOINABLE = DUAL_JOINING | set("اأإآدذرزوىةؤ")


def normalize(text: str) -> str:
    return "".join(ARABIC_WORD.findall(DIACRITICS.sub("", text).replace("ـ", "")))


def char_parts(text: str):
    text = DIACRITICS.sub("", text)
    result = []
    for index, char in enumerate(text):
        if char == " ":
            continue
        if char in MAP:
            parts = ["ﻛ"] if char == "ك" and index < len(text) - 1 and text[index + 1] != " " else MAP[char]
        else:
            parts = [char]
        result.append((char, parts))
    return result


def rdp(points, epsilon=1.35):
    if len(points) < 3:
        return points
    x1, y1 = points[0]
    x2, y2 = points[-1]
    denominator = math.hypot(y2 - y1, x2 - x1)
    maximum, split = 0.0, 0
    for index, (x, y) in enumerate(points[1:-1], 1):
        distance = (abs((y2-y1)*x - (x2-x1)*y + x2*y1 - y2*x1) / denominator
                    if denominator else math.hypot(x-x1, y-y1))
        if distance > maximum:
            maximum, split = distance, index
    if maximum > epsilon:
        return rdp(points[:split+1], epsilon)[:-1] + rdp(points[split:], epsilon)
    return [points[0], points[-1]]


def compact(strokes):
    cleaned = []
    for item in strokes:
        points = next(iter(item.values()), [])
        if not points:
            continue
        reduced = rdp(points)
        cleaned.append([[round(float(x), 1), round(float(y), 1)] for x, y in reduced])
    return cleaned


def form_for(word: str, index: int) -> str:
    right = index > 0 and word[index - 1] in DUAL_JOINING and word[index] in JOINABLE
    left = index < len(word) - 1 and word[index] in DUAL_JOINING and word[index + 1] in JOINABLE
    if right and left:
        return "medial"
    if right:
        return "final"
    if left:
        return "initial"
    return "isolated"


def load_samples(dataset_dir: Path):
    words = defaultdict(list)
    glyphs = defaultdict(lambda: defaultdict(list))
    for filename in glob.glob(str(dataset_dir / "**" / "*.json"), recursive=True):
        annotation = re.sub(r"[0-9_]", "", Path(filename).stem)
        parts = char_parts(annotation)
        try:
            drawing = json.loads(Path(filename).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        position = 0
        characters = []
        for char, primitives in parts:
            count = len(primitives)
            characters.append((char, drawing[position:position + count]))
            position += count
        if position > len(drawing):
            continue

        char_offset = 0
        for match in ARABIC_WORD.finditer(annotation):
            word = normalize(match.group())
            count = len(word)
            word_chars = characters[char_offset:char_offset + count]
            char_offset += count
            if not word or "".join(char for char, _ in word_chars) != word:
                continue
            word_strokes = [stroke for _, strokes in word_chars for stroke in strokes]
            compacted_word = compact(word_strokes)
            if compacted_word:
                words[word].append((sum(map(len, compacted_word)), compacted_word, os.path.basename(filename)))
            for index, (char, strokes) in enumerate(word_chars):
                compacted_char = compact(strokes)
                if compacted_char:
                    key = form_for(word, index)
                    glyphs[char][key].append((sum(map(len, compacted_char)), compacted_char, os.path.basename(filename)))
    return words, glyphs


def middle_quality(candidates):
    candidates = [candidate for candidate in candidates if 2 <= candidate[0] <= 240]
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0])
    return candidates[len(candidates) // 2]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--html", type=Path, required=True)
    args = parser.parse_args()

    html = args.html.read_text(encoding="utf-8")
    values = re.findall(r'\bar:\s*"([^"]+)"', html)
    values += re.findall(r'^\s*"[^"]+":\s*"([^"]+)"', html, re.MULTILINE)
    targets = {normalize(word) for value in values for word in ARABIC_WORD.findall(value) if normalize(word)}
    words, glyphs = load_samples(args.dataset)

    selected_words = {}
    for word in sorted(targets):
        selected = middle_quality(words.get(word, []))
        if selected:
            selected_words[word] = {"strokes": selected[1], "sample": selected[2]}

    # Core alphabet plus commonly encountered hamza/taa-maqsurah variants.  Keeping
    # these real templates lets every lesson word enter playback or recording mode.
    alphabet = "ابتثجحخدذرزسشصضطظعغفقكلمنهويأإآةؤئىء"
    selected_glyphs = {}
    for char in alphabet:
        forms = {}
        for form in ("isolated", "initial", "medial", "final"):
            selected = middle_quality(glyphs[char].get(form, []))
            if selected:
                forms[form] = {"strokes": selected[1], "sample": selected[2]}
        # For right-joining letters, "initial" is visually equivalent to isolated
        # and "medial" to final.  Do not substitute arbitrary contextual samples
        # for any other missing form: a real but wrong-context trace is still wrong.
        right_joining = set("اأإآدذرزوةؤى")
        if char in right_joining:
            if "isolated" in forms:
                forms.setdefault("initial", {**forms["isolated"], "equivalentForm": "isolated"})
            if "final" in forms:
                forms.setdefault("medial", {**forms["final"], "equivalentForm": "final"})
        if char == "ء" and "isolated" in forms:
            for form in ("initial", "medial", "final"):
                forms.setdefault(form, {**forms["isolated"], "equivalentForm": "isolated"})
        if forms:
            selected_glyphs[char] = forms

    payload = {
        "version": 1,
        "source": {
            "name": "Calliar: an Online Handwritten Dataset for Arabic Calligraphy",
            "url": "https://github.com/ARBML/calliar",
            "license": "MIT",
            "trajectory": "genuine x/y pen paths; playback timing is distance-reconstructed because source has no timestamps",
        },
        "coverage": {"requestedWords": len(targets), "exactHumanWords": len(selected_words), "glyphs": len(selected_glyphs)},
        "exactWords": selected_words,
        "glyphs": selected_glyphs,
    }
    args.output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(payload["coverage"], ensure_ascii=False))


if __name__ == "__main__":
    main()
