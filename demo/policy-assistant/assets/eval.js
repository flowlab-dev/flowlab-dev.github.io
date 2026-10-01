// The test set check. Same code in the browser (button on the page) and in Node (tests/run-eval.mjs).
(function (root) {
  'use strict';

  // Row notes in the language of the documents (kb.lang).
  const NOTES = {
    en: {
      refused: 'said it is not in the documents',
      answeredFrom: (c, s) => `answered from ${c} §${s}`,
      refusedBut: (d, s) => 'refused, but the answer is in ' + d + ' §' + s,
      saidNotBut: (d, s) => 'said not in the documents, but it is in ' + d + ' §' + s,
      ok: (c, v, s, p) => `${c} v${v} §${s}, p. ${p}`,
      took: (c, v, s, qd, qv, qs) => `took ${c} v${v} §${s} instead of ${qd} v${qv} §${qs}`,
      section: (s, qs) => `right document, section §${s} instead of §${qs}`,
      misses: (m) => `right section, but the passage misses “${m}”`,
      quoteMisses: (m) => `right section, but the quote misses “${m}”`,
      notVerbatim: (c, s) => `quote not found word for word in ${c} §${s}`,
      testData: ' (test data: expected fact not found in that section)',
    },
    ru: {
      refused: 'сказал, что в документах этого нет',
      answeredFrom: (c, s) => `ответил из ${c} §${s}`,
      refusedBut: (d, s) => 'отказался, а ответ есть в ' + d + ' §' + s,
      saidNotBut: (d, s) => 'сказал, что этого нет, а ответ есть в ' + d + ' §' + s,
      ok: (c, v, s, p) => `${c} v${v} §${s}, стр. ${p}`,
      took: (c, v, s, qd, qv, qs) => `взял ${c} v${v} §${s} вместо ${qd} v${qv} §${qs}`,
      section: (s, qs) => `документ верный, но раздел §${s} вместо §${qs}`,
      misses: (m) => `раздел верный, но в отрывке нет «${m}»`,
      quoteMisses: (m) => `раздел верный, но в цитате нет «${m}»`,
      notVerbatim: (c, s) => `цитаты нет дословно в ${c} §${s}`,
      testData: ' (ошибка в тесте: ожидаемого факта нет в этом разделе)',
    },
  };

  function evaluate(engine, kb, questions) {
    const N = NOTES[kb.lang] || NOTES.en;
    const text = new Map(kb.chunks.map((c) => [c.id, c.text]));
    const rows = [];
    for (const q of questions) {
      const r = engine.ask(q.q);
      const row = { id: q.id, q: q.q, expect: q.expect, got: r.kind, ok: false, note: '' };
      if (q.expect === 'refuse') {
        row.ok = r.kind === 'refuse';
        row.note = row.ok ? N.refused : N.answeredFrom(r.source.code, r.source.section);
      } else if (r.kind === 'refuse') {
        row.note = N.refusedBut(q.doc, q.section);
      } else {
        const s = r.source;
        const wantId = `${q.doc.toLowerCase()}-v${q.version}#${q.section}`;
        const sameDoc = s.code === q.doc && String(s.version) === String(q.version);
        const sameSec = s.section === q.section || s.section.startsWith(q.section + '.'); // exact, or a subsection of the expected section
        const quoted = r.passage.join(' ').toLowerCase(); // what the person sees: the passage, key lines marked
        const has = (q.must || []).every((m) => quoted.includes(m.toLowerCase()));
        const inPassage = (q.must || []).every((m) => (text.get(wantId) || '').toLowerCase().includes(m.toLowerCase()));
        row.top3 = sameDoc && sameSec || r.others.some((o) => o.code === q.doc && String(o.version) === String(q.version) &&
          (o.section === q.section || o.section.startsWith(q.section + '.')));
        row.old = s.status === 'superseded' && q.version !== s.version;
        row.ok = sameDoc && sameSec && has;
        row.wrongPassage = !(sameDoc && sameSec);
        row.note = row.ok ? N.ok(s.code, s.version, s.section, s.page)
          : !sameDoc ? N.took(s.code, s.version, s.section, q.doc, q.version, q.section)
            : !sameSec ? N.section(s.section, q.section)
              : N.misses((q.must || []).find((m) => !quoted.includes(m.toLowerCase())));
        if (!inPassage) row.note += N.testData;
      }
      rows.push(row);
    }
    const ans = rows.filter((r) => r.expect === 'answer');
    const ref = rows.filter((r) => r.expect === 'refuse');
    return {
      rows,
      total: rows.length,
      passed: rows.filter((r) => r.ok).length,
      answers: { total: ans.length, ok: ans.filter((r) => r.ok).length, top3: ans.filter((r) => r.ok || r.top3).length },
      refusals: { total: ref.length, ok: ref.filter((r) => r.ok).length },
      invented: ref.filter((r) => !r.ok).length,
      wrong: rows.filter((r) => r.got === 'answer' && (r.expect === 'refuse' || r.wrongPassage)).length, // quoted a passage that is not the right one
      oldVersionLeaks: rows.filter((r) => r.old).length,
    };
  }

  // A recorded run of a language model on the same questions (demo/data/model-run.js). Every quote is checked
  // here, not trusted: it must appear word for word in the passage it cites.
  function evaluateRecorded(kb, questions, answers) {
    const N = NOTES[kb.lang] || NOTES.en;
    const norm = (t) => String(t).replace(/\s+/g, ' ').trim().toLowerCase();
    const byId = new Map(answers.map((a) => [a.id, a]));
    const rows = [];
    for (const q of questions) {
      const a = byId.get(q.id) || { kind: 'missing' };
      const row = { id: q.id, expect: q.expect, got: a.kind, ok: false, verbatim: null, note: '', rec: a };
      if (a.kind === 'answer') {
        const c = kb.chunks.find((x) => x.code === a.code && x.id.startsWith(a.code.toLowerCase() + '-v' + a.version + '#') && x.section === a.section);
        row.verbatim = !!c && norm(c.text).includes(norm(a.quote));
        row.old = q.expect === 'answer' && String(a.version) !== String(q.version) && kb.docs.some((d) => d.code === a.code && String(d.version) === String(a.version) && d.status === 'superseded');
      }
      if (q.expect === 'refuse') {
        row.ok = a.kind === 'refuse';
        row.note = row.ok ? N.refused : N.answeredFrom(a.code, a.section);
      } else if (a.kind !== 'answer') {
        row.note = N.saidNotBut(q.doc, q.section);
      } else {
        const sameDoc = a.code === q.doc && String(a.version) === String(q.version);
        const sameSec = a.section === q.section || a.section.startsWith(q.section + '.');
        const has = (q.must || []).every((m) => norm(a.quote).includes(m.toLowerCase()));
        row.ok = sameDoc && sameSec && has && row.verbatim;
        row.wrongPassage = !(sameDoc && sameSec);
        row.note = row.ok ? N.ok(a.code, a.version, a.section, a.page)
          : !row.verbatim ? N.notVerbatim(a.code, a.section)
            : !sameDoc ? N.took(a.code, a.version, a.section, q.doc, q.version, q.section)
              : !sameSec ? N.section(a.section, q.section)
                : N.quoteMisses((q.must || []).find((m) => !norm(a.quote).includes(m.toLowerCase())));
      }
      rows.push(row);
    }
    const ans = rows.filter((r) => r.expect === 'answer'), ref = rows.filter((r) => r.expect === 'refuse');
    return {
      rows, total: rows.length, passed: rows.filter((r) => r.ok).length,
      answers: { total: ans.length, ok: ans.filter((r) => r.ok).length },
      refusals: { total: ref.length, ok: ref.filter((r) => r.ok).length },
      wrong: rows.filter((r) => r.got === 'answer' && (r.expect === 'refuse' || r.wrongPassage)).length,
      notVerbatim: rows.filter((r) => r.verbatim === false).length,
      oldVersionLeaks: rows.filter((r) => r.old).length,
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { evaluate, evaluateRecorded };
  else root.RAGEval = { evaluate, evaluateRecorded };
})(typeof window !== 'undefined' ? window : globalThis);
