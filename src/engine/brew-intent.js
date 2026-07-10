import { analyzeCoffee, detectPremiumCoffee, isCompetitionGrade } from './coffee-analysis';

const INTENT_WEIGHTS = {
  fruitForward: ['fruitiness_score'],
  comfortCup: ['body_score', 'sweetness_score'],
  gentleExtraction: ['premium_score', 'clarity_score'],
  highExtraction: ['processing_intensity', 'body_score'],
  lowAgitation: ['fermentation_score', 'clarity_score'],
  highAgitation: ['body_score', 'processing_intensity'],
  experimental: ['fermentation_score', 'complexity_score', 'processing_intensity'],
};

export function generateBrewIntent(coffeeData, flavorFocus) {
  const analysis = analyzeCoffee(coffeeData);
  const isPremium = detectPremiumCoffee(analysis);
  const isCompGrade = isCompetitionGrade(analysis);

  const clarityPriority = Math.round(
    (analysis.clarity_score * 0.5 +
      (analysis.floral_score > 6 ? 2 : 0) +
      (analysis.processing_intensity < 5 ? 1 : 0)) * 10
  ) / 10;

  const sweetnessPriority = Math.round(
    (analysis.sweetness_score * 0.5 +
      (analysis.fruitiness_score > 6 ? 1.5 : 0) +
      (analysis.body_score > 6 ? 1 : 0)) * 10
  ) / 10;

  const bodyPriority = Math.round(
    (analysis.body_score * 0.6 +
      (analysis.processing_intensity > 5 ? 1.5 : 0) +
      (analysis.expected_solubility > 0.6 ? 1 : 0)) * 10
  ) / 10;

  const rawIntents = {
    clarityPriority: Math.min(10, Math.max(1, clarityPriority)),
    sweetnessPriority: Math.min(10, Math.max(1, sweetnessPriority)),
    bodyPriority: Math.min(10, Math.max(1, bodyPriority)),
    competitionStyle: isCompGrade || (analysis.premium_score >= 6 && analysis.clarity_score >= 6),
    premiumCoffee: isPremium,
    gentleExtraction: isPremium && analysis.processing_intensity < 6,
    highExtraction: !isPremium && analysis.body_score >= 5,
    lowAgitation: analysis.fermentation_score >= 6 || (analysis.clarity_score >= 7 && isPremium),
    highAgitation: analysis.body_score >= 6 && analysis.processing_intensity >= 5 && !isPremium,
    fruitForward: analysis.fruitiness_score >= 6,
    comfortCup: analysis.sweetness_score >= 6 && analysis.body_score >= 5 && !isCompGrade,
    experimental: analysis.fermentation_score >= 7 && analysis.complexity_score >= 6,
  };

  return applyFlavorFocusModifiers(rawIntents, flavorFocus, analysis);
}

function applyFlavorFocusModifiers(intent, flavorFocus, analysis) {
  const modified = { ...intent };

  switch (flavorFocus) {
    case 'brighter_acidity':
      modified.clarityPriority = Math.min(10, modified.clarityPriority + 2);
      modified.bodyPriority = Math.max(1, modified.bodyPriority - 2);
      modified.comfortCup = false;
      break;
    case 'more_sweetness_body':
      modified.sweetnessPriority = Math.min(10, modified.sweetnessPriority + 2);
      modified.bodyPriority = Math.min(10, modified.bodyPriority + 2);
      modified.comfortCup = true;
      modified.gentleExtraction = false;
      break;
    case 'reduce_bitterness':
      modified.gentleExtraction = true;
      modified.lowAgitation = true;
      modified.highExtraction = false;
      modified.highAgitation = false;
      break;
    case 'balanced':
      break;
  }

  return modified;
}

export { analyzeCoffee };
