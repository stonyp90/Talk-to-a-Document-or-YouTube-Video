import type { Message } from "./useConversation";

const TOPIC_KEYWORDS: Record<string, string[]> = {
  greeting: ["hello", "hi", "hey", "good morning", "good evening"],
  help: ["help", "how", "what", "can you", "explain"],
  confirm: ["yes", "sure", "ok", "great", "perfect", "thanks", "thank you"],
  negative: ["no", "stop", "cancel", "never mind", "forget it"],
};

const PLANET_REPLIES: Record<string, { fallback: string; topics: Record<string, string> }> = {
  Discover: {
    fallback: "Tell me more about what you're curious about.",
    topics: {
      greeting: "Welcome. What catches your attention?",
      help: "I can help you explore. What direction feels right?",
      confirm: "Good. Let's keep going.",
      negative: "No problem. We can look somewhere else.",
    },
  },
  Design: {
    fallback: "Interesting. What should the experience feel like?",
    topics: {
      greeting: "Ready to shape something. What's the vision?",
      help: "Let's think through it. What's the core interaction?",
      confirm: "That works. What's the next piece?",
      negative: "Let's try a different angle.",
    },
  },
  Plan: {
    fallback: "What's the first step?",
    topics: {
      greeting: "Let's map it out. What are we planning?",
      help: "Break it down. What's the outcome we need?",
      confirm: "On track. What's the timeline?",
      negative: "We can simplify. What matters most?",
    },
  },
  Build: {
    fallback: "What do we need to make it real?",
    topics: {
      greeting: "Tools ready. What are we building?",
      help: "Start with the core. What's the smallest working piece?",
      confirm: "Good progress. What's next?",
      negative: "Let's step back and reassess.",
    },
  },
  Test: {
    fallback: "What edge case should we check?",
    topics: {
      greeting: "Testing mode. What's the scenario?",
      help: "Define the expected behavior first. What should happen?",
      confirm: "Passing. What else could break?",
      negative: "Skip that test. What's more important?",
    },
  },
  Deploy: {
    fallback: "Where does this need to go?",
    topics: {
      greeting: "Ready to ship. What's the target?",
      help: "Check the prerequisites. Is everything green?",
      confirm: "Deployed. Monitoring now.",
      negative: "Holding. Let's verify first.",
    },
  },
  Monitor: {
    fallback: "What signal are we watching?",
    topics: {
      greeting: "Eyes on it. What matters right now?",
      help: "Check the key metrics. Anything unusual?",
      confirm: "Looking good. Keep watching.",
      negative: "Ignoring that alert. What else?",
    },
  },
  Learn: {
    fallback: "What do you want to understand deeper?",
    topics: {
      greeting: "Curious mind. What's the question?",
      help: "Let's break it down. What do you already know?",
      confirm: "Got it. Want to go further?",
      negative: "Moving on. What's the next question?",
    },
  },
  Iterate: {
    fallback: "What would make this better?",
    topics: {
      greeting: "Let's improve it. What's not working?",
      help: "Start with feedback. What did users say?",
      confirm: "Good iteration. Test it again?",
      negative: "Keep it as is. What's the next priority?",
    },
  },
};

function matchTopic(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return topic;
  }
  return null;
}

export function generateReply(planetName: string, userMessage: string): string {
  const config = PLANET_REPLIES[planetName];
  if (!config) return "I'm listening.";
  const topic = matchTopic(userMessage);
  if (topic && config.topics[topic]) return config.topics[topic];
  return config.fallback;
}
