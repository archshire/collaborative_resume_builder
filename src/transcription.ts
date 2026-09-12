/** Commit each result before marking it complete; retries skip only saved results. */
export async function transcribeBatch<T extends { transcribed?: boolean }>(
  files: T[],
  transcribe: (file: T, index: number) => Promise<unknown>,
  commit: (file: T, text: string, index: number) => void,
): Promise<void> {
  for (const [index, file] of files.entries()) {
    if (file.transcribed) continue;
    const result = await transcribe(file, index);
    if (typeof result !== 'string' || !result.trim()) {
      throw new Error('The transcription provider returned an empty or invalid transcript. Please retry.');
    }
    commit(file, result.trim(), index);
    file.transcribed = true;
  }
}
