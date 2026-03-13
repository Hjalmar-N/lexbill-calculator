import { STORAGE_KEY } from '../constants';
import type { SavedCase } from '../types';

export function loadSavedCases(): Record<string, SavedCase> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, SavedCase>) : {};
  } catch {
    return {};
  }
}

export function saveCaseToStorage(caseNumber: string, value: SavedCase): void {
  const current = loadSavedCases();
  current[caseNumber || `untitled-${Date.now()}`] = value;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}
