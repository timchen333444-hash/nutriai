const prisma = require('../lib/prisma.js');

// WHO/FAO essential amino acid requirements (mg per kg body weight per day).
// Pairs (met+cys, phe+tyr) are evaluated as combined sums against their shared target.
const ESSENTIAL_AAS = [
  { key: 'histidine',  name: 'Histidine',   mgPerKg: 10, fields: ['histidine'] },
  { key: 'isoleucine', name: 'Isoleucine',  mgPerKg: 20, fields: ['isoleucine'] },
  { key: 'leucine',    name: 'Leucine',     mgPerKg: 39, fields: ['leucine'] },
  { key: 'lysine',     name: 'Lysine',      mgPerKg: 30, fields: ['lysine'] },
  { key: 'met_cys',    name: 'Met + Cys',   mgPerKg: 15, fields: ['methionine', 'cysteine'] },
  { key: 'phe_tyr',    name: 'Phe + Tyr',   mgPerKg: 25, fields: ['phenylalanine', 'tyrosine'] },
  { key: 'threonine',  name: 'Threonine',   mgPerKg: 15, fields: ['threonine'] },
  { key: 'tryptophan', name: 'Tryptophan',  mgPerKg: 4,  fields: ['tryptophan'] },
  { key: 'valine',     name: 'Valine',      mgPerKg: 26, fields: ['valine'] },
];

function sumAminoAcidsFromLogs(logs) {
  const sums = {};
  for (const log of logs) {
    let n = {};
    try { n = JSON.parse(log.nutrients || '{}'); } catch {}
    const aa = n.aminoAcids || {};
    for (const [k, v] of Object.entries(aa)) {
      sums[k] = (sums[k] || 0) + (v || 0);
    }
  }
  return sums;
}

function computeScore(aminoTotals, weightKg) {
  const breakdown = ESSENTIAL_AAS.map(({ key, name, mgPerKg, fields }) => {
    const consumedG = fields.reduce((s, f) => s + (aminoTotals[f] || 0), 0);
    const goalG = (mgPerKg * weightKg) / 1000;
    const pct = goalG > 0 ? Math.min(Math.round((consumedG / goalG) * 100), 100) : 0;
    return { key, name, pct, consumed: Math.round(consumedG * 1000) / 1000, goal: Math.round(goalG * 1000) / 1000 };
  });

  const score = Math.round(breakdown.reduce((s, b) => s + b.pct, 0) / ESSENTIAL_AAS.length);
  const weakestLinks = [...breakdown].sort((a, b) => a.pct - b.pct).slice(0, 3);

  return { score, breakdown, weakestLinks };
}

async function getAminoAcidScore(userId, date, weightKg = 70) {
  const logs = await prisma.foodLog.findMany({ where: { userId, date } });
  const totals = sumAminoAcidsFromLogs(logs);
  return computeScore(totals, weightKg);
}

async function getAminoAcidHistory(userId, days = 7, weightKg = 70) {
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });

  const logs = await prisma.foodLog.findMany({ where: { userId, date: { in: dates } } });

  return dates.map(date => {
    const dayLogs = logs.filter(l => l.date === date);
    const totals = sumAminoAcidsFromLogs(dayLogs);
    const { score } = computeScore(totals, weightKg);
    return { date, score };
  });
}

module.exports = { getAminoAcidScore, getAminoAcidHistory };
