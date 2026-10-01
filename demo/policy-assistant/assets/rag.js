// Retrieval + grounded answer over the document index (data/index.js).
// Runs in the browser and in Node (tests/run-eval.mjs). No network, no keys.
//
// ask(question) → { kind: 'answer' | 'refuse', quote, source, others, changed, reason }
//   answer  — the whole best passage (sentences), the ones that answer marked in `quote`,
//             with document, section and page
//   refuse  — nothing in the documents answers it well enough; says so and names who to ask

(function (root) {
  'use strict';

  const STOP = new Set(('a an the and or but if of to in on at for from by with about into over after before ' +
    'is are was were be been being am do does did done have has had i me my we our you your he she it its they them ' +
    'this that these those there here what which who whom whose when where why how can could should would will shall ' +
    'may might must any some all each every no not only just also than then so too very as up out off again ' +
    'get got please tell know need want like let ' +
    // question words and filler that say nothing about the topic
    'much many long often allowed allow able happen happens supposed ok okay still actually really exactly ' +
    'anything something someone anyone anybody thing things way rule rules policy say says said ' +
    'today tomorrow yesterday now tonight currently soon myself yourself few bit lot lots couple about around ' +
    'hi hello thanks cheers mate just quick question wondering whether').split(' '));

  // Everyday British English → the words policies use. Both directions are added at query time,
  // with a lower weight than the word itself. General workplace vocabulary, not tied to one company.
  // Everyday British English → the words policies use. Single words only (a phrase would split into
  // loose words — «flash drive» would make «drive» mean USB); phrases are in PHRASES below.
  const SYNONYMS = [
    ['hotel', 'accommodation', 'room'],
    ['phone', 'mobile', 'smartphone', 'handset', 'call', 'ring'],
    ['laptop', 'computer', 'pc', 'device'],
    ['lost', 'loss', 'lose', 'stolen', 'steal', 'theft', 'missing', 'nicked', 'nick'],
    ['sick', 'sickness', 'ill', 'illness', 'unwell', 'absence', 'absent'],
    ['holiday', 'leave', 'vacation'],
    ['carry', 'carried', 'unused'],
    ['probation', 'trial', 'probationary'],
    ['doctor', 'gp', 'medical'],
    ['petrol', 'fuel', 'mileage', 'diesel', 'miles'],
    ['car', 'vehicle', 'van', 'lorry', 'truck', 'hgv', 'wagon'],
    ['crash', 'collision', 'accident', 'rtc', 'bump', 'scrape', 'scraped', 'hit'],
    ['boss', 'manager', 'supervisor'],
    ['firm', 'company', 'employer'],
    ['client', 'customer'],
    ['claim', 'reimburse', 'reimbursed', 'expense', 'expenses', 'cover'],
    ['approve', 'approval', 'authorise', 'signoff', 'agree'],
    ['abroad', 'overseas', 'foreign', 'spain', 'france', 'portugal', 'italy', 'germany', 'poland', 'ireland', 'greece', 'netherlands', 'usa', 'america', 'europe', 'eu'],
    ['home', 'remote', 'remotely', 'hybrid', 'wfh'],
    ['food', 'meal', 'meals', 'subsistence', 'dinner', 'lunch', 'breakfast', 'tea', 'supper', 'sandwich', 'eat'],
    ['drink', 'alcohol', 'drinking', 'pint', 'pints', 'beer', 'hungover', 'booze'],
    ['break', 'breaks', 'rest', 'stop'],
    ['hours', 'hrs', 'hour'],
    ['password', 'passwords', 'passphrase', 'login', 'credentials'],
    ['usb', 'removable'],
    ['ai', 'chatgpt', 'generative', 'copilot'],
    ['damaged', 'damage', 'broken', 'crushed', 'smashed'],
    ['compensation', 'payout', 'settlement', 'refund'],
    ['fine', 'fines', 'penalty', 'pcn', 'ticket', 'flashed'],
    ['email', 'phishing', 'scam', 'suspicious', 'dodgy', 'fake'],
    ['injury', 'injured', 'hurt', 'cut', 'plaster'],
    ['£', 'pound', 'pounds', 'quid'],
    ['kg', 'kilo', 'kilogram'],
    ['contribute', 'allowance', 'towards'],
    ['broadband', 'internet', 'wifi'],
    ['traffic', 'queue', 'stationary', 'stuck', 'jam'],
    ['weekend', 'saturday', 'sunday', 'night'],
    ['investigate', 'investigation'],
    ['near', 'nearly'],
    ['report', 'reporting', 'tell', 'form'],
  ];

  // Phrases → one word the documents use. Applied to the question before it is split into words.
  const PHRASES = [
    [/\b(memory|usb|pen|flash) (stick|drive)s?\b/g, 'usb'],
    [/\b(days?|time) off\b/g, 'holiday'],
    [/\bannual leave\b/g, 'holiday leave'],
    [/\bsign(ed)?[- ]off\b/g, 'approve'],
    [/\bchip in\b/g, 'contribute allowance'],
    [/\blooks? into\b/g, 'investigate'],
    [/\bspeed(ing)? camera\b/g, 'speeding'],
    [/\bclose call\b/g, 'near miss'],
    [/\bpay (me )?back\b/g, 'reimburse'],
    [/\b(another|a different) country\b|\boutside (the )?uk\b/g, 'abroad'],
    [/\bhow long (have|do) i (got|have) to\b|\bby when\b|\bhow soon\b|\btime limit\b/g, 'deadline within'],
    [/\blog ?in\b|\bsign ?in\b/g, 'password'],
    [/\bsick note\b/g, 'fit note'],
    [/\btrial period\b/g, 'probation'],
    [/\bpay out\b/g, 'compensation'],
  ];

  function stem(w) {
    if (w.length <= 3 || /^[0-9£]/.test(w)) return w;
    return w
      .replace(/sses$/, 'ss')
      .replace(/ies$/, 'y')
      .replace(/(x|ch|sh)es$/, '$1')
      .replace(/([^sui])s$/, '$1')
      .replace(/(ing|ed)$/, (m, _s, off, str) => (str.length - m.length >= 4 ? '' : m))
      .replace(/ly$/, '')
      .replace(/(.{3,})e$/, '$1'); // drive / driving / drived → «driv», so every form meets
  }

  function wordsEn(text) {
    return (text.toLowerCase()
      .replace(/[’']s\b|[’'](re|ll|ve|d|m)\b|n[’']t\b/g, '')
      .replace(/[’']/g, '')
      .match(/[a-z0-9£]+(?:\.[0-9]+)?/g) || []);
  }

  const isNum = (t) => /^[0-9£]/.test(t);

  // Everything that depends on the language of the documents. English is the original demo;
  // Russian (lang 'ru') is defined further down, in rag-ru.js terms of the same shape.
  const EN = {
    lang: 'en',
    STOP, SYNONYMS, PHRASES, stem, words: wordsEn,
    typo: /[A-Za-z]{5,}/g,
    split: /(?<=[.;:])\s+(?=[A-Z(•-])|\n+/,
    DATES: /\b(january|february|march|april|may|june|july|august|september|october|november|december|20\d\d|version|v\d|change|changed|policy)\b/gi,
    // Introductory sections repeat the topic words of the whole document but rarely hold the rule itself.
    OVERVIEW: /^(purpose|scope|purpose and scope|about this|who this applies to|what .* means|what changed|key terms|how it fits|why .* matters|useful contacts)/i,
    NUMQ: /\b(how (much|many|long|soon|often)|what('s| is| was) the (rate|limit|most|maximum|minimum|deadline)|limit|rate|cost|price|£|when|by when|deadline)\b/i,
    PAST: /\b(before|previous|previously|old|older|used to|earlier|former|back then|at the time|last year|v\d|version \d|in 20[0-2]\d)\b/i,
  };

  // Turns a language definition into the working set: terms(), phrase(), synonym map.
  function profile(def) {
    const L = Object.assign({}, def);
    L.terms = (text) => L.words(text).filter((w) => !L.STOP.has(w)).map(L.stem);
    L.phrase = (text) => L.PHRASES.reduce((t, [re, to]) => t.replace(re, ' ' + to + ' '), L.norm ? L.norm(text) : text.toLowerCase());
    L.SYN = new Map();
    for (const group of L.SYNONYMS) {
      const stems = group.flatMap((g) => L.terms(g));
      for (const s of stems) L.SYN.set(s, new Set([...(L.SYN.get(s) || []), ...stems]));
    }
    return L;
  }
  const LANGS = { en: profile(EN) };
  if (root.RAG_RU) LANGS.ru = profile(root.RAG_RU(stem));
  else if (typeof require === 'function') { try { LANGS.ru = profile(require('./rag-ru.js')(stem)); } catch (e) { /* English only */ } }

  function lev(a, b, max) {
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let low = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < low) low = cur[j];
      }
      if (low > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  function build(kb, L) {
    const terms = L.terms;
    const chunks = kb.chunks.map((c) => {
      const head = terms(c.doc_title + ' ' + c.heading + ' ' + c.parent_heading);
      const body = terms(c.text);
      const tf = new Map();
      for (const t of body) tf.set(t, (tf.get(t) || 0) + 1);
      for (const t of head) tf.set(t, (tf.get(t) || 0) + 2); // headings weigh more
      // Questions this passage answers, written once at import (doc2query). A separate field with its own
      // statistics, so many questions do not drown out the passage text.
      const asks = terms((c.asks || []).join(' '));
      const atf = new Map();
      for (const t of asks) atf.set(t, (atf.get(t) || 0) + 1);
      return { ...c, tf, len: body.length + head.length * 2, atf, alen: asks.length };
    });
    const df = new Map(), adf = new Map();
    for (const c of chunks) {
      for (const t of c.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
      for (const t of c.atf.keys()) adf.set(t, (adf.get(t) || 0) + 1);
    }
    const avg = chunks.reduce((s, c) => s + c.len, 0) / chunks.length;
    const aavg = chunks.reduce((s, c) => s + c.alen, 0) / chunks.length || 1;
    const docs = new Map(kb.docs.map((d) => [d.id, d]));
    const vocab = new Set();
    for (const c of kb.chunks) for (const w of L.words(c.text + ' ' + c.heading + ' ' + (c.asks || []).join(' '))) if (w.length >= 4 && !/\d/.test(w)) vocab.add(w);
    for (const g of L.SYNONYMS) for (const w of g) vocab.add(w);
    return { chunks, df, avg, adf, aavg, N: chunks.length, docs, vocab };
  }

  // Query terms with weights: the word itself 1.0, its synonyms 0.6.
  function expand(q, L) {
    const base = [...new Set(L.terms(L.phrase(q)))];
    const out = new Map();
    for (const t of base) {
      out.set(t, Math.max(out.get(t) || 0, 1));
      for (const s of L.SYN.get(t) || []) if (!out.has(s)) out.set(s, 0.6);
    }
    return { base, weighted: out };
  }

  function field(N, tf, len, avg, df, weighted) {
    const k1 = 1.3, b = 0.7;
    let score = 0;
    for (const [t, w] of weighted) {
      const f = tf.get(t);
      if (!f) continue;
      const n = df.get(t) || 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += w * idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * len / avg));
    }
    return score;
  }

  const ASK_WEIGHT = 0.8;
  function bm25(ix, c, weighted) {
    return field(ix.N, c.tf, c.len, ix.avg, ix.df, weighted) +
      (c.alen ? ASK_WEIGHT * field(ix.N, c.atf, c.alen, ix.aavg, ix.adf, weighted) : 0);
  }

  // Share of the question's content words (or their synonyms) that the passage actually contains.
  function coverage(ix, c, base, L) {
    const words = base.filter((t) => !isNum(t));
    if (!words.length) return 0;
    let hit = 0, total = 0;
    for (const t of words) {
      const n = ix.df.get(t) || 0;
      const w = Math.log(1 + ix.N / (1 + n)); // rare words matter more
      total += w;
      const alts = [t, ...(L.SYN.get(t) || [])];
      if (alts.some((a) => c.tf.has(a) || c.atf.has(a))) hit += w;
    }
    return hit / total;
  }

  function sentences(text, L) {
    return text.split(L.split).map((s) => s.trim()).filter((s) => s.length > 12);
  }

  function bestSentences(c, weighted, max, wantsNumber, L) {
    const ss = sentences(c.text, L);
    const scored = ss.map((s, i) => {
      const ts = new Set(L.terms(s));
      let sc = 0;
      for (const [t, w] of weighted) if (ts.has(t)) sc += w;
      const base = sc; // how much of the question this line itself mentions
      if (/\d|£/.test(s)) sc += wantsNumber ? 1.2 : 0.3; // numbers usually are the answer
      else if (wantsNumber && !/[.;:]$/.test(s)) sc = 0; // a table header line, not an answer
      // A figure alone is not enough: «Birmingham … £115» is not the answer to a London question.
      if (wantsNumber && base === 0) sc = 0;
      return { s, i, sc };
    });
    const ranked = scored.filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc);
    const top = ranked.slice(0, max);
    // «How much / how long» → the marked lines must include a figure, if the passage has a relevant one.
    const num = (x) => /\d|£/.test(x.s);
    if (wantsNumber && !top.some(num)) {
      const n = ranked.find(num);
      if (n) top[top.length - 1] = n;
    }
    top.sort((a, b) => a.i - b.i);
    return (top.length ? top : scored.slice(0, 1)).map((x) => x.s);
  }

  function makeEngine(kb, opts) {
    const L = LANGS[kb.lang || 'en'];
    if (!L) throw new Error('no language profile for ' + kb.lang + ' (load assets/rag-ru.js before rag.js)');
    const { DATES, OVERVIEW, NUMQ, PAST } = L;
    const ix = build(kb, L);
    // Refuse unless the best passage is a strong match. With the doc2query field scores are higher; on the
    // tuning questions the highest-scoring off-topic question reached 16.4, so the bar sits a little above it:
    // a missed answer costs a colleague one question to HR, an invented one costs trust.
    // Tuned on tests/eval-questions.json + holdout-questions.json; checked on tests/final-questions.json (written after tuning).
    const minScore = opts && opts.minScore != null ? opts.minScore : L.minScore != null ? L.minScore : 17;
    // …and refuse when the best passage shares too few of the question's words, however strong its score.
    const minCover = opts && opts.minCover != null ? opts.minCover : L.minCover != null ? L.minCover : 0.4;
    const softScore = opts && opts.softScore != null ? opts.softScore : Infinity;
    const softCover = opts && opts.softCover != null ? opts.softCover : 1;

    function search(q, allowOld) {
      const { base, weighted } = expand(fixTypos(q), L);
      const hits = [];
      for (const c of ix.chunks) {
        const d = ix.docs.get(c.doc);
        if (d.status !== 'current' && !allowOld) continue;
        const s = bm25(ix, c, weighted);
        if (s > 0) hits.push({ c, d, score: s, cover: coverage(ix, c, base, L) });
      }
      // Blend: relevance first, but a passage that covers the whole question beats one that repeats one word.
      for (const h of hits) h.rank = h.score * (0.5 + h.cover) * (OVERVIEW.test(h.c.heading) ? 0.75 : 1);
      hits.sort((a, b) => b.rank - a.rank);
      return { base, weighted, hits };
    }

    // «pasword» → «password»: a word the documents don't know is replaced by a known word one letter away
    // (two for long words). Only words of 5+ letters, so short words are never «corrected» into others.
    function fixTypos(q) {
      return q.replace(L.typo, (w) => {
        const lw = L.norm ? L.norm(w) : w.toLowerCase();
        if (ix.vocab.has(lw) || L.STOP.has(lw)) return w;
        // Russian: a known word in an unseen form (отпуске / отпуска) is not a typo.
        if (L.knownForm && L.knownForm(lw, ix)) return w;
        const max = L.typoMax ? L.typoMax(lw.length) : lw.length >= 8 ? 2 : 1;
        if (!max) return w;
        let best = null, bd = max + 1;
        for (const v of ix.vocab) {
          if (Math.abs(v.length - lw.length) > max || v[0] !== lw[0]) continue;
          const d = lev(lw, v, max);
          if (d < bd) { bd = d; best = v; }
        }
        return best || w;
      });
    }

    function sourceOf(h) {
      return {
        doc: h.d.id, code: h.d.code, title: h.d.title, version: h.d.version, status: h.d.status,
        effective: h.d.effective, section: h.c.section, heading: h.c.heading, page: h.c.page, file: h.d.file,
      };
    }

    function ask(q) {
      const wantsOld = PAST.test(q);
      // «What was the limit before March 2026?» — the date only says «old version»; it is not a topic word.
      const topic = wantsOld ? q.replace(new RegExp(PAST.source, 'gi'), ' ').replace(DATES, ' ') : q;
      const { base, weighted, hits } = search(topic, wantsOld);
      const top = hits[0];
      if (!top || top.cover < minCover || (top.score < minScore && !(top.score >= softScore && top.cover >= softCover))) {
        return {
          kind: 'refuse',
          reason: !top ? 'no passage shares any words with the question' : top.cover < minCover ? 'the closest passage misses most of the question' : 'the closest passage is only loosely related',
          nearest: top ? sourceOf(top) : null,
          terms: base,
        };
      }
      // When the question is about the past, prefer the superseded version if it scored close to the top.
      let best = top;
      if (wantsOld) {
        const cur = hits.find((h) => h.d.status === 'current');
        const old = hits.find((h) => h.d.status === 'superseded' && (!cur || h.c.code === cur.c.code));
        if (old && old.rank >= top.rank * 0.6) best = old;
      }
      const wantsNumber = NUMQ.test(q);
      const quote = bestSentences(best.c, weighted, 2, wantsNumber, L);
      const others = [];
      const seen = new Set([best.c.id]);
      for (const h of hits) {
        if (others.length >= 2) break;
        if (seen.has(h.c.id) || h.rank < best.rank * 0.45) continue;
        if (h.c.code === best.c.code && h.c.section === best.c.section) continue; // the other version — shown as «changed»
        seen.add(h.c.id);
        others.push({ ...sourceOf(h), snippet: bestSentences(h.c, weighted, 1, wantsNumber, L)[0] });
      }
      // Same section in another version of this document says something different → show what changed.
      let changed = null;
      const sib = ix.chunks.find((c) => c.code === best.c.code && c.doc !== best.c.doc && c.section === best.c.section);
      if (sib) {
        // Show the other version only where the wording that answers the question is different.
        const mine = new Set(sentences(best.c.text, L));
        const diff = sentences(sib.text, L).filter((x) => !mine.has(x));
        const theirs = bestSentences({ text: diff.join('\n') }, weighted, 1, wantsNumber, L)[0];
        const quoted = quote.some((x) => !sentences(sib.text, L).includes(x));
        if (diff.length && theirs && quoted) {
          const sd = ix.docs.get(sib.doc);
          changed = { version: sd.version, status: sd.status, effective: sd.effective, supersededOn: sd.superseded_on,
            page: sib.page, file: sd.file, quote: theirs };
        }
      }
      return { kind: 'answer', passage: sentences(best.c.text, L), quote, source: sourceOf(best), others, changed, score: best.score, cover: best.cover };
    }

    // The search step on its own, without the refusal gate: the k passages a language model would be given.
    function retrieve(q, k) {
      const wantsOld = PAST.test(q);
      const topic = wantsOld ? q.replace(new RegExp(PAST.source, 'gi'), ' ').replace(DATES, ' ') : q;
      return search(topic, wantsOld).hits.slice(0, k || 5).map((h) => ({ ...sourceOf(h), text: h.c.text }));
    }

    return { ask, search, retrieve, index: ix };
  }

  const api = { makeEngine, terms: (text, lang) => LANGS[lang || 'en'].terms(text), stem, languages: LANGS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RAG = api;
})(typeof window !== 'undefined' ? window : globalThis);
