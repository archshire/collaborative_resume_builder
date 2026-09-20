const { string } = require('./validation.cjs');

// One interview question per request. The cap keeps a paid endpoint from being used as a general speech service.
const MAX_SPEECH_CHARACTERS = 800;
const MAX_SPEECH_BYTES = 4 * 1024 * 1024;
// Voices offered by the OpenAI speech endpoint. An unknown value is rejected before any provider call.
const VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'];
const DEFAULT_VOICE = 'alloy';

function speechInput(body) {
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const text = string(source.text, 'text', MAX_SPEECH_CHARACTERS);
  const requested = source.voice === undefined || source.voice === '' ? DEFAULT_VOICE : string(source.voice, 'voice', 40);
  if (!VOICES.includes(requested)) {
    throw new Error(`Invalid voice: expected one of ${VOICES.join(', ')}.`);
  }
  return { text, voice: requested };
}

module.exports = { speechInput, MAX_SPEECH_CHARACTERS, MAX_SPEECH_BYTES, VOICES, DEFAULT_VOICE };
