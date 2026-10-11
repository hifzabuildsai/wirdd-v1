"""Verify pinned offline weights and MIT notices inside the built APK."""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path


def inspect(apk):
    expected = json.loads(Path(__file__).with_name('voice-models.json').read_text())
    with zipfile.ZipFile(apk) as archive:
        binaries = {
            entry: hashlib.sha256(archive.read(entry)).hexdigest()
            for entry in archive.namelist() if entry.endswith('.bin')
        }
        models = []
        for model in expected:
            matches = [entry for entry, sha in binaries.items() if sha == model['sha256']]
            if len(matches) != 1 or archive.getinfo(matches[0]).file_size != model['bytes']:
                raise ValueError(f"Missing or mismatched bundled model: {model['file']}")
            models.append({'model': model['file'], 'entry': matches[0], 'sha256': model['sha256'], 'bytes': model['bytes']})
        notices = []
        for name in ('whisper.txt', 'whisper-cpp.txt', 'whisper-rn.txt', 'silero-vad.txt'):
            entry = 'assets/' + name
            if 'Permission is hereby granted' not in archive.read(entry).decode():
                raise ValueError(f'Missing MIT notice: {name}')
            notices.append(entry)
        return {'models': models, 'notices': notices, 'status': 'passed'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('apk')
    parser.add_argument('--output')
    args = parser.parse_args()
    report = json.dumps(inspect(args.apk), indent=2)
    if args.output:
        target = Path(args.output)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(report + '\n', encoding='utf-8')
    print(report)
