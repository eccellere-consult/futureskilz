// A local stand-in for the OpenAI chat-completions API, for verifying AI-dependent code paths without credit.
// FUTURESKILZ: copied from the Framework Workspace Builder kit (reference-src/e2e) and widened to recognise the workspace's
// own prompts ("problem-solving method"); POST /__mode {"cutOff":n} makes the next n answers stop mid-way (finish_reason
// "length"), to prove a cut-off reply is retried and never saved.
// The app's OpenAI client honours OPENAI_BASE_URL, so no production code changes are needed to point it here.
// Control: POST /__mode {"fail":true|false,"delayMs":n}  — fail makes every call answer like an out-of-credit account.
//          GET  /__log                                    — every request seen so far (kind + trimmed prompts).
const http = require('http');
const PORT = Number(process.env.FAKE_PORT || 4010);
let fail = false;
let delayMs = 0;
let cutOff = 0;
const log = [];

const completion = (content) => ({
  id: 'chatcmpl-fake', object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: 'fake',
  choices: [{ index: 0, message: { role: 'assistant', content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
});

function areaReport(user) {
  const lines = user.split('\n').filter((l) => /^- .+: .+\(/.test(l));
  const first = (lines.find((l) => !/not reported/.test(l)) || lines[0] || '- the reported figures: n/a (').replace(/^- /, '').split(':')[0];
  const act = (action, horizon, i, u, e) => ({ action, rationale: 'Ties to ' + first, owner: 'CEO', horizon, impactScore: i, urgencyScore: u, effortScore: e });
  return {
    priorityActions: [
      act(`Fix the biggest gap behind ${first}`, 'Immediate', 5, 4, 2),
      act(`Review ${first} weekly with the team`, 'Immediate', 3, 4, 2),
      act(`Run an improvement project on ${first}`, 'Short-term', 4, 3, 3),
      act(`Standardise how ${first} is measured`, 'Short-term', 3, 3, 2),
      act(`Build a three-year plan for ${first}`, 'Ongoing', 4, 2, 4),
      act(`Embed ${first} in the board review`, 'Ongoing', 3, 2, 3),
    ],
    improvementLevers: [
      { area: 'Quick fix', currentState: `Current ${first}`, targetState: 'Better within 90 days', actions: ['Assign an owner', 'Track weekly'], potentialImpact: 'Visible improvement in a quarter', effort: 'Low', timeframe: 'Quick win (1-3 months)', confidence: 'High' },
      { area: 'Process change', currentState: `Current ${first}`, targetState: 'Sustained improvement', actions: ['Redesign the process', 'Train the team'], potentialImpact: 'Lasting improvement', effort: 'Medium', timeframe: 'Medium (3-9 months)', confidence: 'Medium' },
      { area: 'Structural shift', currentState: `Current ${first}`, targetState: 'Best-in-class', actions: ['Invest in capability', 'Review annually'], potentialImpact: 'Competitive advantage', effort: 'High', timeframe: 'Long (9-18 months)', confidence: 'Medium' },
    ],
    actionPoints: { immediate: [`Name an owner for ${first}`], shortTerm: [`Start the ${first} project`], ongoing: [`Review ${first} quarterly`] },
    topRisks: [`${first} stays where it is`, 'The team is stretched', 'No one owns the follow-up'],
    horizonRag: { short: 'amber', medium: 'amber', long: 'green' },
  };
}

function valueTree(user) {
  const area = (user.match(/Focus Area: (.+)/) || [, 'the area'])[1];
  const leaf = (n) => ({ cause: `Root cause ${n} behind ${area}`, capabilitySolutions: ['Fix the process'], strategicInitiatives: ['Improvement initiative'], technologyModules: [{ name: `Module ${n}`, autonomyLevel: 'Assist' }] });
  const levelB = (a, b) => ({ subReason: `Sub-reason ${a}.${b}`, levelC: [leaf(`${a}.${b}.1`), leaf(`${a}.${b}.2`)] });
  return { levelA: [1, 2, 3, 4, 5].map((a) => ({ reason: `Reason ${a} for ${area}`, impactWeightPct: 20, levelB: [levelB(a, 1), levelB(a, 2), levelB(a, 3)] })) };
}

function benchmarks(user) {
  const list = [...user.matchAll(/^\d+\. (.+?) \(unit: (.*?), (higher|lower) is better\)/gm)];
  return {
    benchmarks: list.map(([, name, unit, dir]) => {
      const pct = unit.includes('%');
      const [m, t, l] = pct ? [50, dir === 'higher' ? 70 : 30, dir === 'higher' ? 30 : 70] : [10, dir === 'higher' ? 15 : 5, dir === 'higher' ? 5 : 15];
      return { name, median: m, topQuartile: t, lagging: l };
    }),
  };
}

// A structure-aware stand-in for "Update with AI": answers every listed element in the form it asked for (a choice from its
// options, a rating in range, a number, text, and table rows), so the app's validation and the saved shape get exercised.
function shGenerate(system) {
  const section = system.split('Elements to draft:\n')[1] || '';
  const lines = section.split('\n').filter((l) => /^\d+\. "/.test(l));
  const fields = [];
  const tables = [];
  const answerFor = (kindText, label) => {
    const k = kindText || '';
    const sel = k.match(/^(?:choose exactly )?one of: (.+)$/);
    if (sel) return sel[1].split(' | ')[0];
    const rat = k.match(/^a whole number from (\d+) \(.*?\) to (\d+)/);
    if (rat) return String(Math.max(Number(rat[1]), Number(rat[2]) - 1));
    if (/^a number/.test(k)) return '12';
    return `AI-drafted: ${label} for an auto-components MSME`;
  };
  for (const line of lines) {
    const label = (line.match(/^\d+\. "(.+?)"( — |$)/) || [, ''])[1];
    if (!label) continue;
    if (/This is a TABLE/.test(line)) {
      const tail = line.split('Each row is an object with the keys: ')[1] || '';
      const cols = [...tail.matchAll(/"([a-z0-9_]+)" \((.*?)\) — /g)].map((m) => ({ key: m[1], kind: m[2] }));
      const fixed = line.match(/Exactly one row for each of: (.+?); put the row name in "([a-z0-9_]+)"/);
      const rows = [];
      if (fixed) {
        const names = [...fixed[1].matchAll(/"(.+?)"/g)].map((m) => m[1]);
        for (const name of names) {
          const row = { [fixed[2]]: name };
          for (const c of cols) if (c.key !== fixed[2]) row[c.key] = answerFor(c.kind, `${name} ${c.key}`);
          rows.push(row);
        }
      } else {
        for (let i = 1; i <= 2; i += 1) {
          const row = {};
          for (const c of cols) row[c.key] = answerFor(c.kind, `${label} ${i} ${c.key}`).replace(/^AI-drafted: /, `Line ${i} · `);
          rows.push(row);
        }
      }
      tables.push({ label, rows });
    } else {
      const kindText = (line.match(/\((choose exactly one of: .+|a whole number from .+|a number.*|a few specific sentences|a short phrase)\)\s*$/) || [, ''])[1];
      fields.push({ label, value: answerFor(kindText, label) });
    }
  }
  return tables.length ? { fields, tables } : { fields };
}

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.url === '/__mode' && req.method === 'POST') { const b = JSON.parse(raw || '{}'); if ('fail' in b) fail = !!b.fail; if ('delayMs' in b) delayMs = Number(b.delayMs) || 0; if ('cutOff' in b) cutOff = Number(b.cutOff) || 0; return send(200, { fail, delayMs, cutOff }); }
    if (req.url === '/__log') return send(200, log);
    if (!/\/chat\/completions$/.test(req.url) || req.method !== 'POST') return send(404, { error: { message: 'not found' } });

    const body = JSON.parse(raw || '{}');
    const system = String(body.messages?.[0]?.content ?? '');
    const user = String(body.messages?.[1]?.content ?? '');
    const kind = /Value Tree/.test(system) ? 'value-tree'
      : /benchmarks/i.test(user) && /Metrics:/.test(user) ? 'benchmarks'
      : /advising an Indian MSME's CEO/.test(system) ? 'area-assessment'
      : /You extract form-field values from a document/.test(system) ? 'sh-extract'
      : /filling in the ".+" (strategy framework|problem-solving method)/.test(system) ? 'sh-generate'
      : /producing the final (Analysis, )?Recommendations & Actionables/.test(system) ? 'sh-analyze'
      : 'other';
    log.push({ kind, system: system.slice(0, 160), systemFull: system, user, at: new Date().toISOString(), failed: fail });

    setTimeout(() => {
      if (cutOff > 0) { cutOff -= 1; const c = completion('{"fields":[{"label":"cut'); c.choices[0].finish_reason = 'length'; return send(200, c); }
      if (fail) return send(429, { error: { message: 'You exceeded your current quota (credit_balance_exhausted).', type: 'insufficient_quota', code: 'insufficient_quota' } });
      if (kind === 'area-assessment') return send(200, completion(areaReport(user)));
      if (kind === 'value-tree') return send(200, completion(valueTree(user)));
      if (kind === 'benchmarks') return send(200, completion(benchmarks(user)));
      if (kind === 'sh-extract') {
        const ids = [...user.matchAll(/"id": "(.+?)"/g)].map((m) => m[1]);
        return send(200, completion({ answers: Object.fromEntries(ids.map((id) => [id, `Extracted from the document: ${id}`])) }));
      }
      if (kind === 'sh-generate') return send(200, completion(shGenerate(system)));
      if (kind === 'sh-analyze') {
        const framework = (system.match(/for a completed "(.+?)" (?:strategy framework|problem-solving method)/) || [, 'the framework'])[1];
        const upstream = /SAVED WORK FROM THE TOOLS THIS ONE BUILDS ON/.test(user) ? ' It builds on your earlier saved work.' : '';
        return send(200, completion({
          analysis: {
            summary: `Fake summary for ${framework}: your answers point to one clear strength and one clear gap.${upstream}`,
            verdict: { label: `Fake verdict for ${framework}`, rationale: 'Because the answers say so.' },
            findings: [{ title: 'Fake finding A', detail: 'The strongest signal in your answers.' }, { title: 'Fake finding B', detail: 'The biggest gap in your answers.' }],
            watchouts: ['Fake watch-out: evidence is thin on one point.'],
          },
          recommendations: [{ text: 'Fake rec 1: act on the strongest signal in your fields.' }, { text: 'Fake rec 2: close the biggest gap named in your fields.' }, { text: 'Fake rec 3: review quarterly.' }],
          actionables: [{ action: 'Fake action: name an owner', owner: 'Founder', timeframe: 'Next 30 days', priority: 'High' }, { action: 'Fake action: collect evidence', owner: 'Finance Head', timeframe: 'This quarter', priority: 'Medium' }, { action: 'Fake action: review in a quarter', owner: 'Operations Head', timeframe: 'Within 90 days', priority: 'Low' }],
        }));
      }
      return send(200, completion({}));
    }, delayMs);
  });
});
server.listen(PORT, () => console.log('fake OpenAI listening on ' + PORT));
