import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, stat, rename, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const models = JSON.parse(await readFile(new URL('./voice-models.json', import.meta.url), 'utf8'));
const directory = new URL('../assets/models/', import.meta.url);
await mkdir(directory, { recursive: true });
async function valid(file, model) {
  try {
    if ((await stat(file)).size !== model.bytes) return false;
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    return hash.digest('hex') === model.sha256;
  } catch { return false; }
}
for (const model of models) {
  const target = new URL(model.file, directory);
  if (await valid(target, model)) { console.log(`Verified ${model.file}`); continue; }
  const partial = new URL(`${model.file}.partial`, directory);
  console.log(`Downloading ${model.file} (${model.bytes} bytes)`);
  const response = await fetch(model.url, { signal: AbortSignal.timeout(300000) });
  if (!response.ok || !response.body) throw new Error(`Model download failed: HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
  if (!await valid(partial, model)) {
    await rm(partial, { force: true });
    throw new Error(`Model checksum mismatch: ${model.file}`);
  }
  await rename(partial, target);
  console.log(`Verified ${fileURLToPath(target)}`);
}
