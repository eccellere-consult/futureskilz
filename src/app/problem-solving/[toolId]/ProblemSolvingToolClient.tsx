'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import KitPanel from '@/components/kits/KitPanel';
import DemoBanner from '@/components/kits/DemoBanner';
import ModelForm, { type FormChange, type Suggestion } from '@/components/strategy-hub/ModelForm';
import ModelDiagramCard from '@/components/strategy-hub/ModelDiagramCard';
import AnalysisPanel from '@/components/strategy-hub/AnalysisPanel';
import ConnectionsPanel, { STATUS_CHIP } from '@/components/strategy-hub/ConnectionsPanel';
import {
  alignFields,
  fillinStatus,
  type FillinRecord,
  type FillinStatus,
  type StrategyActionable,
  type StrategyAnalysis,
  type StrategyRecommendation,
} from '@/lib/strategyFillinTypes';
import type { ConnectedTool } from '@/lib/strategyHubConnections';
import { loadModelDefinition } from '@/lib/strategyModels/groups';
import { genericStructure } from '@/lib/strategyModels/structure';
import { strategyKit } from '@/lib/strategyModels/kit';
import { fieldsFromValues, renderValuesForPrompt, valuesFromFields, partsOf } from '@/lib/strategyModels/values';
import { downloadKit } from '@/lib/templateKit/workbook';
import { isField, type ModelDefinition, type ModelSample, type ModelValues, type Reference, type Structure } from '@/lib/strategyModels/types';
import type { FrameworkField } from '@/lib/strategyFrameworks';
import { PROBLEM_SOLVING } from '@/lib/problemSolving/section';

const SAMPLE_COMPANY = 'Anand Auto Components Pvt Ltd';
const BASE = '/problem-solving';
const FIT_LABEL = new Map<string, string>((PROBLEM_SOLVING.facets.find((f) => f.key === 'fits')?.values ?? []).map((v) => [v.id, v.label]));

/** What the public catalogue sends for a field: `v` is an ILLUSTRATIVE EXAMPLE, never a value (see GET /api/problem-solving/frameworks). */
interface WireField { l: string; v: string; src: string; examples?: string[] }
interface WireFramework {
  id: string;
  name: string;
  stage: string;
  nature: string;
  fits: string[];
  does: string;
  when: string;
  whenNot: string;
  next: string;
  fields?: WireField[];
  upstream: string[];
  downstream: string[];
  hasModel: boolean;
}
interface SessionClient { email: string; name: string; role: 'client' | 'admin' }
interface ProblemInfo { id: number; title: string }
interface ModelInfo { reference: Reference; diagramSvg: string | null; sampleAvailable: boolean }
type SampleBundle = ModelSample & { connections: { upstream: ConnectedTool[]; downstream: ConnectedTool[] } };
interface FormState { values: ModelValues; sources: Record<string, string> }
/** A model's own structure carries the labels older saved answers used; a generic one has none. */
type StructureWithLegacy = Structure & { legacyLabels?: Record<string, string> };
type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const EMPTY_FORM: FormState = { values: { fields: {}, tables: {} }, sources: {} };
const AUTOSAVE_MS = 1200;
const timeOf = (d: Date) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const autoRows = (value: string): number => Math.max(2, Math.min(20, (value.match(/\n/g) ?? []).length + Math.ceil(value.length / 70) + 1));

/**
 * The Problem Solving tool page: the Strategy Hub's tool page (StrategyHubToolClient.tsx, commit f9c3ab4) adapted for
 * FutureSkilz. Every save belongs to one of the learner's problems (?case=), the session is FutureSkilz's, the AI is grounded
 * in the learner's profile, and links stay inside the section. The 13 page elements are the kit's, in the kit's order.
 */
