function sumCounts(counts) {
  return counts.reduce((total, item) => total + (item?._count?.languageId || 0), 0);
}

function roundPercentage(value) {
  return Math.round(value * 100) / 100;
}

function buildLanguageMap(languages) {
  const map = new Map();
  for (const lang of languages) {
    map.set(lang.languageId, lang.languageName);
  }
  return map;
}

function pickTopLanguageId(counts, languageNameById) {
  if (counts.length === 0) return null;

  const sorted = [...counts].sort((a, b) => {
    const countDiff = (b?._count?.languageId || 0) - (a?._count?.languageId || 0);
    if (countDiff !== 0) return countDiff;

    const nameA = (languageNameById.get(a.languageId) || "").toLowerCase();
    const nameB = (languageNameById.get(b.languageId) || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return sorted[0]?.languageId || null;
}

export async function refreshProjectLanguages({ prisma, projectId }) {
  const counts = await prisma.comparison.groupBy({
    by: ["languageId"],
    where: { projectId, languageId: { not: null } },
    _count: { languageId: true },
  });

  const totalComparisons = sumCounts(counts);
  const languageIds = counts.map((entry) => entry.languageId).filter(Boolean);

  const languages = languageIds.length
    ? await prisma.language.findMany({
        where: { languageId: { in: languageIds } },
        select: { languageId: true, languageName: true },
      })
    : [];

  const languageNameById = buildLanguageMap(languages);

  await prisma.projectLanguage.deleteMany({ where: { projectId } });

  let rows = [];
  if (totalComparisons > 0) {
    rows = counts.map((entry) => {
      const count = entry?._count?.languageId || 0;
      const percentage = roundPercentage((count / totalComparisons) * 100);
      return {
        projectId,
        languageId: entry.languageId,
        percentage,
      };
    });

    await prisma.projectLanguage.createMany({ data: rows });
  }

  const topLanguageId = pickTopLanguageId(counts, languageNameById);
  const topLanguageName = topLanguageId ? languageNameById.get(topLanguageId) || null : null;

  await prisma.project.update({
    where: { projectId },
    data: { topLanguage: topLanguageName },
  });

  return {
    totalComparisons,
    topLanguage: topLanguageName,
    languages: rows.map((row) => ({
      languageId: row.languageId,
      languageName: languageNameById.get(row.languageId) || null,
      percentage: row.percentage,
    })),
  };
}
