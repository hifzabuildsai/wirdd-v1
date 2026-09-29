// Count repeats in one final segment; a time debounce would hide fast recitations.
export function countPhrases(transcript: string): number {
  const normalized = transcript.toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/\s+/g, ' ');
  const arabic = normalized.match(/(?:^|[^ء-ي])استغفر\s*الله(?=$|[^ء-ي])/g) ?? [];
  const latin = normalized.match(/(?:^|[^a-z])ast(?:a|)gh?firullah(?:al\s+azeem)?(?=$|[^a-z])/g) ?? [];
  return arabic.length + latin.length;
}
