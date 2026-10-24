import { describe, expect, it } from 'vitest';
import { col, long, mean, numbers, rating, section, select, table, text, num } from '../lib/strategyModels/build';
import {
  cleanTable,
  completeness,
  computeDerived,
  computeOutputs,
  computeViews,
  expandTable,
  fieldsFromValues,
  flattenStructure,
  fmtNum,
  isBlankSaved,
  isBlankTable,
  normaliseRow,
  parseRows,
  renderValuesForPrompt,
  valuesFromFields,
} from '../lib/strategyModels/values';
import { genericStructure, slug } from '../lib/strategyModels/structure';
import { kitFileBase, safeSheetName, strategyKit } from '../lib/strategyModels/kit';
import type { ModelValues, Structure } from '../lib/strategyModels/types';
import { kitBytes } from '../lib/templateKit/workbook';
import { readKitWorkbook } from '../lib/templateKit/read';

// A small synthetic model with every kind of part, so the engine is tested apart from any real framework's content.
const quadrant = (row: Record<string, string>): string => {
  const g = Number(row.growth), s = Number(row.share);
  if (!Number.isFinite(g) || !Number.isFinite(s)) return '';
  return g >= 10 ? (s >= 1 ? 'Star' : 'Question mark') : s >= 1 ? 'Cash cow' : 'Dog';
};

const DEMO: Structure & { legacyLabels: Record<string, string> } = {
  sections: [
    section('scan', 'The scan', 'Single answers.',
      text('context', 'Business context', 'Who and where.', 'Auto components, Pune'),
      select('level', 'Overall level', 'Pick one.', ['Low', 'Medium', 'High'], 'Medium'),
      rating('score', 'Confidence', 'How sure.', { low: 'unsure', high: 'certain' }, '4'),
      num('budget', 'Budget', 'Money set aside.', '₹ lakh', '25'),
      long('notes', 'Notes', 'Anything else.', 'e.g. a long thought')),
    section('lines', 'The lines', 'Tables.',
      table('products', 'Product lines', 'One row per product line.', 'Product line', [
        col.text('name', 'Product line', 'Name.'),
        col.num('growth', 'Market growth', 'Per year.', '%'),
        col.num('share', 'Relative share', 'Against the leader.', '×'),
        col.computed('quadrant', 'Quadrant', 'Worked out.', quadrant),
        col.select('plan', 'Plan', 'What to do.', ['Build', 'Hold', 'Harvest']),
      ], { min: 2, max: 4, example: { name: 'Brake pads', growth: '12', share: '1.4' } }),
      table('activities', 'Activities', 'The model’s own rows.', 'Activity', [
        col.text('activity', 'Activity', 'Fixed.'),
        col.num('cost', 'Cost share', 'Percent.', '%'),
        col.rating('grade', 'Grade', 'Against rivals.', { low: 'weaker', high: 'stronger' }),
      ], { fixed: ['Inbound logistics', 'Operations', 'Outbound logistics'] })),
  ],
  derived: [
    { key: 'avg_growth', label: 'Average growth', compute: (v) => { const m = mean(numbers((v.tables.products ?? []).map((r) => r.growth))); return m === null ? null : `${fmtNum(m)}%`; }, tone: () => 'good' },
    { key: 'boom', label: 'Throws', compute: () => { throw new Error('boom'); } },
  ],
  outputs: [
    { key: 'stars', label: 'Stars', compute: (v) => (v.tables.products ?? []).filter((r) => quadrant(r) === 'Star').map((r) => r.name).join(', ') || null },
  ],
  legacyLabels: { 'Old context': 'context', 'Old notes': 'notes' },
};

const VALUES: ModelValues = {
  fields: { context: 'Auto components, Pune', level: 'High', score: '4', budget: '25', notes: 'A long thought\nover two lines' },
  tables: {
    products: [
      { name: 'Brake pads', growth: '12', share: '1.4', plan: 'Build' },
      { name: 'Clutch plates', growth: '3', share: '0.5' },
    ],
    activities: [{ activity: 'Operations', cost: '40', grade: '4' }],
  },
};

