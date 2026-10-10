"""ADB install/manual-history smoke test on a fresh CI emulator; no voice proof."""
import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE = 'app.wirdd.android'
OUT = Path('outputs/native-smoke')
OUT.mkdir(parents=True, exist_ok=True)


def adb(*args):
    result = subprocess.run(['adb', *args], text=True, capture_output=True, timeout=90)
    with (OUT / 'adb.log').open('a') as log:
        log.write(f'adb {" ".join(args)}\n{result.stdout}\n{result.stderr}\n')
    result.check_returncode()
    return result.stdout


def dump():
    adb('shell', 'uiautomator', 'dump', '/sdcard/wirdd-ui.xml')
    adb('pull', '/sdcard/wirdd-ui.xml', str(OUT / 'ui.xml'))
    return ET.parse(OUT / 'ui.xml').getroot()


def wait_for(predicate, seconds=45):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        root = dump()
        node = next((node for node in root.iter('node') if predicate(node)), None)
        if node is not None:
            return node
        time.sleep(1)
    raise AssertionError('Expected UI did not appear; inspect ui.xml and logcat.txt')


def label(node, value):
    return node.get('text') == value or node.get('content-desc') == value


def tap(value):
    node = wait_for(lambda node: label(node, value))
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds', '')))
    adb('shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))


def launch():
    adb('shell', 'am', 'start', '-W', '-n', PACKAGE + '/.MainActivity')


def screenshot(name):
    result = subprocess.run(['adb', 'exec-out', 'screencap', '-p'], capture_output=True, timeout=30, check=True)
    (OUT / name).write_bytes(result.stdout)


def counter(value):
    wait_for(lambda node: label(node, str(value)))


def manual_session():
    tap('Start manual count')
    for value in range(1, 4):
        tap('Add one count')
        counter(value)
    tap('End and save session')
    tap('Skip')
    wait_for(lambda node: label(node, 'TODAY'))
    counter(3)


def run(baseline, candidate):
    # Fresh emulator only: installer output is retained verbatim.
    if adb('shell', 'getprop', 'ro.kernel.qemu').strip() != '1':
        raise RuntimeError('This destructive smoke test requires a disposable Android emulator.')
    adb('logcat', '-c')
    adb('shell', 'svc', 'wifi', 'disable')
    adb('shell', 'svc', 'data', 'disable')
    adb('install', baseline)
    launch()
    tap('Skip')
    manual_session()
    screenshot('baseline-history.png')
    adb('shell', 'am', 'force-stop', PACKAGE)
    adb('install', '-r', candidate)
    launch()
    tap('Dashboard')
    wait_for(lambda node: label(node, 'TODAY'))
    counter(3)
    screenshot('upgraded-history.png')
    adb('shell', 'am', 'force-stop', PACKAGE)
    launch()
    tap('Dashboard')
    wait_for(lambda node: label(node, 'TODAY'))
    counter(3)
    screenshot('restarted-history.png')
    adb('shell', 'pidof', PACKAGE)
    # Destructive only to this disposable emulator, after upgrade preservation
    # has already passed. Never run this against an owner's physical phone.
    adb('uninstall', PACKAGE)
    adb('install', candidate)
    launch()
    tap('Skip')
    manual_session()
    screenshot('candidate-clean-install.png')
    (OUT / 'result.json').write_text(json.dumps({
        'android_api': 31,
        'baseline_install': 'passed',
        'candidate_clean_install': 'passed',
        'candidate_upgrade_preserved_count': 3,
        'restart_preserved_count': 3,
        'voice_accuracy': 'not tested',
        'physical_device': False,
    }, indent=2) + '\n')


try:
    run(*sys.argv[1:])
finally:
    (OUT / 'logcat.txt').write_text(adb('logcat', '-d'), encoding='utf-8')
