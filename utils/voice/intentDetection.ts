import type { VoiceIntent, IntentResult } from '@/types/voice';
import { INTENT_PATTERNS } from '@/constants/voiceCommands';

/**
 * Detect intent from transcribed text using pattern matching.
 * This is FREE - no API calls needed for common commands.
 */
export function detectIntent(transcript: string): IntentResult {
  const normalizedText = transcript.toLowerCase().trim();

  // Check each intent pattern in priority order
  const sortedPatterns = [...INTENT_PATTERNS].sort(
    (a, b) => b.priority - a.priority
  );

  for (const { intent, patterns } of sortedPatterns) {
    for (const pattern of patterns) {
      const match = normalizedText.match(pattern);
      if (match) {
        // Extract parameters if present
        const params = extractParams(intent, match);

        return {
          intent,
          confidence: 0.9,
          params,
          rawTranscript: transcript,
        };
      }
    }
  }

  // No match found
  return {
    intent: 'UNKNOWN',
    confidence: 0,
    params: { query: transcript },
    rawTranscript: transcript,
  };
}

/**
 * Extract parameters from matched pattern
 */
function extractParams(
  intent: VoiceIntent,
  match: RegExpMatchArray
): IntentResult['params'] {
  switch (intent) {
    case 'SET_TIMER': {
      const amount = parseInt(match[1] ?? '0', 10);
      const unit = (match[2] ?? '').toLowerCase();

      if (unit.startsWith('hour')) {
        return { timerMinutes: amount * 60, timerSeconds: 0 };
      } else if (unit.startsWith('sec')) {
        return { timerMinutes: 0, timerSeconds: amount };
      } else {
        return { timerMinutes: amount, timerSeconds: 0 };
      }
    }

    default:
      return undefined;
  }
}

/**
 * Check if the query might need more complex processing
 */
export function isComplexQuery(intentResult: IntentResult): boolean {
  if (intentResult.intent === 'UNKNOWN') {
    const cookingKeywords = [
      'substitute',
      'replace',
      'instead',
      'alternative',
      'done',
      'ready',
      'looks like',
      'should',
      'temperature',
      'degrees',
      'how long',
      'how much',
      'what does',
      'what is',
      'why',
      'can i',
      'should i',
    ];

    const text = intentResult.rawTranscript.toLowerCase();
    return cookingKeywords.some((keyword) => text.includes(keyword));
  }

  return false;
}
