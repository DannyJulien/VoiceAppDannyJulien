import type { UnderstoodAction } from '@/features/actions/action-schema';

export function shouldOfferResearch(action: UnderstoodAction) {
  return (
    action.couldBenefitFromResearch ||
    action.intent === 'question' ||
    action.intent === 'statement' ||
    action.intent === 'research_request'
  );
}

export function researchPrompt(action: UnderstoodAction) {
  return action.researchReason ?? 'This could be stronger with reliable, recent information.';
}

export function trustTierLabel(tier: number) {
  if (tier === 1) return 'Primary source';
  if (tier === 2) return 'Research source';
  if (tier === 3) return 'Established publication';
  if (tier === 4) return 'Official organisation';
  return 'Context source';
}
