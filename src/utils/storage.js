const KEY = 'japan-scanner-words';

export function loadSavedWords() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function saveWord(entry) {
  const words = loadSavedWords();
  if (!words.some((w) => w.word === entry.word)) {
    words.push(entry);
    localStorage.setItem(KEY, JSON.stringify(words));
  }
  return words;
}

export function removeWord(word) {
  const words = loadSavedWords().filter((w) => w.word !== word);
  localStorage.setItem(KEY, JSON.stringify(words));
  return words;
}
