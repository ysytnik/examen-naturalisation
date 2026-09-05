#!/usr/bin/env python3
"""Build civique-offline.html single-file version."""
import json, pathlib

base = pathlib.Path(__file__).parent
html = (base / 'index.html').read_text(encoding='utf-8')
css = (base / 'styles.css').read_text(encoding='utf-8')
app = (base / 'app.js').read_text(encoding='utf-8')
questions = json.load(open(base / 'questions_officielles.json', encoding='utf-8'))

html = html.replace('<link rel="manifest" href="manifest.json">\n', '')
html = html.replace('<link rel="icon" href="icon-192.svg" type="image/svg+xml">\n', '')
html = html.replace('<link rel="apple-touch-icon" href="icon-192.svg">\n', '')
html = html.replace('<link rel="stylesheet" href="styles.css">', f'<style>\n{css}\n</style>')
app = app.replace("registerSW();\n    ", "")
app = app.replace('function registerSW() {\n  if (\'serviceWorker\' in navigator) navigator.serviceWorker.register(\'sw.js\').catch(() => {});\n}\n\n', '')
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
print('Built civique-offline.html')
