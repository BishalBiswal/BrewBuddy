import { describe, it, expect } from 'vitest';
import { suggestBrewMethods } from '../engine/recommend';

describe('suggestBrewMethods', () => {
  it('returns empty array for unknown roast level', () => {
    const result = suggestBrewMethods('unknown', 'washed', ['floral']);
    expect(result).toEqual([]);
  });

  it('suggests V60 and Aeropress for light roast washed with floral notes', () => {
    const result = suggestBrewMethods('light', 'washed', ['floral', 'citrus']);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].brewer_id).toBe('v60');
    expect(result[1].brewer_id).toBe('aeropress');
  });

  it('returns fallback for light roast any process when no specific match', () => {
    const result = suggestBrewMethods('light', 'washed', []);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].brewer_id).toBe('v60');
  });

  it('suggests French Press and Moka Pot for dark roast', () => {
    const result = suggestBrewMethods('dark', 'any', ['chocolate']);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(r => r.brewer_id === 'french_press')).toBe(true);
    expect(result.some(r => r.brewer_id === 'moka_pot')).toBe(true);
  });

  it('suggests espresso machine for espresso blend', () => {
    const result = suggestBrewMethods('espresso_blend', 'washed', []);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].brewer_id).toBe('espresso');
  });

  it('sorts by match score descending', () => {
    const result = suggestBrewMethods('light', 'washed', ['floral', 'citrus']);
    expect(result[0].match_score).toBeGreaterThanOrEqual(result[result.length - 1].match_score);
  });

  it('handles null tastingNotes gracefully', () => {
    const result = suggestBrewMethods('light', 'washed', null);
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles undefined process gracefully', () => {
    const result = suggestBrewMethods('light', undefined, ['floral']);
    expect(result.length).toBeGreaterThan(0);
  });

  it('does not return duplicate entries when specific and fallback rules both match', () => {
    const result = suggestBrewMethods('light', 'washed', ['floral', 'citrus']);
    const ids = result.map(r => r.brewer_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('v60');
    expect(ids).toContain('aeropress');
    expect(ids.length).toBe(2);
  });
});