describe('rows and tables', () => {
  const products = DEMO.sections[1].parts[0] as Extract<(typeof DEMO.sections)[1]['parts'][number], { kind: 'table' }>;
  const activities = DEMO.sections[1].parts[1] as typeof products;

  it('parseRows is forgiving about what it is given', () => {
    expect(parseRows('[{"a":"1","b":2,"c":null}]')).toEqual([{ a: '1', b: '2', c: '' }]);
    for (const bad of ['', 'nope', '{"a":1}', '[1,"x"]', null, undefined, 5]) expect(parseRows(bad)).toEqual([]);
  });

  it('a row with only computed or empty cells is blank; a fixed row\'s own name does not count as data', () => {
    expect(isBlankTable(products, [{}, { name: '  ' }, { quadrant: 'Star' }])).toBe(true);
    expect(isBlankTable(products, [{ name: 'Brake pads' }])).toBe(false);
    expect(isBlankTable(activities, [{ activity: 'Operations' }])).toBe(true);
    expect(isBlankTable(activities, [{ activity: 'Operations', cost: '40' }])).toBe(false);
  });

  it('cleanTable keeps rows with data, drops blanks and computed cells, trims, and caps at the maximum', () => {
    const rows: Record<string, string>[] = [{ name: ' A ', growth: '1', quadrant: 'Dog' }, {}, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }];
    const out = cleanTable(products, rows);
    expect(out).toEqual([{ name: 'A', growth: '1' }, { name: 'B' }, { name: 'C' }, { name: 'D' }]);
    expect(out.every((r) => !('quadrant' in r))).toBe(true);
  });

  it('normaliseRow gives the same text for the same answers, whatever order the cells were typed in', () => {
    expect(JSON.stringify(normaliseRow(products, { share: '1', name: 'X', growth: '' }))).toBe(JSON.stringify(normaliseRow(products, { name: 'X', share: '1' })));
  });

  it('expandTable lists every fixed row with its data merged in by name, and pads a free table to its minimum', () => {
    const fixed = expandTable(activities, [{ activity: 'operations', cost: '40' }]);
    expect(fixed.map((r) => r.activity)).toEqual(['Inbound logistics', 'Operations', 'Outbound logistics']);
    expect(fixed[1].cost).toBe('40');
    expect(expandTable(products, undefined)).toHaveLength(2);
    expect(expandTable(products, [{ name: 'A' }, { name: 'B' }, { name: 'C' }])).toHaveLength(3);
  });

  it('a fixed table saves its row names with the data', () => {
    expect(cleanTable(activities, [{ activity: 'Operations', cost: '40' }, { activity: 'Inbound logistics' }])).toEqual([{ activity: 'Operations', cost: '40' }]);
  });
});

