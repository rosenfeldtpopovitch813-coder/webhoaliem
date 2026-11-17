const CONTRACTIONS = [
  [/\bdon't\b/g, 'do not'],
  [/\bdoesn't\b/g, 'does not'],
  [/\bdidn't\b/g, 'did not'],
  [/\bcan't\b/g, 'cannot'],
  [/\bwon't\b/g, 'will not'],
  [/\bisn't\b/g, 'is not'],
  [/\baren't\b/g, 'are not'],
  [/\bwasn't\b/g, 'was not'],
  [/\bweren't\b/g, 'were not'],
  [/\bhaven't\b/g, 'have not'],
  [/\bhasn't\b/g, 'has not'],
  [/\bhadn't\b/g, 'had not'],
  [/\bwouldn't\b/g, 'would not'],
  [/\bshouldn't\b/g, 'should not'],
  [/\bcouldn't\b/g, 'could not'],
  [/\bit's\b/g, 'it is'],
  [/\bthere's\b/g, 'there is']
];

export function normalizeEnglishSentence(input) {
  let s = String(input ?? '')
    .replace(/[\u2018\u2019`]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim()
    .toLowerCase()
    .replace(/[.?!]+$/g, '')
    .replace(/\s+/g, ' ');
  for (const [pattern, replacement] of CONTRACTIONS) {
    s = s.replace(pattern, replacement);
  }
  return s.replace(/\s*,\s*/g, ', ').trim();
}

export function checkSentenceRewrite(userInput, acceptedTargets) {
  const normalizedInput = normalizeEnglishSentence(userInput);
  const targets = Array.isArray(acceptedTargets) ? acceptedTargets : [acceptedTargets];
  if (!normalizedInput) {
    return { correct: false, normalizedInput: '', matchedTarget: null };
  }
  for (const target of targets) {
    if (normalizeEnglishSentence(target) === normalizedInput) {
      return { correct: true, normalizedInput, matchedTarget: String(target) };
    }
  }
  return { correct: false, normalizedInput, matchedTarget: null };
}

export function filterVocabItems(items, { theme = 'all', status = 'all', starredOnly = false, query = '' } = {}, progress = {}) {
  const q = String(query || '').trim().toLowerCase();
  const statusMap = progress.vocabStatus || {};
  const stars = progress.starred || {};
  return (items || []).filter((item) => {
    if (!item) return false;
    if (theme !== 'all' && item.theme !== theme) return false;
    const st = statusMap[item.id] || 'new';
    if (status === 'unmastered' && st === 'mastered') return false;
    if (['new', 'learning', 'mastered'].includes(status) && st !== status) return false;
    if (starredOnly && !stars[item.id]) return false;
    if (q) {
      const hay = `${item.word} ${item.meaning} ${item.themeLabel || item.theme} ${item.pos || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function computeEnglishStats(vocabItems = [], grammarTopics = [], progress = {}) {
  const vocabStatus = progress.vocabStatus || {};
  const grammarStatus = progress.grammarStatus || {};
  const vocabMastered = vocabItems.filter((v) => vocabStatus[v.id] === 'mastered').length;
  const vocabLearning = vocabItems.filter((v) => vocabStatus[v.id] === 'learning').length;
  const grammarMastered = grammarTopics.filter((g) => grammarStatus[g.id] === 'mastered').length;
  return {
    vocabTotal: vocabItems.length,
    vocabMastered,
    vocabLearning,
    grammarTotal: grammarTopics.length,
    grammarMastered,
    totalMastered: vocabMastered + grammarMastered
  };
}