export default function ProblemSolvingToolClient({ toolId, demo = false, caseId }: { toolId: string; demo?: boolean; caseId: number | null }) {
  const [framework, setFramework] = useState<WireFramework | null>(null);
  const [allFrameworks, setAllFrameworks] = useState<WireFramework[]>([]);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [client, setClient] = useState<SessionClient | null | undefined>(undefined);

  // The framework's structure: the model's own for a framework that has one (with its old-label mapping), otherwise one
  // section of long-text fields.
  const [structure, setStructure] = useState<StructureWithLegacy | null>(null);
  const [modelDef, setModelDef] = useState<ModelDefinition | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [sample, setSample] = useState<SampleBundle | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [unmatched, setUnmatched] = useState<FrameworkField[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState<ReactNode>('');
  const [uploadNote, setUploadNote] = useState<ReactNode>('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [kitError, setKitError] = useState('');

  const [record, setRecord] = useState<FillinRecord | null>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeNote, setAnalyzeNote] = useState<ReactNode>('');
  const [connections, setConnections] = useState<{ upstream: ConnectedTool[]; downstream: ConnectedTool[] } | null>(null);

  const [methodology, setMethodology] = useState('');
  const [methodologyDraft, setMethodologyDraft] = useState('');
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [methodologyEditing, setMethodologyEditing] = useState(false);
  const [methodologySaving, setMethodologySaving] = useState(false);
  const [methodologyNote, setMethodologyNote] = useState<ReactNode>('');
  const [canEditMethodology, setCanEditMethodology] = useState(false);
  const [problemFor, setProblem] = useState<{ caseId: number; info: ProblemInfo | null } | null>(null);

  // The form's current answers, for the autosave timer and the page-hide flush (a closure would hold a stale copy). Every
  // change goes through commitForm, which updates this and the rendered state together.
  const formRef = useRef<FormState>(EMPTY_FORM);
  const structureRef = useRef<StructureWithLegacy | null>(null);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitForm = useCallback((next: FormState) => { formRef.current = next; setForm(next); }, []);

  // The sample is a worked example only when one exists for this tool.
  const demoActive = demo && !!sample;

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const user = data?.user as { displayName: string; email: string; roles: string[] } | undefined;
        setClient(user ? { name: user.displayName, email: user.email, role: user.roles.includes('admin') ? 'admin' : 'client' } : null);
      })
      .catch(() => setClient(null));
  }, []);

  useEffect(() => {
    fetch('/api/problem-solving/frameworks')
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || 'Could not load frameworks');
        const list: WireFramework[] = data.tools || [];
        setAllFrameworks(list);
        const found = list.find((f) => f.id === toolId);
        if (!found) { setNotFound(true); return; }
        setFramework(found);
      })
      .catch(() => setLoadError('Could not load this framework right now.'));
  }, [toolId]);

  // The structure (loaded as code, a group at a time), the reference diagram, and — for the demo — the worked example.
  useEffect(() => {
    if (!framework) return;
    let cancelled = false;
    (async () => {
      let def: ModelDefinition | null = null;
      let info: (ModelInfo & { sample?: SampleBundle }) | null = null;
      if (framework.hasModel) {
        const [d, res] = await Promise.all([
          loadModelDefinition(toolId),
          fetch(`/api/problem-solving/model?toolId=${encodeURIComponent(toolId)}${demo ? '&sample=1' : ''}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        def = d;
        info = res;
      }
      if (cancelled) return;
      const s: StructureWithLegacy = def ?? genericStructure((framework.fields ?? []).map((f) => ({ label: f.l, value: f.v, source: f.src })));
      structureRef.current = s;
      setStructure(s);
      setModelDef(def);
      setModelInfo(info && info.diagramSvg ? { reference: info.reference, diagramSvg: info.diagramSvg, sampleAvailable: info.sampleAvailable } : null);
      if (demo && info?.sample) {
        setSample(info.sample);
        commitForm({ values: { fields: { ...info.sample.values }, tables: { ...info.sample.tables } }, sources: {} });
        setConnections(info.sample.connections);
      }
    })();
    return () => { cancelled = true; };
  }, [framework, toolId, demo, commitForm]);

  /** Puts a saved record's answers onto the form (matched to the structure's own elements), and keeps what matches nothing visible. */
  const applyRecord = useCallback((rec: FillinRecord) => {
    setRecord(rec);
    const s = structureRef.current;
    if (!s) return;
    const parsed = valuesFromFields(s, rec.fields);
    commitForm({ values: parsed.values, sources: parsed.sources });
    setUnmatched(parsed.unmatched);
  }, [commitForm]);

  // The problem this page is working on: its title for the bar above the form (and proof it is the learner's own).
  useEffect(() => {
    if (demo || !client || !caseId) return;
    let active = true;
    fetch('/api/problem-solving/cases', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const found = (data?.cases ?? []).find((c: ProblemInfo) => c.id === caseId);
        if (active) setProblem({ caseId, info: found ? { id: found.id, title: found.title } : null });
      })
      .catch(() => { if (active) setProblem({ caseId, info: null }); });
    return () => { active = false; };
  }, [client, caseId, demo]);
  // undefined while it loads; null when there is no problem (none chosen, signed out, or not the learner's own).
  const problem: ProblemInfo | null | undefined =
    demo || client === undefined ? undefined : !client || !caseId ? null : problemFor?.caseId === caseId ? problemFor.info : undefined;

  // Saved work, connected tools and methodology — once the structure and the session are known (not in the worked example).
  useEffect(() => {
    if (!structure || client === undefined || demo) return;
    if (client && caseId) {
      fetch(`/api/problem-solving/fillin?toolId=${encodeURIComponent(toolId)}&caseId=${caseId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (data) applyRecord(data as FillinRecord); })
        .catch(() => {});
      fetch(`/api/problem-solving/connections?toolId=${encodeURIComponent(toolId)}&caseId=${caseId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (data) setConnections(data); })
        .catch(() => {});
    }
  }, [structure, client, toolId, demo, caseId, applyRecord]);

  useEffect(() => {
    if (!framework || client === undefined) return;
    fetch(`/api/problem-solving/skill?toolId=${encodeURIComponent(toolId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.skillContent) { setMethodology(data.skillContent); setMethodologyDraft(data.skillContent); }
        setCanEditMethodology(data?.canEdit === true);
      })
      .catch(() => {});
  }, [framework, client, toolId]);

  const nameOf = (id: string): string => allFrameworks.find((f) => f.id === id)?.name ?? id;

  const loginPrompt = (next: string) => (
    <a href={`/sign-in?next=${encodeURIComponent(next)}`} className="text-eccellere-gold font-semibold">Sign in</a>
  );

  /** The form as the list of saved fields (every element, in the structure's order). */
  const savedFields = useCallback((): FrameworkField[] => {
    const s = structureRef.current;
    return s ? fieldsFromValues(s, formRef.current.values, formRef.current.sources) : [];
  }, []);
  const toPayload = (list: FrameworkField[]) => list.map((f) => ({ label: f.label, value: f.value, source: f.source }));

  // ── Autosave: what is typed is saved a moment after the last keystroke — no Save button to forget ──────────────────
  const flushSave = useCallback(async (opts: { keepalive?: boolean; reason?: 'template' | 'document' } = {}) => {
    if (!client || demo || !caseId || !dirtyRef.current) return;
    dirtyRef.current = false;
    setSaveState('saving');
    try {
      const res = await fetch('/api/problem-solving/fillin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: opts.keepalive,
        body: JSON.stringify({ toolId, caseId, fields: toPayload(savedFields()), reason: opts.reason }),
      });
      if (!res.ok) throw new Error('save failed');
      const data = await res.json();
      // Only the saved record is refreshed; the answers on screen are the client's, and are never overwritten while they type.
      setRecord(data.record as FillinRecord);
      setSavedAt(new Date());
      setSaveState(dirtyRef.current ? 'pending' : 'saved');
    } catch {
      dirtyRef.current = true;
      setSaveState('error');
    }
  }, [client, demo, caseId, toolId, savedFields]);

  const scheduleSave = useCallback(() => {
    if (!client || demo || !caseId) return;
    dirtyRef.current = true;
    setSaveState('pending');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void flushSave(); }, AUTOSAVE_MS);
  }, [client, demo, caseId, flushSave]);

  // Closing the tab, or leaving the page, inside the autosave window must not lose the last edit.
  useEffect(() => {
    const onHide = () => { if (timerRef.current) clearTimeout(timerRef.current); void flushSave({ keepalive: true }); };
    window.addEventListener('pagehide', onHide);
    return () => { window.removeEventListener('pagehide', onHide); onHide(); };
  }, [flushSave]);

  const onFormChange = (next: FormChange) => { commitForm(next); scheduleSave(); };
  const saveNow = () => { if (timerRef.current) clearTimeout(timerRef.current); void flushSave(); };

  // ── "Update with AI": drafts only what has not been answered; saved by the server; one-click undo ──────────────────
  async function runAI() {
    if (!framework) return;
    if (!caseId) { setAiNote(<>Choose or start a problem first — <Link href={BASE} className="text-eccellere-gold font-semibold">My problems</Link>.</>); return; }
    setAiLoading(true);
    setAiNote('Drafting from your context…');
    try {
      if (timerRef.current) clearTimeout(timerRef.current);
      await flushSave(); // anything typed in the last second is saved first, so the AI sees (and never overwrites) it
      const res = await fetch('/api/problem-solving/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId: framework.id, caseId, fields: toPayload(savedFields()) }),
      });
      if (res.status === 401) { setAiNote(loginPrompt(`${BASE}/${toolId}`)); return; }
      const data = await res.json();
      if (!res.ok) { setAiNote(data.error || 'Could not draft right now.'); return; }
      if (data.unchanged) { setAiNote('Every part already has your own answer — nothing for the AI to draft.'); return; }
      applyRecord(data.record as FillinRecord);
      setSavedAt(new Date());
      setSaveState('saved');
      const groundedOn = [
        data.hasBusinessContext ? 'your profile' : '',
        ...(Array.isArray(data.usedUpstream) ? data.usedUpstream.map((n: string) => `your ${n}`) : []),
      ].filter(Boolean);
      const n = Array.isArray(data.filledLabels) ? data.filledLabels.length : 0;
      setAiNote(
        `Drafted ${n} part${n === 1 ? '' : 's'}${groundedOn.length ? ` from ${groundedOn.join(', ')}` : ' from the problem as you described it (no profile or earlier tools on file yet)'} — saved. Your own answers were not touched; edit anything you like.`
      );
    } catch {
      setAiNote('Could not reach the server. Try again.');
    } finally {
      setAiLoading(false);
    }
  }

  async function undoLast() {
    try {
      const res = await fetch('/api/problem-solving/fillin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, caseId, undo: true }),
      });
      const data = await res.json();
      if (!res.ok) { setAiNote(data.error || 'Nothing to undo.'); return; }
      applyRecord(data.record as FillinRecord);
      setAiNote('Undone — your answers are back as they were.');
      setUploadNote('');
    } catch {
      setAiNote('Could not reach the server. Try again.');
    }
  }

  // ── The template kit: blank, sample, and upload ─────────────────────────────────────────────────────────────────────
  const kit = useMemo(
    () => (structure && framework ? strategyKit({ toolId, name: framework.name, originator: modelDef?.reference.originator, structure, brand: { product: 'FutureSkilz', section: PROBLEM_SOLVING.name } }) : null),
    [structure, framework, toolId, modelDef]
  );

  async function downloadBlank() {
    if (!kit) return;
    setKitError('');
    try { await downloadKit(kit.def, null); } catch (e) { setKitError(e instanceof Error ? e.message : 'Download failed.'); }
  }

  async function downloadSample() {
    if (!kit) return;
    setKitError('');
    try {
      let s: ModelSample | null = sample;
      if (!s) {
        const res = await fetch(`/api/problem-solving/model?toolId=${encodeURIComponent(toolId)}&sample=1`);
        s = res.ok ? ((await res.json()).sample as ModelSample | null) : null;
      }
      if (!s) { setKitError('There is no sample workbook for this tool yet.'); return; }
      await downloadKit(kit.def, kit.toContent({ fields: s.values, tables: s.tables }));
    } catch (e) {
      setKitError(e instanceof Error ? e.message : 'Download failed.');
    }
  }

  /** A filled template sets what it has a value for (an undo is kept); it never blanks anything. */
  function applyTemplate(imported: FrameworkField[]): number {
    const s = structureRef.current;
    if (!s) return 0;
    const parsed = valuesFromFields(s, imported);
    const cur = formRef.current;
    const values: ModelValues = { fields: { ...cur.values.fields, ...parsed.values.fields }, tables: { ...cur.values.tables, ...parsed.values.tables } };
    const sources = { ...cur.sources };
    for (const k of [...Object.keys(parsed.values.fields), ...Object.keys(parsed.values.tables)]) sources[k] = 'Template';
    commitForm({ values, sources });
    return Object.keys(parsed.values.fields).length + Object.keys(parsed.values.tables).length;
  }

  /** Any other document: the AI reads it, and only fills what is still blank. */
  async function extractFromDocument(file: File): Promise<void> {
    const form = new FormData();
    form.append('file', file);
    const upRes = await fetch('/api/self-service/upload', { method: 'POST', body: form });
    const upData = await upRes.json();
    if (upRes.status === 401) { setUploadNote(loginPrompt(`${BASE}/${toolId}`)); return; }
    if (!upRes.ok) { setUploadNote(upData.error || 'Could not read that file.'); return; }
    setUploadNote('Extracting…');
    const exRes = await fetch('/api/problem-solving/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolId, text: upData.text }),
    });
    const exData = await exRes.json();
    if (!exRes.ok) { setUploadNote(exData.error || 'Could not extract answers from that document.'); return; }
    const s = structureRef.current;
    if (!s) return;
    const incoming = valuesFromFields(s, (exData.fields ?? []).map((f: { label: string; value: string }) => ({ label: f.label, value: f.value, source: 'Document' })));
    const cur = formRef.current;
    const values: ModelValues = { fields: { ...cur.values.fields }, tables: { ...cur.values.tables } };
    const sources = { ...cur.sources };
    let n = 0;
    for (const [k, v] of Object.entries(incoming.values.fields)) {
      if ((values.fields[k] ?? '').trim() && sources[k] !== 'AI') continue;
      values.fields[k] = v; sources[k] = 'Document'; n += 1;
    }
    commitForm({ values, sources });
    if (n > 0) { dirtyRef.current = true; await flushSave({ reason: 'document' }); }
    setUploadNote(n > 0 ? `Filled ${n} part${n === 1 ? '' : 's'} from ${file.name} — saved. Your own answers were not touched.` : `Nothing new to fill from ${file.name}.`);
  }

  async function handleUpload(file: File) {
    setUploadBusy(true);
    setKitError('');
    setUploadNote(`Reading ${file.name}…`);
    try {
      const fd = new FormData();
      fd.append('toolId', toolId);
      fd.append('file', file);
      const res = await fetch('/api/problem-solving/import', { method: 'POST', body: fd });
      if (res.status === 401) { setUploadNote(loginPrompt(`${BASE}/${toolId}`)); return; }
      const data = await res.json();
      if (!res.ok) { setUploadNote(''); setKitError(data.error || 'Could not read that file.'); return; }
      // A full load (not a client navigation) so nothing from the learner's own form can carry into the worked example.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      if (data.kind === 'sample') { window.location.href = `${BASE}/${toolId}?demo=1`; return; }
      if (data.kind === 'template') {
        const n = applyTemplate(data.fields as FrameworkField[]);
        dirtyRef.current = true;
        await flushSave({ reason: 'template' });
        const warnings: string[] = Array.isArray(data.warnings) ? data.warnings.map(String) : [];
        setUploadNote(
          <>
            <div>Imported {n} part{n === 1 ? '' : 's'} from {file.name} — saved.</div>
            {warnings.length > 0 && (
              <div className="mt-1.5 text-eccellere-ink-mid">
                {warnings.length === 1 ? 'One entry was' : `${warnings.length} entries were`} not understood and left blank:
                <ul className="m-0 mt-1 list-disc space-y-0.5 pl-5">
                  {warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
                  {warnings.length > 5 && <li>…and {warnings.length - 5} more.</li>}
                </ul>
              </div>
            )}
          </>
        );
        return;
      }
      await extractFromDocument(file);
    } catch {
      setUploadNote('Could not reach the server. Try again.');
    } finally {
      setUploadBusy(false);
    }
  }

  // ── Analyse ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  async function runAnalyze() {
    if (!framework) return;
    if (!caseId) { setAnalyzeNote(<>Choose or start a problem first — <Link href={BASE} className="text-eccellere-gold font-semibold">My problems</Link>.</>); return; }
    setAnalyzeLoading(true);
    setAnalyzeNote('Analysing your answers…');
    try {
      if (timerRef.current) clearTimeout(timerRef.current);
      const res = await fetch('/api/problem-solving/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId: framework.id, caseId, fields: toPayload(savedFields()) }),
      });
      if (res.status === 401) { setAnalyzeNote(loginPrompt(`${BASE}/${toolId}`)); return; }
      const data = await res.json();
      if (!res.ok) { setAnalyzeNote(data.error || 'Could not analyse right now.'); return; }
      // The server has already saved the answers, the analysis, the recommendations and the actionables.
      dirtyRef.current = false;
      setRecord(data.record as FillinRecord);
      setSavedAt(new Date());
      setSaveState('saved');
      const used = [
        data.hasBusinessContext ? 'profile' : '',
        ...(Array.isArray(data.usedUpstream) ? data.usedUpstream : []),
      ].filter(Boolean);
      setAnalyzeNote(`Saved${used.length ? ` — grounded in your ${used.join(', ')}` : ''}. Tools that build on this one can now use it.`);
    } catch {
      setAnalyzeNote('Could not reach the server. Try again.');
    } finally {
      setAnalyzeLoading(false);
    }
  }

  async function saveMethodology() {
    if (!framework) return;
    setMethodologySaving(true);
    setMethodologyNote('');
    try {
      const res = await fetch('/api/problem-solving/skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId: framework.id, skillContent: methodologyDraft }),
      });
      const data = await res.json();
      if (!res.ok) { setMethodologyNote(data.error || 'Could not save methodology.'); return; }
      setMethodology(methodologyDraft);
      setMethodologyEditing(false);
      setMethodologyNote('Saved — future "Update with AI" and "Analyse" runs will use this.');
    } catch {
      setMethodologyNote('Could not reach the server. Try again.');
    } finally {
      setMethodologySaving(false);
    }
  }

  // ── What the page shows ─────────────────────────────────────────────────────────────────────────────────────────────
  const analysis: StrategyAnalysis | null = demoActive ? sample!.analysis : record?.analysis ?? null;
  const recommendations: StrategyRecommendation[] = demoActive ? sample!.recommendations.map((text) => ({ text })) : record?.recommendations ?? [];
  const actionables: StrategyActionable[] = demoActive ? sample!.actionables : record?.actionables ?? [];

  // Is the saved analysis still about what is on screen? (Compared on content, never on the source badge.)
  const status: FillinStatus = useMemo(() => {
    if (!structure) return 'not_started';
    const fields = alignFields(
      fieldsFromValues(structure, form.values, form.sources).map((f) => ({ label: f.label })),
      fieldsFromValues(structure, form.values, form.sources)
    );
    return fillinStatus({ fields, analysis: record?.analysis ?? null, analysisFingerprint: record?.analysisFingerprint ?? null });
  }, [structure, form, record]);
  const filledCount = structure ? fieldsFromValues(structure, form.values, form.sources).filter((f) => f.value.trim()).length : 0;

  // One-click suggestions from the saved work of the tools this one builds on.
  const suggestions = useMemo(() => {
    const out: Record<string, Suggestion> = {};
    if (!structure || demoActive || !connections) return out;
    for (const p of partsOf(structure)) {
      if (!isField(p) || !p.prefill || typeof p.prefill === 'string') continue;
      const { upstream, output } = p.prefill;
      const conn = connections.upstream.find((u) => u.toolId === upstream);
      const value = conn?.outputs.find((o) => o.key === output)?.value;
      if (conn && value) out[p.key] = { fromName: conn.name, value };
    }
    return out;
  }, [structure, connections, demoActive]);

  function downloadTxt() {
    if (!framework || !structure) return;
    const lines = [framework.name, '', '— ANSWERS —', renderValuesForPrompt(structure, form.values)];
    if (analysis) {
      lines.push('', '— ANALYSIS —');
      if (analysis.verdict) lines.push(`Verdict: ${analysis.verdict.label}${analysis.verdict.rationale ? ` — ${analysis.verdict.rationale}` : ''}`);
      if (analysis.summary) lines.push(analysis.summary);
      analysis.findings.forEach((f, i) => lines.push(`${i + 1}. ${f.title ? `${f.title}: ` : ''}${f.detail}`));
      if (analysis.watchouts.length) { lines.push('Watch-outs:'); analysis.watchouts.forEach((w) => lines.push(`- ${w}`)); }
    }
    if (recommendations.length) {
      lines.push('', '— RECOMMENDATIONS —');
      recommendations.forEach((r, i) => lines.push(`${i + 1}. ${r.text}`));
    }
    if (actionables.length) {
      lines.push('', '— ACTIONABLES —');
      actionables.forEach((a, i) => lines.push(`${i + 1}. [${a.priority}] ${a.action} — Owner: ${a.owner} — Timeframe: ${a.timeframe}`));
    }
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
    a.download = `${framework.id}.txt`;
    a.click();
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-eccellere-cream">
        <Header />
        <main className="max-w-3xl mx-auto px-4 md:px-6 pt-24 pb-20">
          <p className="text-sm text-eccellere-ink-light">
            That tool doesn&apos;t exist. <Link href={BASE} className="text-eccellere-gold font-semibold">Back to Problem Solving →</Link>
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  const steps: { label: string; text: string }[] = framework
    ? [
        { label: 'What this does', text: framework.does },
        { label: 'When to use it', text: framework.when },
        ...(framework.whenNot ? [{ label: 'When NOT to use it', text: framework.whenNot }] : []),
        { label: 'What happens next', text: framework.next },
      ]
    : [];

  const saveLine =
    client === null ? <>Your answers are not being saved — {loginPrompt(`${BASE}/${toolId}`)} to keep them.</>
    : !caseId ? 'Choose or start a problem to save your answers.'
    : saveState === 'saving' || saveState === 'pending' ? 'Saving…'
    : saveState === 'error' ? 'Could not save — will retry when you keep typing.'
    : savedAt ? `✓ Saved automatically · ${timeOf(savedAt)}`
    : record?.updatedAt ? `✓ Saved · ${timeOf(new Date(record.updatedAt))}`
    : 'Saved automatically as you type.';

  const idName = (id: string) => ({ id, name: nameOf(id) });
  const caseQuery = caseId ? `?case=${caseId}` : '';
  const demoQuery = demoActive ? '?demo=1' : caseQuery;

  return (
    <div className="ws-surface min-h-screen bg-eccellere-cream">
      <Header />
      <main className="max-w-5xl mx-auto px-4 md:px-8 pt-10 pb-24">
        <Link href={`${BASE}${caseQuery}`} className="text-xs font-semibold text-eccellere-gold hover:underline mb-4 inline-block">← Back to Problem Solving</Link>

        {demoActive && <DemoBanner company={SAMPLE_COMPANY} exitHref={`${BASE}/${toolId}${caseQuery}`} exitLabel="Exit the worked example" className="mb-6" />}
        {!demo && client && problem !== undefined && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-l-2 border-eccellere-teal bg-white px-4 py-3 text-sm text-eccellere-ink-mid">
            {problem
              ? <p className="m-0"><span className="text-eccellere-ink-light">Working on: </span><span className="font-semibold text-eccellere-ink">{problem.title}</span></p>
              : <p className="m-0">Choose one of your problems, or start a new one, and everything you fill in here is saved to it.</p>}
            <Link href={BASE} className="font-semibold text-eccellere-teal hover:underline">{problem ? 'Switch problem' : 'My problems'} →</Link>
          </div>
        )}
        {demo && !demoActive && framework && structure && <p className="mb-4 text-xs text-eccellere-ink-light">There is no worked example for this tool yet — here is the tool itself.</p>}
        {loadError && <p className="text-sm text-eccellere-ink-light">{loadError}</p>}
        {!framework && !loadError && <p className="text-sm text-eccellere-ink-light">Loading…</p>}

        {framework && (
          <>
            {/* Header card */}
            <div className="bg-white border border-eccellere-border rounded-[2px] p-8 md:p-10 mb-6">
              <h1 className="font-display text-3xl md:text-5xl font-light text-eccellere-ink leading-tight mb-3">{framework.name}</h1>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-block rounded-[2px] border border-eccellere-border bg-eccellere-cream px-2.5 py-1 text-xs text-eccellere-ink-mid">{framework.stage}</span>
                <span className="inline-block rounded-[2px] border border-eccellere-border bg-eccellere-cream px-2.5 py-1 text-xs text-eccellere-ink-mid capitalize">{framework.nature}</span>
                {framework.fits.length > 0 && (
                  <span className="inline-block rounded-[2px] border border-eccellere-border bg-eccellere-cream px-2.5 py-1 text-xs text-eccellere-ink-mid">
                    Fits: {framework.fits.map((f) => FIT_LABEL.get(f) ?? f).join(', ')}
                  </span>
                )}
                {demoActive
                  ? <span className="inline-block rounded-[2px] border border-eccellere-gold-light bg-eccellere-gold-pale px-2.5 py-1 text-xs font-semibold text-eccellere-gold">Worked example</span>
                  : client && status !== 'not_started' && (
                    <span className={`inline-block rounded-[2px] border px-2.5 py-1 text-xs font-semibold ${STATUS_CHIP[status].cls}`}>{STATUS_CHIP[status].label}</span>
                  )}
              </div>
            </div>

            {/* The industry-standard model, drawn */}
            {modelInfo?.diagramSvg && <ModelDiagramCard svg={modelInfo.diagramSvg} reference={modelInfo.reference} name={framework.name} />}

            <div className="min-w-0 space-y-6">
                {/* Steps */}
                <div className="grid grid-cols-1 gap-x-10 bg-white border border-eccellere-border rounded-[2px] p-6 md:grid-cols-2 md:p-8">
                  {steps.map((s, i) => (
                    <div key={s.label} className="flex gap-3 py-3">
                      <span className="font-display text-eccellere-gold text-lg font-semibold w-6 flex-shrink-0">{i + 1}</span>
                      <div>
                        <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-eccellere-gold mb-1">{s.label}</div>
                        <div className="text-sm text-eccellere-ink-mid leading-relaxed">{s.text}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* The golden thread: what this builds on, what it feeds, and where the client stands in each */}
                <ConnectionsPanel
                  upstream={framework.upstream.map(idName)}
                  downstream={framework.downstream.map(idName)}
                  connections={connections}
                  explain={!!client && !demoActive}
                  query={demoQuery}
                  sample={demoActive}
                  basePath={BASE}
                />

                {/* AI draft */}
                {!demoActive && (
                  <div className="bg-white border border-eccellere-border rounded-[2px] p-6 md:p-8">
                    <button
                      onClick={runAI}
                      disabled={aiLoading || !structure}
                      className="w-full flex items-center justify-center bg-eccellere-gold hover:bg-eccellere-gold-light disabled:opacity-60 text-white text-sm font-semibold py-3 rounded-[2px] transition-colors"
                    >
                      {aiLoading ? 'Drafting from your context…' : filledCount > 0 ? 'Update with AI — fill what I haven’t answered' : 'Update with AI — based on your problem, your profile & earlier tools'}
                    </button>
                    <div role="status" className="text-xs text-eccellere-ink-light mt-2 min-h-[1.2em]">
                      {aiNote}
                      {record?.previousFields && (
                        <button onClick={undoLast} className="ml-2 font-semibold text-eccellere-gold hover:underline">
                          Undo {record.previousReason === 'ai' ? 'the AI fill' : 'the import'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Worked example, blank template, sample workbook and upload */}
                {kit && (
                  <KitPanel
                    id="strategy-kit"
                    eyebrow="Worked example & template"
                    title={demoActive ? 'Take the template away' : 'See it worked — or fill it in offline'}
                    blurb={demoActive
                      ? 'This tool as a fictional company would complete it. Download the blank template to fill in offline, or the sample workbook to see exactly how an answer is entered.'
                      : 'A fictional company’s completed example, a blank Excel template that mirrors the form below, and an upload that reads a filled one back — no AI needed.'}
                    primary={!demoActive && modelInfo?.sampleAvailable ? { label: 'See a worked example', href: `${BASE}/${toolId}?demo=1` } : undefined}
                    upload={demoActive ? undefined : { label: 'Upload a filled template or document', busyLabel: 'Reading file…', accept: '.xlsx,.xls,.docx,.pdf,.txt', onFile: handleUpload, busy: uploadBusy }}
                    downloads={[
                      ...(demoActive || modelInfo?.sampleAvailable ? [{ label: 'Download sample workbook', onClick: downloadSample }] : []),
                      { label: 'Download blank template', onClick: downloadBlank },
                    ]}
                    note={demoActive
                      ? 'The sample is a fictional company and is never saved as your data.'
                      : 'The sample is a fictional company and is never saved as your data. A filled template of this tool is read exactly; any other document (PDF, Word, Excel, text) is read by AI and only fills what you have left blank.'}
                    error={kitError}
                  >
                    {uploadNote && (
                      <div role="status" className="mt-4 border border-eccellere-teal/30 bg-eccellere-teal/5 px-4 py-3 text-[12.5px] text-eccellere-ink">
                        {uploadNote}
                        {record?.previousFields && (record.previousReason === 'template' || record.previousReason === 'document') && (
                          <button onClick={undoLast} className="ml-2 font-semibold text-eccellere-gold hover:underline">Undo the import</button>
                        )}
                      </div>
                    )}
                  </KitPanel>
                )}

                {/* The guided form, in the model's own structure */}
                <div>
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-eccellere-gold">
                      {demoActive ? 'The completed example' : 'Guided fill-in — no length limit, be as detailed as the evidence supports'}
                    </div>
                    {!demoActive && <div role="status" className={`text-xs font-semibold ${saveState === 'error' ? 'text-eccellere-error' : 'text-eccellere-teal'}`}>{saveLine}</div>}
                  </div>
                  {structure
                    ? <ModelForm structure={structure} values={form.values} sources={form.sources} onChange={onFormChange} onBlur={saveNow} readOnly={demoActive} why={demoActive ? sample!.why : undefined} suggestions={suggestions} />
                    : <p className="text-sm text-eccellere-ink-light">Loading the form…</p>}

                  {unmatched.length > 0 && !demoActive && (
                    <div className="mt-6 bg-white border border-eccellere-border rounded-[2px] p-6">
                      <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-eccellere-gold mb-2">Earlier answers that do not fit this model</div>
                      <p className="m-0 mb-3 text-xs text-eccellere-ink-light">You saved these in an earlier version of the tool. They are kept here so nothing is lost.</p>
                      <ul className="m-0 list-none space-y-2 p-0">
                        {unmatched.map((f) => (
                          <li key={f.label} className="text-sm text-eccellere-ink-mid"><span className="font-semibold text-eccellere-ink">{f.label}: </span>{f.value}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button onClick={() => window.print()} className="border border-eccellere-gold text-eccellere-gold hover:bg-eccellere-gold hover:text-white text-sm font-semibold px-4 py-2 rounded-[2px] transition-colors">
                      Print
                    </button>
                    <button onClick={downloadTxt} className="border border-eccellere-gold text-eccellere-gold hover:bg-eccellere-gold hover:text-white text-sm font-semibold px-4 py-2 rounded-[2px] transition-colors">
                      Download
                    </button>
                  </div>
                </div>

                {/* Analysis, Recommendations & Actionables — saved by the server, read by the tools downstream */}
                <AnalysisPanel
                  analysis={analysis}
                  recommendations={recommendations}
                  actionables={actionables}
                  status={status}
                  filledCount={filledCount}
                  loading={analyzeLoading}
                  note={analyzeNote}
                  onAnalyze={runAnalyze}
                  readOnly={demoActive}
                />

                {/* Methodology / skill.md */}
                <div className="bg-white border border-eccellere-border rounded-[2px] p-5">
                  <button onClick={() => setMethodologyOpen((o) => !o)} className="w-full flex items-center justify-between text-left">
                    <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-eccellere-gold">Methodology</span>
                    <span className="text-xs text-eccellere-gold">{methodologyOpen ? 'Hide ↑' : 'How is this analysed? ↓'}</span>
                  </button>
                  {methodologyOpen && (
                    <div className="mt-3 pt-3 border-t border-eccellere-border">
                      <p className="text-xs text-eccellere-ink-light mb-3">
                        This is the exact methodology &ldquo;Update with AI&rdquo; and &ldquo;Analyse&rdquo; follow for this framework.
                        {canEditMethodology ? ' Editing it changes their behaviour immediately.' : ''}
                      </p>
                      {methodologyEditing ? (
                        <>
                          <textarea
                            value={methodologyDraft}
                            onChange={(e) => setMethodologyDraft(e.target.value)}
                            rows={Math.max(10, autoRows(methodologyDraft))}
                            className="w-full text-xs font-mono leading-relaxed text-eccellere-ink bg-eccellere-cream border border-eccellere-border rounded-[2px] px-3 py-2.5 resize-y"
                          />
                          <div className="flex items-center gap-2 mt-2">
                            <button onClick={saveMethodology} disabled={methodologySaving} className="bg-eccellere-gold hover:bg-eccellere-gold-light disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-[2px] transition-colors">
                              {methodologySaving ? 'Saving…' : 'Save methodology'}
                            </button>
                            <button onClick={() => { setMethodologyDraft(methodology); setMethodologyEditing(false); }} className="text-xs text-eccellere-ink-light hover:text-eccellere-ink">
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <pre className="whitespace-pre-wrap text-xs text-eccellere-ink-mid leading-relaxed font-mono max-h-96 overflow-y-auto bg-eccellere-cream border border-eccellere-border rounded-[2px] p-3">
                            {methodology || 'Loading…'}
                          </pre>
                          {canEditMethodology && (
                            <button onClick={() => setMethodologyEditing(true)} className="text-xs text-eccellere-gold font-semibold hover:underline mt-2">
                              Edit methodology →
                            </button>
                          )}
                        </>
                      )}
                      {methodologyNote && <p className="text-xs text-eccellere-ink-light mt-2">{methodologyNote}</p>}
                    </div>
                  )}
                </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