describe('saved shape ⇄ values', () => {
  it('the structure as the catalogue\'s flat list: labels in order, examples as values', () => {
    const flat = flattenStructure(DEMO);
    expect(flat.map((f) => f.label)).toEqual(['Business context', 'Overall level', 'Confidence', 'Budget', 'Notes', 'Product lines', 'Activities']);
    expect(flat[0]).toMatchObject({ value: 'Auto components, Pune', source: 'Manual' });
    expect(flat[5].value).toBe('Brake pads · 12 · 1.4');
  });

  it('round-trips every kind of answer, with its source', () => {
    const saved = fieldsFromValues(DEMO, VALUES, { context: 'AI', notes: 'Template' });
    expect(saved.map((f) => f.label)).toHaveLength(7);
    expect(saved[0]).toEqual({ label: 'Business context', value: 'Auto components, Pune', source: 'AI' });
    expect(JSON.parse(saved[5].value)).toEqual([{ name: 'Brake pads', growth: '12', share: '1.4', plan: 'Build' }, { name: 'Clutch plates', growth: '3', share: '0.5' }]);
    const back = valuesFromFields(DEMO, saved);
    expect(back.values.fields).toEqual(VALUES.fields);
    expect(back.values.tables.products).toHaveLength(2);
    expect(back.sources.context).toBe('AI');
    expect(back.sources.notes).toBe('Template');
    expect(back.unmatched).toEqual([]);
  });

  it('saves every part, blank where unanswered, so the list does not depend on what a request carried', () => {
    const saved = fieldsFromValues(DEMO, { fields: {}, tables: {} });
    expect(saved).toHaveLength(7);
    expect(saved.every((f) => f.value === '')).toBe(true);
  });

  it('carries answers saved under an older label to the part they now belong to — but never over an answer saved under the new one', () => {
    const old = [{ label: 'Old context', value: 'from the old version', source: 'Manual' }, { label: 'Old notes', value: 'old notes', source: 'Manual' }];
    expect(valuesFromFields(DEMO, old).values.fields).toEqual({ context: 'from the old version', notes: 'Old notes: old notes' });
    const both = [{ label: 'Business context', value: 'new', source: 'Manual' }, ...old];
    expect(valuesFromFields(DEMO, both).values.fields.context).toBe('new');
  });

  it('answers with no exact home go to the notes field under their old label, and several sit together there', () => {
    const withNotes = { ...DEMO, legacyLabels: { 'Old context': 'notes', 'Old budget': 'notes' } };
    const r = valuesFromFields(withNotes, [{ label: 'Old context', value: 'Pune plant', source: 'Manual' }, { label: 'Old budget', value: '25 lakh', source: 'AI' }]);
    expect(r.values.fields.notes).toBe('Old context: Pune plant\nOld budget: 25 lakh');
    expect(r.unmatched).toEqual([]);
  });

  describe('an older answer can land in a typed element or in one cell of a table of the model\'s own rows', () => {
    const typed = {
      ...DEMO,
      legacyLabels: {
        'Old level': 'level', 'Old confidence': 'score', 'Old budget': 'budget',
        'Old inbound cost': 'activities#Inbound logistics.cost', 'Old operations cost': 'activities#Operations.cost',
        'Old operations grade': 'activities#operations.grade', 'Old products cell': 'products#Brake pads.growth', 'Old computed': 'activities#Operations.nothing',
      },
    };
    const old = (label: string, value: string) => ({ label, value, source: 'Manual' });

    it('a choice, a rating and a number are kept only if they are valid for the element', () => {
      const ok = valuesFromFields(typed, [old('Old level', 'high'), old('Old confidence', '4/5'), old('Old budget', '₹25,000')]).values.fields;
      expect(ok).toEqual({ level: 'High', score: '4', budget: '25000' });
      const bad = valuesFromFields(typed, [old('Old level', 'sky high'), old('Old confidence', 'nine'), old('Old budget', '25 lakh')]);
      expect(bad.values.fields).toEqual({});
      expect(bad.unmatched.map((f) => f.label)).toEqual(['Old level', 'Old confidence', 'Old budget']); // still visible, never silently lost
      expect(valuesFromFields(typed, [old('Old confidence', '9')]).unmatched).toHaveLength(1); // outside the 1-5 scale
    });

    it('goes into the named row and column, in the model\'s own row order, with the cell\'s own type checked', () => {
      const r = valuesFromFields(typed, [old('Old operations cost', '40'), old('Old inbound cost', '25%'), old('Old operations grade', '4')]);
      expect(r.values.tables.activities).toEqual([
        { activity: 'Inbound logistics', cost: '25' },
        { activity: 'Operations', cost: '40', grade: '4' },
      ]);
      expect(r.unmatched).toEqual([]);
      expect(r.sources.activities).toBe('Manual');
      expect(valuesFromFields(typed, [old('Old operations grade', 'great')]).unmatched).toHaveLength(1);
    });

    it('a choice or a rating saved under the part\'s own label must still be one of its allowed values', () => {
      const r = valuesFromFields(typed, [old('Overall level', 'sky high'), old('Confidence', '7'), old('Budget', 'a lot'), old('Business context', 'Pune')]);
      expect(r.values.fields).toEqual({ budget: 'a lot', context: 'Pune' }); // a number field keeps what was typed
      expect(r.unmatched.map((f) => f.label)).toEqual(['Overall level', 'Confidence']);
      expect(valuesFromFields(typed, [old('Overall level', 'medium')]).values.fields.level).toBe('Medium');
      // the invalid saved value does not block an older label from filling the part
      expect(valuesFromFields(typed, [old('Overall level', 'sky high'), old('Old level', 'low')]).values.fields.level).toBe('Low');
    });

    it('never goes over a cell that already has an answer, and a table that is not the model\'s own rows takes none', () => {
      const withNew = [{ label: 'Activities', value: JSON.stringify([{ activity: 'Operations', cost: '55' }]), source: 'AI' }, old('Old operations cost', '40'), old('Old operations grade', '3')];
      const r = valuesFromFields(typed, withNew);
      expect(r.values.tables.activities).toEqual([{ activity: 'Operations', cost: '55', grade: '3' }]);
      expect(r.unmatched.map((f) => f.label)).toEqual(['Old operations cost']);
      expect(valuesFromFields(typed, [old('Old products cell', '12')]).unmatched).toHaveLength(1);
      expect(valuesFromFields(typed, [old('Old computed', '12')]).unmatched).toHaveLength(1);
    });

    it('a table of free rows is addressed by position — "the second row" — one cell at a time', () => {
      const free = { ...typed, legacyLabels: { ...typed.legacyLabels, 'Old product 1': 'products#1.name', 'Old product 2': 'products#2.name', 'Old growth 2': 'products#2.growth', 'Old far': 'products#99.name', 'Old zero': 'products#0.name' } };
      const r = valuesFromFields(free, [old('Old product 2', 'Clutch plates'), old('Old product 1', 'Brake pads'), old('Old growth 2', '3%')]);
      expect(r.values.tables.products).toEqual([{ name: 'Brake pads' }, { name: 'Clutch plates', growth: '3' }]);
      expect(r.unmatched).toEqual([]);
      expect(r.sources.products).toBe('Manual');
      expect(valuesFromFields(free, [old('Old far', 'x'), old('Old zero', 'y')]).unmatched).toHaveLength(2);   // outside the rows the table can hold
      expect(valuesFromFields(free, [old('Old growth 2', 'fast')]).unmatched).toHaveLength(1);                  // the cell's own type is checked
      const mine = valuesFromFields(free, [{ label: 'Product lines', value: JSON.stringify([{ name: 'Mine' }]), source: 'Manual' }, old('Old product 1', 'Old name')]);
      expect(mine.values.tables.products).toEqual([{ name: 'Mine' }]);                                          // never over an answer already there
      expect(mine.unmatched.map((f) => f.label)).toEqual(['Old product 1']);
    });
  });

  it('keeps a saved answer that matches nothing, instead of dropping it silently', () => {
    const r = valuesFromFields(DEMO, [{ label: 'Something removed', value: 'still mine', source: 'Manual' }, { label: 'Blank removed', value: '', source: 'Manual' }]);
    expect(r.unmatched).toEqual([{ label: 'Something removed', value: 'still mine', source: 'Manual' }]);
  });

  it('matches labels without regard to case or spacing, and survives a table saved as junk', () => {
    const r = valuesFromFields(DEMO, [{ label: ' business  CONTEXT ', value: 'x', source: 'Manual' }, { label: 'Product lines', value: 'not json', source: 'Manual' }]);
    expect(r.values.fields.context).toBe('x');
    expect(r.values.tables.products).toBeUndefined();
  });

  it('isBlankSaved: a table of blank rows is blank, however it is spelled', () => {
    const t = DEMO.sections[1].parts[0];
    expect(isBlankSaved(t, '')).toBe(true);
    expect(isBlankSaved(t, '[{}]')).toBe(true);
    expect(isBlankSaved(t, '[{"name":"x"}]')).toBe(false);
    expect(isBlankSaved(DEMO.sections[0].parts[0], '  ')).toBe(true);
  });

  it('counts how much of the model is answered', () => {
    expect(completeness(DEMO, VALUES)).toEqual({ filled: 7, total: 7 });
    expect(completeness(DEMO, { fields: { context: 'x' }, tables: { products: [{}] } })).toEqual({ filled: 1, total: 7 });
  });
});

