import React, { useState, useCallback, useMemo } from 'react';
import PacketForm from './components/PacketForm';
import EquipmentPicker from './components/EquipmentPicker';
import FlavorFocusPicker from './components/FlavorFocusPicker';
import RecipeCard from './components/RecipeCard';
import { suggestBrewMethods } from './engine/recommend';
import { baseRecipe, adjustForFlavorFocus } from './engine/recipe';
import { generateRecipeFromLLM } from './engine/llm-recipe';
import { translateGrindToGrinder, calibrateCustomGrinder } from './engine/grind';
import { buildFullRationale } from './engine/rationale';
import brewers from './data/brewers.json';

const STEPS = ['packet', 'equipment', 'flavor', 'recipe'];

const initialPacket = {
  coffeeName: '',
  roaster: '',
  originCountry: '',
  region: '',
  roastLevel: '',
  process: '',
  tastingNotes: [],
  altitudeM: null,
  roastDate: '',
};

export default function App() {
  const [step, setStep] = useState('packet');
  const [packet, setPacket] = useState(initialPacket);
  const [selectedBrewer, setSelectedBrewer] = useState(null);
  const [selectedGrinder, setSelectedGrinder] = useState(null);
  const [batchSizeMl, setBatchSizeMl] = useState(250);
  const [flavorFocus, setFlavorFocus] = useState('balanced');
  const [showCalibration, setShowCalibration] = useState(false);
  const [recipe, setRecipe] = useState(null);
  const [rationale, setRationale] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [recipeStatus, setRecipeStatus] = useState('');
  const [recipeWarning, setRecipeWarning] = useState('');

  const brewerSuggestions = useMemo(() => {
    const brewerMap = {};
    brewers.forEach(b => { brewerMap[b.id] = b.name; });
    return suggestBrewMethods(packet.roastLevel, packet.process, packet.tastingNotes).map(s => ({
      ...s,
      brewer_name: brewerMap[s.brewer_id] || s.brewer_id,
    }));
  }, [packet.roastLevel, packet.process, packet.tastingNotes]);
  const handlePacketSubmit = useCallback(() => {
    if (!packet.roastLevel) return;
    setStep('equipment');
  }, [packet.roastLevel]);

  const handleEquipmentSubmit = useCallback(() => {
    if (!selectedBrewer || !selectedGrinder) return;
    setStep('flavor');
  }, [selectedBrewer, selectedGrinder]);

  const handleCalibrationSave = useCallback((cal) => {
    const custom = calibrateCustomGrinder(
      cal.fineSetting, cal.fineLabel,
      cal.coarseSetting, cal.coarseLabel,
      cal.stepSize
    );
    setSelectedGrinder(custom);
    setShowCalibration(false);
  }, []);

  const buildFallbackRecipe = useCallback(() => {
    const base = baseRecipe(selectedBrewer);
    const adjusted = adjustForFlavorFocus(base, flavorFocus, batchSizeMl);

    const grindSetting = translateGrindToGrinder(adjusted.grind_relative, selectedGrinder);
    adjusted.grind_grinder_setting = grindSetting;

    const brewSugs = suggestBrewMethods(packet.roastLevel, packet.process, packet.tastingNotes);
    const brewerMap = {};
    brewers.forEach(b => { brewerMap[b.id] = b.name; });
    const enrichedSugs = brewSugs.map(s => ({
      ...s,
      brewer_name: brewerMap[s.brewer_id] || s.brewer_id,
    }));

    const rat = buildFullRationale(
      packet.roastLevel, packet.process, packet.tastingNotes,
      selectedBrewer, flavorFocus, base, adjusted
    );

    return {
      recipe: adjusted,
      rationale: rat,
      suggestions: enrichedSugs.filter(s => s.brewer_id !== selectedBrewer),
    };
  }, [selectedBrewer, selectedGrinder, flavorFocus, batchSizeMl, packet]);

  const handleGenerateRecipe = useCallback(async () => {
    setRecipeStatus('Generating a custom recipe from the scanned coffee details...');
    setRecipeWarning('');

    const coffeeData = {
      coffee_name: packet.coffeeName,
      roaster: packet.roaster,
      origin_country: packet.originCountry,
      region: packet.region,
      roast_level: packet.roastLevel,
      process: packet.process,
      tasting_notes: packet.tastingNotes,
      altitude_m: packet.altitudeM,
      roast_date: packet.roastDate,
    };

    try {
      const generated = await generateRecipeFromLLM({
        coffee_data: coffeeData,
        brewer_id: selectedBrewer,
        batch_size_ml: batchSizeMl,
        flavor_focus: flavorFocus,
        selected_grinder: selectedGrinder,
      });
      const nextRecipe = { ...generated.recipe };
      if (selectedGrinder && !nextRecipe.grind_grinder_setting) {
        nextRecipe.grind_grinder_setting = translateGrindToGrinder(nextRecipe.grind_relative, selectedGrinder);
      }
      setRecipe(nextRecipe);
      setRationale(generated.rationale || '');
      setSuggestions(generated.suggestions || []);
    } catch (err) {
      const fallback = buildFallbackRecipe();
      setRecipe(fallback.recipe);
      setRationale(fallback.rationale);
      setSuggestions(fallback.suggestions);
      setRecipeWarning(`Online recipe generation failed, so a rule-based fallback was used. ${err.message || ''}`.trim());
    } finally {
      setRecipeStatus('');
      setStep('recipe');
    }
  }, [packet, selectedBrewer, selectedGrinder, batchSizeMl, flavorFocus, buildFallbackRecipe]);

  const handleFlavorSubmit = useCallback(() => {
    handleGenerateRecipe();
  }, [handleGenerateRecipe]);

  const handleReset = useCallback(() => {
    setStep('packet');
    setPacket(initialPacket);
    setSelectedBrewer(null);
    setSelectedGrinder(null);
    setBatchSizeMl(250);
    setFlavorFocus('balanced');
    setShowCalibration(false);
    setRecipe(null);
    setRationale('');
    setSuggestions([]);
    setRecipeStatus('');
    setRecipeWarning('');
  }, []);

  const goBack = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }, [step]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Brew Buddy</h1>
        <p className="tagline">Coffee brewing recommendations, powered by your specs</p>
        <div className="step-indicator">
          {STEPS.filter(s => s !== 'recipe').map((s, i) => (
            <span key={s} className={`step-dot ${STEPS.indexOf(step) >= i ? 'active' : ''} ${STEPS.indexOf(step) > i ? 'done' : ''}`} />
          ))}
        </div>
      </header>

      <main className="app-main">
        {step === 'packet' && (
          <PacketForm packet={packet} onChange={setPacket} onSubmit={handlePacketSubmit} />
        )}

        {step === 'equipment' && (
          <EquipmentPicker
            selectedBrewer={selectedBrewer}
            selectedGrinder={selectedGrinder}
            batchSizeMl={batchSizeMl}
            showCalibration={showCalibration}
            brewerSuggestions={brewerSuggestions}
            onBrewerChange={setSelectedBrewer}
            onGrinderChange={setSelectedGrinder}
            onBatchSizeChange={setBatchSizeMl}
            onShowCalibration={setShowCalibration}
            onCalibrationSave={handleCalibrationSave}
            onBack={goBack}
            onSubmit={handleEquipmentSubmit}
          />
        )}

        {step === 'flavor' && (
          <FlavorFocusPicker
            selected={flavorFocus}
            onChange={setFlavorFocus}
            onBack={goBack}
            onSubmit={handleFlavorSubmit}
            isSubmitting={Boolean(recipeStatus)}
          />
        )}

        {recipeStatus && <p className="recipe-status">{recipeStatus}</p>}

        {step === 'recipe' && recipe && (
          <RecipeCard
            recipe={recipe}
            rationale={rationale}
            suggestions={suggestions}
            warning={recipeWarning}
            onBack={goBack}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
}


