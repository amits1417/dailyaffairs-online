const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'in', 'for', 'of',
  'to', 'and', 'or', 'it', 'its', 'be', 'are', 'was', 'were', 'has',
  'have', 'had', 'do', 'does', 'did', 'but', 'not', 'that', 'this',
  'from', 'with', 'by', 'as', 'into', 'if', 'than', 'then', 'so',
  'no', 'nor', 'just', 'also', 'can', 'will', 'may', 'shall', 'should',
  'could', 'would', 'must', 'such', 'any', 'each', 'every', 'all',
  'both', 'few', 'more', 'most', 'other', 'some', 'what', 'when',
  'where', 'how', 'who', 'whom', 'whose', 'why', 'there', 'here',
  'been', 'being', 'too', 'very', 'own', 'same', 'only', 'over',
  'after', 'before', 'between', 'under', 'about', 'up', 'down', 'out',
  'off', 'through', 'during', 'because', 'until', 'while', 'above',
  'below', 'again', 'further', 'once', 'these', 'those', 'am'
]);

function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 3 && !STOP_WORDS.has(word));
}

function calculateOverlap(keywords1, keywords2) {
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  let matches = 0;
  for (const word of set1) {
    if (set2.has(word)) matches++;
  }
  const totalUnique = new Set([...set1, ...set2]).size;
  return totalUnique > 0 ? matches / totalUnique : 0;
}

function areQuestionsSimilar(question1, question2) {
  const q1 = question1.question || question1.text || '';
  const q2 = question2.question || question2.text || '';

  const keywords1 = extractKeywords(q1);
  const keywords2 = extractKeywords(q2);

  const overlap = calculateOverlap(keywords1, keywords2);
  return overlap >= 0.3;
}

function deduplicateQuestions(indiabixQuestions, gktodayQuestions) {
  const merged = [];

  for (const iq of indiabixQuestions) {
    merged.push({ ...iq, source: 'indiabix' });
  }

  for (const gq of gktodayQuestions) {
    const tagg = { ...gq, source: 'gktoday' };
    let isDuplicate = false;

    for (let i = 0; i < merged.length; i++) {
      if (areQuestionsSimilar(merged[i], tagg)) {
        isDuplicate = true;
        const existingLen = (merged[i].explanation || '').length;
        const newLen = (tagg.explanation || '').length;
        if (merged[i].source === 'gktoday' && newLen > existingLen) {
          merged[i] = tagg;
        }
        break;
      }
    }

    if (!isDuplicate) {
      merged.push(tagg);
    }
  }

  return merged;
}

module.exports = {
  areQuestionsSimilar,
  deduplicateQuestions,
  extractKeywords,
  calculateOverlap
};