describe('figures the model works out', () => {
  it('computed columns and derived figures come from the answers, and are empty until there is enough input', () => {
    const d = computeDerived(DEMO, VALUES);
    expect(d.find((x) => x.key === 'avg_growth')).toMatchObject({ value: '7.5%', tone: 'good' });
    expect(computeDerived(DEMO, { fields: {}, tables: {} }).find((x) => x.key === 'avg_growth')?.value).toBeNull();
  });

  it('a figure that throws is simply absent — it never takes the page down', () => {
    expect(computeDerived(DEMO, VALUES).find((x) => x.key === 'boom')?.value).toBeNull();
  });

  it('outputs list only what has a value', () => {
    expect(computeOutputs(DEMO, VALUES)).toEqual([{ key: 'stars', label: 'Stars', value: 'Brake pads' }]);
    expect(computeOutputs(DEMO, { fields: {}, tables: {} })).toEqual([]);
  });
});

describe('renderValuesForPrompt', () => {
  it('shows each answer, "(left blank)" for the rest, tables as rows with computed columns worked out, then the figures', () => {
    const text = renderValuesForPrompt(DEMO, { fields: { context: 'Auto components, Pune' }, tables: VALUES.tables });
    expect(text).toContain('## The scan');
    expect(text).toContain('- Business context: Auto components, Pune');
    expect(text).toContain('- Overall level: (left blank)');
    expect(text).toContain('| Product line | Market growth | Relative share | Quadrant | Plan |');
    expect(text).toContain('| Brake pads | 12 | 1.4 | Star | Build |');
    expect(text).toContain('| Clutch plates | 3 | 0.5 | Dog | — |');
    expect(text).toContain('| Operations | 40 | 4 |');
    expect(text).not.toContain('| Inbound logistics'); // a fixed row with no data is not listed
    expect(text).toContain('## Figures worked out from these answers');
    expect(text).toContain('- Average growth: 7.5%');
  });

  it('says so when a table has no rows, and does not break a table cell with a pipe or a line break', () => {
    expect(renderValuesForPrompt(DEMO, { fields: {}, tables: {} })).toContain('- Product lines: (no rows entered)');
    const t = renderValuesForPrompt(DEMO, { fields: {}, tables: { products: [{ name: 'A|B\nC', growth: '1', share: '1' }] } });
    expect(t).toContain('| A/B C | 1 | 1 |');
  });
});

