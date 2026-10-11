#!/usr/bin/env python3
"""Render the PNG brand assets in frontend/public/ with headless Chrome.

    python3 docs/redesign/tools/brand/brand_assets.py

Sources: frontend/public/favicon.svg (the mark), maskable.svg (full-bleed
variant for Android) and og-image.html (social preview). Needs Google Chrome
(override with CHROME_PATH), Python websocket-client and frontend/node_modules
for the fonts.
"""
import base64, json, os, shutil, subprocess, tempfile, time, urllib.request
from pathlib import Path

import websocket  # websocket-client

HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parents[3] / 'frontend' / 'public'
CHROME = os.environ.get('CHROME_PATH', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
PORT = int(os.environ.get('PARKSMART_BRAND_CDP_PORT', '9334'))


def main():
    profile = tempfile.mkdtemp()
    chrome = subprocess.Popen([CHROME, '--headless=new', f'--remote-debugging-port={PORT}', f'--user-data-dir={profile}',
                               '--no-first-run', '--hide-scrollbars', '--allow-file-access-from-files', 'about:blank'],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            try:
                targets = json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json', timeout=2)); break
            except Exception:
                time.sleep(0.2)
        page = next(t for t in targets if t['type'] == 'page')
        ws = websocket.create_connection(page['webSocketDebuggerUrl'], suppress_origin=True, max_size=None)
        counter = [0]

        def cdp(method, **params):
            counter[0] += 1
            ws.send(json.dumps({'id': counter[0], 'method': method, 'params': params}))
            while True:
                msg = json.loads(ws.recv())
                if msg.get('id') == counter[0]:
                    return msg.get('result', {})

        cdp('Page.enable')
        cdp('Emulation.setDefaultBackgroundColorOverride', color={'r': 0, 'g': 0, 'b': 0, 'a': 0})

        def shoot(url, out, width, height):
            cdp('Emulation.setDeviceMetricsOverride', width=width, height=height, deviceScaleFactor=1, mobile=False)
            cdp('Page.navigate', url=url)
            time.sleep(1.5)
            cdp('Runtime.evaluate', expression='document.fonts.ready', awaitPromise=True)
            shot = cdp('Page.captureScreenshot', format='png', clip={'x': 0, 'y': 0, 'width': width, 'height': height, 'scale': 1})
            out.write_bytes(base64.b64decode(shot['data']))
            print(f'{out.relative_to(PUBLIC.parent)}  {width}x{height}')

        def icon(svg, out, size):
            page_html = Path(profile) / f'icon-{size}.html'
            page_html.write_text(f'<html><body style="margin:0"><img src="{svg.as_uri()}" width="{size}" height="{size}" '
                                 f'style="display:block"></body></html>')
            shoot(page_html.as_uri(), out, size, size)

        mark = PUBLIC / 'favicon.svg'
        icon(mark, PUBLIC / 'favicon-32.png', 32)
        icon(mark, PUBLIC / 'apple-touch-icon.png', 180)
        icon(mark, PUBLIC / 'icon-192.png', 192)
        icon(mark, PUBLIC / 'icon-512.png', 512)
        icon(HERE / 'maskable.svg', PUBLIC / 'icon-maskable-512.png', 512)
        shoot((HERE / 'og-image.html').as_uri(), PUBLIC / 'og-image.png', 1200, 630)
        ws.close()
    finally:
        chrome.terminate()
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == '__main__':
    main()
