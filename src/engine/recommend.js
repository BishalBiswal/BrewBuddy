import brewRules from '../data/brew_rules.json';
import { generateBrewIntent, analyzeCoffee } from './brew-intent';

const methodSuggestions = brewRules.method_suggestions;

function normalizeTastingNotes(tastingNotes) {
  if (!tastingNotes || !Array.isArray(tastingNotes) || tastingNotes.length === 0) {
    return [];
  }
  const tags = tastingNotes.flatMap(note => {
    if (typeof note !== 'string') return [];
    return note.toLowerCase().split(/[\s,;()]+/).filter(t => t.length > 0);
  });
  return [...new Set(tags)];
}

function scoreSuggestion(suggestion, userRoastLevel, userProcess, tags) {
  const rule = methodSuggestions.find(r =>
    r.roast_level === userRoastLevel &&
    (userProcess === null || userProcess === undefined || r.process === 'any' || r.process === userProcess)
  );
  if (!rule) return null;

  if (rule.process !== 'any' && rule.process !== userProcess) return null;

  const tagScore = tags.filter(t => (rule.tasting_tags || []).includes(t)).length;
  return {
    ...suggestion,
    match_score: tagScore,
    total_tags: rule.tasting_tags.length || 1,
  };
}

export function suggestBrewMethods(roastLevel, process, tastingNotes) {
  const normalizedRoast = (roastLevel || '').toLowerCase().trim();
  const normalizedProcess = (process || '').toLowerCase().trim() || null;
  const tags = normalizeTastingNotes(tastingNotes);

  let candidates = [];
  for (const rule of methodSuggestions) {
    const ruleRoast = rule.roast_level;
    const ruleProcess = rule.process;

    if (ruleRoast !== normalizedRoast) continue;
    if (ruleProcess !== 'any' && normalizedProcess && ruleProcess !== normalizedProcess) continue;
    if (ruleProcess === 'any' && normalizedProcess && !['any', normalizedProcess].includes(ruleProcess)) continue;

    const tagScore = tags.filter(t => (rule.tasting_tags || []).includes(t)).length;
    const maxTagScore = rule.tasting_tags ? rule.tasting_tags.length : 1;

    for (const suggestion of rule.suggestions) {
      candidates.push({
        brewer_id: suggestion.brewer_id,
        rationale: suggestion.rationale,
        match_score: tagScore,
        max_tag_score: maxTagScore,
      });
    }
  }

  candidates.sort((a, b) => {
    if (b.match_score !== a.match_score) return b.match_score - a.match_score;
    if (b.max_tag_score !== a.max_tag_score) return b.max_tag_score - a.max_tag_score;
    return 0;
  });

  const seen = new Set();
  const deduped = [];
  for (const c of candidates) {
    if (!seen.has(c.brewer_id)) {
      seen.add(c.brewer_id);
      deduped.push(c);
    }
  }

  return deduped;
}

export function recommendAndAnalyze(coffeeData) {
  const analysis = analyzeCoffee(coffeeData);
  const brewIntent = generateBrewIntent(coffeeData);
  const roastLevel = coffeeData.roastLevel || coffeeData.roast_level || '';
  const process = coffeeData.process || '';
  const tastingNotes = coffeeData.tastingNotes || coffeeData.tasting_notes || [];
  const suggestions = suggestBrewMethods(roastLevel, process, tastingNotes);

  return {
    analysis,
    brewIntent,
    suggestions,
  };
}

export { generateBrewIntent, analyzeCoffee };