describe('genericStructure — a framework with no model of its own', () => {
  it('is one section of long-text fields, keyed uniquely, with the catalogue example as the placeholder', () => {
    const s = genericStructure([
      { label: 'Supplier concentration', value: 'High — 3 mills', source: 'Value Scan' },
      { label: 'Buyer power', value: '', source: 'Manual' },
      { label: 'Buyer power', value: '', source: 'Manual' },
    ]);
    expect(s.sections).toHaveLength(1);
    const parts = s.sections[0].parts;
    expect(parts.map((p) => p.key)).toEqual(['supplier_concentration', 'buyer_power', 'buyer_power_2']);
    expect(parts[0]).toMatchObject({ type: 'longtext', example: 'High — 3 mills', prefill: 'value_scan' });
    expect(slug('  Odd / label!  ')).toBe('odd_label');
    expect(slug('!!!')).toBe('field');
  });
});

describe('the template kit generated from a structure', () => {
  const kit = strategyKit({ toolId: 'demo', name: "Demo's Model", originator: 'A. Author', structure: DEMO });

  it('has one sheet per section of single answers and one per table, with legal unique names', () => {
    expect(kit.def.sheets.map((s) => [s.kind, s.name])).toEqual([['fields', 'The scan'], ['table', 'Product lines'], ['table', 'Activities']]);
    expect(kit.def.fileBase).toBe('Eccellere-Demos-Model');
    expect(kit.def.title).toBe("Eccellere Strategy Hub — Demo's Model");
    expect(kit.def.guidance.join(' ')).toContain('A. Author');
    const used = new Set<string>();
    expect(safeSheetName('A/B: a very long section title that exceeds the limit', used).length).toBeLessThanOrEqual(31);
    expect(safeSheetName('Same', used)).toBe('Same');
    expect(safeSheetName('Same', used)).toBe('Same 2');
    expect(kitFileBase("Porter's Five Forces")).toBe('Eccellere-Porters-Five-Forces');
  });

  it('leaves worked-out columns out of the template, ships a fixed table\'s rows, and lists the allowed values', () => {
    const products = kit.def.sheets[1];
    expect(products.kind === 'table' && products.columns.map((c) => c.header)).toEqual(['Product line', 'Market growth', 'Relative share', 'Plan']);
    expect(products.kind === 'table' && products.columns[3].help).toContain('Allowed: Build · Hold · Harvest');
    const activities = kit.def.sheets[2];
    expect(activities.kind === 'table' && activities.scaffold?.map((r) => r.activity)).toEqual(['Inbound logistics', 'Operations', 'Outbound logistics']);
    const fields = kit.def.sheets[0];
    expect(fields.kind === 'fields' && fields.fields.find((f) => f.key === 'score')?.options).toEqual(['1', '2', '3', '4', '5']);
    expect(fields.kind === 'fields' && fields.fields.find((f) => f.key === 'score')?.help).toContain('1 = unsure … 5 = certain');
  });

  it('a fixed table with row hints gets a read-only "Consider" column that is shown but never read back', async () => {
    const hinted: Structure = {
      sections: [section('s', 'Forces', 'Rows are the model’s own.', table('forces', 'The forces', 'Rate each.', 'Force', [
        col.text('force', 'Force', 'Fixed.'), col.long('why', 'Evidence', 'Why.'), col.rating('level', 'Intensity', 'How strong.'),
      ], { fixed: ['Entrants', 'Buyers'], hints: { Entrants: 'Barriers, capital', Buyers: 'Concentration, price sensitivity' } }))],
      derived: [], outputs: [],
    };
    const k = strategyKit({ toolId: 'f', name: 'Forces', structure: hinted });
    const sheet = k.def.sheets[0];
    expect(sheet.kind === 'table' && sheet.columns.map((c) => c.header)).toEqual(['Force', 'Consider', 'Evidence', 'Intensity']);
    expect(sheet.kind === 'table' && sheet.scaffold).toEqual([{ force: 'Entrants', _hint: 'Barriers, capital' }, { force: 'Buyers', _hint: 'Concentration, price sensitivity' }]);
    const content = k.toContent({ fields: {}, tables: { forces: [{ force: 'Buyers', why: 'Few big OEMs', level: '5' }] } });
    expect(content['The forces']).toEqual([{ force: 'Entrants', _hint: 'Barriers, capital' }, { force: 'Buyers', why: 'Few big OEMs', level: '5', _hint: 'Concentration, price sensitivity' }]);
    const read = await readKitWorkbook(k.def, await kitBytes(k.def, content));
    expect(read.warnings).toEqual([]);
    expect(k.fromContent(read.content).tables.forces).toEqual([{ force: 'Buyers', why: 'Few big OEMs', level: '5' }]);
  });

  it('answers → workbook values → answers is lossless', () => {
    const back = kit.fromContent(kit.toContent(VALUES));
    expect(back.fields).toEqual(VALUES.fields);
    expect(back.tables.products).toEqual([{ name: 'Brake pads', growth: '12', share: '1.4', plan: 'Build' }, { name: 'Clutch plates', growth: '3', share: '0.5' }]);
    expect(back.tables.activities).toEqual([{ activity: 'Operations', cost: '40', grade: '4' }]);
  });

  it('writes a real workbook and reads it back: the blank template is empty and not a sample', async () => {
    const read = await readKitWorkbook(kit.def, await kitBytes(kit.def, null));
    expect(read.isSample).toBe(false);
    expect(read.filled).toBe(0);
    expect(read.warnings).toEqual([]);
    expect(Object.keys(kit.fromContent(read.content).fields)).toEqual([]);
  });

  it('writes a sample workbook that is recognised as a sample and reads back to the same answers', async () => {
    const read = await readKitWorkbook(kit.def, await kitBytes(kit.def, kit.toContent(VALUES)));
    expect(read.isSample).toBe(true);
    expect(read.warnings).toEqual([]);
    const back = kit.fromContent(read.content);
    expect(back.fields).toEqual(VALUES.fields);
    expect(back.tables.products?.[0]).toEqual({ name: 'Brake pads', growth: '12', share: '1.4', plan: 'Build' });
    expect(back.tables.activities).toEqual([{ activity: 'Operations', cost: '40', grade: '4' }]);
  });

  it('forgives how people type: a rating or a choice in the wrong case, a number with a unit or comma', async () => {
    const typed = kit.toContent({ fields: { level: 'medium', score: '3', budget: '1,250' }, tables: { products: [{ name: 'X', growth: '12%', share: '1.5', plan: 'hold' }] } });
    const read = await readKitWorkbook(kit.def, await kitBytes(kit.def, typed));
    const back = kit.fromContent(read.content);
    expect(back.fields).toMatchObject({ level: 'Medium', score: '3', budget: '1250' });
    expect(back.tables.products[0]).toMatchObject({ growth: '12', plan: 'Hold' });
  });

  it('drops a choice the model does not allow rather than guessing', () => {
    const back = kit.fromContent({ 'The scan': { level: 'Sky high', score: 9 }, 'Product lines': [{ name: 'X', plan: 'Sell it all' }] });
    expect(back.fields.level).toBeUndefined();
    expect(back.fields.score).toBeUndefined();
    expect(back.tables.products).toEqual([{ name: 'X' }]);
  });

  it('matches a fixed table\'s rows by name and ignores any other', () => {
    const back = kit.fromContent({ Activities: [{ activity: 'OPERATIONS', cost: 40 }, { activity: 'Invented row', cost: 5 }] });
    expect(back.tables.activities).toEqual([{ activity: 'Operations', cost: '40' }]);
  });
});

