"""Inspect APK packaging and metadata without an Android SDK. No signing verification."""
import argparse
import hashlib
import json
import struct
import zipfile
from pathlib import Path


def u32(data, offset):
    return struct.unpack_from('<I', data, offset)[0]


def manifest_attributes(data):
    strings = []
    result = []
    offset = 8
    while offset < len(data):
        kind, header, size = struct.unpack_from('<HHI', data, offset)
        if not size:
            raise ValueError('Invalid binary manifest chunk')
        if kind == 1:
            count, _, flags, start, _ = struct.unpack_from('<IIIII', data, offset + 8)
            for i in range(count):
                cursor = offset + start + u32(data, offset + header + i * 4)
                def length(at, utf8):
                    if utf8:
                        first = data[at]
                        return (((first & 127) << 8) | data[at + 1], at + 2) if first & 128 else (first, at + 1)
                    first = struct.unpack_from('<H', data, at)[0]
                    return (((first & 32767) << 16) | struct.unpack_from('<H', data, at + 2)[0], at + 4) if first & 32768 else (first, at + 2)
                if flags & 256:
                    _, cursor = length(cursor, True)
                    n, cursor = length(cursor, True)
                    strings.append(data[cursor:cursor + n].decode('utf-8'))
                else:
                    n, cursor = length(cursor, False)
                    strings.append(data[cursor:cursor + 2 * n].decode('utf-16le'))
        elif kind == 0x102:
            ext = offset + header
            _, name, attribute_start, attribute_size, count = struct.unpack_from('<IIHHH', data, ext)
            attributes = {}
            for i in range(count):
                at = ext + attribute_start + attribute_size * i
                _, key, raw, _, _, value_type, value = struct.unpack_from('<IIIHBBI', data, at)
                if raw != 0xffffffff:
                    parsed = strings[raw]
                elif value_type == 3:
                    parsed = strings[value]
                elif value_type == 18:
                    parsed = bool(value)
                else:
                    parsed = value
                attributes[strings[key]] = parsed
            result.append({'tag': strings[name], 'attributes': attributes})
        offset += size
    return result


def length_prefixed(data, offset=0):
    size = u32(data, offset)
    return data[offset + 4:offset + 4 + size], offset + 4 + size


def signing_certificates(data):
    # APK Signature Scheme v2: signing block immediately precedes ZIP central directory.
    eocd = data.rfind(b'PK\x05\x06')
    if eocd < 0:
        return []
    central = u32(data, eocd + 16)
    if data[central - 16:central] != b'APK Sig Block 42':
        return []
    size = struct.unpack_from('<Q', data, central - 24)[0]
    at = central - size - 8
    if struct.unpack_from('<Q', data, at)[0] != size:
        raise ValueError('APK signing block size mismatch')
    cursor = at + 8
    certificates = []
    while cursor < central - 24:
        pair_size = struct.unpack_from('<Q', data, cursor)[0]
        pair_id = u32(data, cursor + 8)
        if pair_id == 0x7109871a:
            signers, _ = length_prefixed(data[cursor + 12:cursor + 8 + pair_size])
            signer_at = 0
            while signer_at < len(signers):
                signer, signer_at = length_prefixed(signers, signer_at)
                signed, _ = length_prefixed(signer)
                _, cert_at = length_prefixed(signed)
                certs, _ = length_prefixed(signed, cert_at)
                cert_cursor = 0
                while cert_cursor < len(certs):
                    cert, cert_cursor = length_prefixed(certs, cert_cursor)
                    certificates.append(hashlib.sha256(cert).hexdigest())
        cursor += 8 + pair_size
    return certificates


def inspect(path):
    data = Path(path).read_bytes()
    with zipfile.ZipFile(path) as archive:
        broken = archive.testzip()
        if broken:
            raise ValueError(f'Corrupt ZIP member: {broken}')
        entries = archive.namelist()
        tags = manifest_attributes(archive.read('AndroidManifest.xml'))
        find = lambda name: [t['attributes'] for t in tags if t['tag'] == name]
        return {
            'filename': Path(path).name,
            'bytes': len(data),
            'sha256': hashlib.sha256(data).hexdigest(),
            'zip_crc_valid': True,
            'manifest': find('manifest')[0],
            'sdk': find('uses-sdk'),
            'permissions': find('uses-permission'),
            'application': find('application'),
            'abis': sorted({p.split('/')[1] for p in entries if p.startswith('lib/') and p.endswith('.so')}),
            'bundled_js': any(p.endswith('index.android.bundle') for p in entries),
            'v2_certificate_sha256': signing_certificates(data),
            'note': 'Certificate fingerprints extracted only; cryptographic signature verification and device installation are still required.',
        }


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('apk')
    parser.add_argument('--output')
    args = parser.parse_args()
    result = json.dumps(inspect(args.apk), indent=2, ensure_ascii=False)
    if args.output:
        Path(args.output).write_text(result + '\n', encoding='utf-8')
    print(result)
