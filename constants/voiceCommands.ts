import type { VoiceIntent } from '@/types/voice';

/**
 * Intent detection patterns - order matters (more specific first)
 */
export const INTENT_PATTERNS: Array<{
  intent: VoiceIntent;
  patterns: RegExp[];
  priority: number;
}> = [
  // Timer commands (specific, check first)
  {
    intent: 'SET_TIMER',
    patterns: [
      /(?:set|start|begin)?\s*(?:a\s+)?timer?\s*(?:for\s+)?(\d+)\s*(min(?:ute)?s?|sec(?:ond)?s?|hours?)/i,
      /(\d+)\s*(min(?:ute)?s?|sec(?:ond)?s?)\s*timer/i,
    ],
    priority: 10,
  },
  {
    intent: 'CHECK_TIMER',
    patterns: [
      /how\s+(?:much\s+)?(?:time|long)\s*(?:is\s+)?(?:left|remaining)/i,
      /timer\s+status/i,
      /check\s+(?:the\s+)?timer/i,
    ],
    priority: 10,
  },
  {
    intent: 'STOP_TIMER',
    patterns: [
      /(?:stop|cancel|end|clear)\s+(?:the\s+)?timer/i,
      /timer\s+(?:off|stop)/i,
    ],
    priority: 10,
  },

  // Navigation commands
  {
    intent: 'NEXT_STEP',
    patterns: [
      /(?:next|continue|go\s+on|proceed|forward|and\s+then|what'?s?\s+next)/i,
      /(?:go\s+to\s+)?(?:the\s+)?next\s+(?:step|instruction)/i,
      /done|finished|complete(?:d)?|got\s+it|okay\s+next/i,
    ],
    priority: 5,
  },
  {
    intent: 'PREVIOUS_STEP',
    patterns: [
      /(?:previous|back|go\s+back|before|last|prior)\s*(?:step)?/i,
      /(?:go\s+to\s+)?(?:the\s+)?previous\s+(?:step|instruction)/i,
      /what\s+was\s+(?:the\s+)?(?:last|previous)/i,
    ],
    priority: 5,
  },
  {
    intent: 'REPEAT',
    patterns: [
      /(?:repeat|again|say\s+(?:that\s+)?again|reread|re-?read|one\s+more\s+time)/i,
      /(?:can\s+you\s+)?(?:please\s+)?repeat/i,
      /what\s+did\s+you\s+say/i,
      /i\s+didn'?t\s+(?:hear|catch|get)\s+that/i,
    ],
    priority: 5,
  },
  {
    intent: 'RESTART',
    patterns: [
      /(?:start|begin)\s+(?:over|from\s+(?:the\s+)?(?:beginning|start|top))/i,
      /(?:go\s+(?:back\s+)?to|back\s+to)\s+(?:the\s+)?(?:beginning|start|first)/i,
      /restart/i,
    ],
    priority: 5,
  },

  // Information commands
  {
    intent: 'INGREDIENT_QUERY',
    patterns: [
      // "How much X do I use/need?"
      /how\s+much\s+(.+?)\s+(?:do\s+i\s+(?:use|need)|should\s+i\s+(?:use|add))/i,
      // "How many X do I need?"
      /how\s+many\s+(.+?)\s+(?:do\s+i\s+(?:use|need)|should\s+i\s+(?:use|add))/i,
      // "What amount of X?"
      /what\s+(?:amount|quantity)\s+of\s+(.+)/i,
      // "How much X?" (simple form)
      /how\s+much\s+(.+?)(?:\?|$)/i,
    ],
    priority: 8, // Higher priority than READ_INGREDIENTS
  },
  {
    intent: 'TEMPERATURE_QUERY',
    patterns: [
      // "What heat do I set it to?"
      /what\s+heat\s+(?:do\s+i\s+(?:set|use)|should\s+i\s+(?:set|use))/i,
      /what\s+heat/i,
      // "What temperature?"
      /what\s+(?:temperature|temp)\s*(?:do\s+i\s+(?:set|use)|should\s+i\s+(?:set|use))?/i,
      // "How hot should it be?"
      /how\s+hot\s+(?:should|do)/i,
      // "What setting for the oven/stove?"
      /what\s+(?:oven|stove|burner)\s*(?:setting|temperature|temp|heat)/i,
      // "How high/low should the heat be?"
      /how\s+(?:high|low)\s+(?:should\s+)?(?:the\s+)?(?:heat|temperature|temp)/i,
      // "What level of heat?"
      /(?:what|which)\s+(?:level|setting)\s+(?:of\s+)?heat/i,
      // "Medium heat?" / "High heat?" etc.
      /(?:should\s+i\s+use\s+)?(?:low|medium|medium-high|high)\s+heat\??/i,
    ],
    priority: 8, // Same as INGREDIENT_QUERY
  },
  {
    intent: 'READ_INGREDIENTS',
    patterns: [
      /(?:what\s+(?:are\s+)?(?:the\s+)?)?ingredients/i,
      /what\s+do\s+i\s+need/i,
      /(?:read|list|tell\s+me)\s+(?:the\s+)?ingredients/i,
      /shopping\s+list/i,
    ],
    priority: 5,
  },
  {
    intent: 'READ_CURRENT_STEP',
    patterns: [
      /(?:read|what(?:'s|\s+is))\s+(?:the\s+)?current\s+step/i,
      /(?:read|repeat)\s+(?:this\s+)?step/i,
    ],
    priority: 5,
  },
  {
    intent: 'WHAT_STEP',
    patterns: [
      /what\s+step\s+(?:am\s+i\s+on|is\s+this)/i,
      /(?:which|what)\s+step/i,
      /where\s+(?:am\s+i|are\s+we)/i,
      /current\s+(?:step|progress)/i,
    ],
    priority: 5,
  },

  // Control commands
  {
    intent: 'STOP_SPEAKING',
    patterns: [
      /(?:stop|quiet|shut\s+up|silence|enough|okay\s+stop)/i,
      /(?:stop|cancel)\s+(?:speaking|talking|reading)/i,
    ],
    priority: 8,
  },
  {
    intent: 'PAUSE',
    patterns: [/(?:pause|wait|hold\s+on|one\s+(?:second|moment|sec))/i],
    priority: 5,
  },
  {
    intent: 'HELP',
    patterns: [
      /(?:what\s+can\s+(?:i|you)\s+(?:say|do)|help|commands)/i,
      /(?:voice\s+)?commands/i,
    ],
    priority: 5,
  },
];

export const VOICE_HELP_TEXT = `You can say: "Next step" or "Continue" to move forward. "Go back" or "Previous" to go back. "Repeat" to hear the current step again. "What step am I on" to know your progress. "Read ingredients" to hear the ingredient list. "Set timer for 5 minutes" to start a timer. "Stop" to cancel speaking.`;

export const FALLBACK_RESPONSES = {
  notUnderstood:
    "Sorry, I didn't catch that. Try saying 'next step' or 'repeat'.",
  noRecipe: 'No recipe is loaded. Please select a recipe first.',
  firstStep: "You're already at the first step.",
  lastStep: "That's the last step! Your dish should be ready.",
  error: 'Sorry, something went wrong. Please try again.',
};

export const COOK_MODE_COPY = {
  title: 'Cook Mode',
  step: 'Step',
  of: 'of',
  ingredients: 'Ingredients',
  readIngredients: 'Read Ingredients',
  voiceAssistant: 'Voice Assistant',
  voiceEnabled: 'Voice Enabled',
  voiceDisabled: 'Tap to Enable Voice',
  listening: 'Listening...',
  processing: 'Processing...',
  speaking: 'Speaking...',
  tapToSpeak: 'Tap to speak',
  exit: 'Exit Cook Mode',
  exitConfirm: 'Are you sure you want to exit cook mode?',
  timer: {
    set: 'Set Timer',
    remaining: 'remaining',
    done: "Time's up!",
  },
  swipeHint: 'Swipe to navigate steps',
};