describe('tables of worked-out figures (views)', () => {
  const withView: Structure = {
    ...DEMO,
    views: [{
      key: 'projection',
      title: 'Projection',
      rowHeading: 'Year',
      columns: ['Revenue', 'Profit'],
      rows: ['Year 1', 'Year 2', 'Total'],
      strong: ['Total'],
      cell: (row, column, v) => {
        const n = Number(v.fields.budget);
        if (!Number.isFinite(n) || v.fields.budget === undefined) return '';
        const year = row === 'Year 1' ? n : row === 'Year 2' ? n * 2 : n * 3;
        return column === 'Revenue' ? String(year) : row === 'Total' ? 'boom' : String(year / 5);
      },
    }],
  };

  it('works out every cell from the answers, marks totals, and reports nothing until there is something to work from', () => {
    expect(computeViews(withView, { fields: {}, tables: {} })[0].hasFigures).toBe(false);
    const [view] = computeViews(withView, { fields: { budget: '10' }, tables: {} });
    expect(view.hasFigures).toBe(true);
    expect(view.rows.map((r) => r.name)).toEqual(['Year 1', 'Year 2', 'Total']);
    expect(view.rows[1].cells).toEqual(['20', '4']);
    expect(view.rows[2].strong).toBe(true);
    expect(view.rows[0].strong).toBe(false);
  });

  it('is given to the AI as a table in the full rendering, but not in the "what the client already gave" rendering', () => {
    const full = renderValuesForPrompt(withView, { fields: { budget: '10' }, tables: {} });
    expect(full).toContain('## Projection (worked out from these answers)');
    expect(full).toContain('| Year | Revenue | Profit |');
    expect(full).toContain('| Year 1 | 10 | 2 |');
    expect(full).toContain('| **Total** | 30 | boom |');
    expect(renderValuesForPrompt(withView, { fields: { budget: '10' }, tables: {} }, { skipBlank: true })).not.toContain('Projection');
    expect(renderValuesForPrompt(withView, { fields: {}, tables: {} })).not.toContain('Projection'); // nothing worked out yet
  });

  it('a cell that throws is just empty, and a structure with no views has none', () => {
    const broken: Structure = { ...DEMO, views: [{ key: 'x', title: 'X', rowHeading: 'R', columns: ['A'], rows: ['r'], cell: () => { throw new Error('no'); } }] };
    expect(computeViews(broken, VALUES)[0].rows[0].cells).toEqual(['']);
    expect(computeViews(DEMO, VALUES)).toEqual([]);
  });
});
