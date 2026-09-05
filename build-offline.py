#!/usr/bin/env python3
"""Build civique-offline.html — single file, works on iPhone without internet."""
import json, pathlib, re

base = pathlib.Path(__file__).parent
html = (base / 'index.html').read_text(encoding='utf-8')
css = (base / 'styles.css').read_text(encoding='utf-8')
app = (base / 'app.js').read_text(encoding='utf-8')

# Load questions from questions_data.js
qd = (base / 'questions_data.js').read_text(encoding='utf-8')
m = re.search(r'window\.QUESTIONS_DATA\s*=\s*(\[.*\])\s*;', qd, re.DOTALL)
if not m:
    raise SystemExit('Cannot parse questions_data.js')
questions = json.loads(m.group(1))

html = html.replace('<link rel="manifest" href="manifest.json">\n', '')
html = html.replace('<link rel="icon" href="icon-192.svg" type="image/svg+xml">\n', '')
html = html.replace('<link rel="apple-touch-icon" href="icon-192.svg">\n', '')
html = html.replace('<link rel="stylesheet" href="styles.css">', f'<style>\n{css}\n</style>')

app = app.replace('function registerSW() {\n  if (\'serviceWorker\' in navigator) navigator.serviceWorker.register(\'sw.js\').catch(() => {});\n}\n\n', 'function registerSW() {}\n\n')
app = app.replace(
    "el.textContent = allQuestions.length\n    ? `✓ ${allQuestions.length} questions chargées` + (navigator.onLine ? '' : ' · hors-ligne')\n    : 'Chargement…';",
    "el.textContent = '✈️ 100% hors-ligne — ' + allQuestions.length + ' questions';"
)

q = json.dumps(questions, ensure_ascii=False, separators=(',', ':'))
html = html.replace(
    '<script src="questions_data.js"></script>\n  <script src="app.js"></script>',
    f'<script>window.QUESTIONS_DATA={q};</script>\n<script>\n{app}\n</script>'
)

(base / 'civique-offline.html').write_text(html, encoding='utf-8')
print(f'Built civique-offline.html ({len(questions)} questions, {(base / "civique-offline.html").stat().st_size // 1024} KB)')
