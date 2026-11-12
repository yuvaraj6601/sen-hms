"use client";

import { useEffect, useRef, useState } from "react";
import DataAnswerCard from "./DataAnswerCard";
import DietFormCard from "./DietFormCard";
import DietPlanCard from "./DietPlanCard";
import {
  CATEGORY_LABELS, buildDietRequest, groupQuestions, validateDietForm,
  type DataAnswer, type DietForm, type DietPlanResponse, type StaticQuestion,
} from "../../_lib/chatbot";

type View = "menu" | "data" | "diet-type" | "diet-search" | "diet-form" | "diet-loading" | "diet-result";

interface Msg { id: number; role: "user" | "bot"; text?: string; answer?: DataAnswer; suggestions?: string[]; }
interface PatientHit { id: number; uhid: string; name: string; age: number | null; gender: string | null; }

interface ChatState {
  open: boolean;
  view: View;
  messages: Msg[];
  input: string;
  thinking: boolean;
  error: string;
  questions: StaticQuestion[];
  search: string;
  hits: PatientHit[];
  searching: boolean;
  patientLabel: string;
  form: DietForm;
  formErrors: Record<string, string>;
  result: DietPlanResponse | null;
}

const EMPTY_FORM: DietForm = {
  age: "", gender: "", heightCm: "", weightKg: "", conditions: [],
  activity: "Moderate", goal: "Manage condition", foodPreference: "Vegetarian", allergies: "", specialNeeds: "",
};

const initial = (open = false): ChatState => ({
  open, view: "menu", messages: [], input: "", thinking: false, error: "", questions: [],
  search: "", hits: [], searching: false, patientLabel: "",
  form: EMPTY_FORM, formErrors: {}, result: null,
});

const DIET_ROLES = ["Admin", "Managing Director", "Doctor", "Nurse"];

async function api<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; data: T | null; error: string }> {
  try {
    const res = await fetch(path, { cache: "no-store", headers: { "Content-Type": "application/json" }, ...init });
    const json = await res.json();
    return { ok: res.ok && json.success, data: (json.data ?? null) as T | null, error: json.error ?? "Something went wrong" };
  } catch (err) {
    console.warn("Chatbot request failed", err);
    return { ok: false, data: null, error: "Cannot reach the server. Please try again." };
  }
}

function BotAvatar() {
  return <span className="w-8 h-8 rounded-full bg-[#00059f] text-white flex items-center justify-center text-xs flex-shrink-0">AI</span>;
}

const GENDER_MAP: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };

export default function ChatBot({ role }: { role: string }) {
  const [state, setState] = useState<ChatState>(initial());
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canDiet = DIET_ROLES.includes(role);

  // Follow the conversation, but when a view opens fresh (no messages yet) start at the top.
  useEffect(() => {
    if (state.view === "menu" || (state.view === "data" && state.messages.length === 0)) {
      scrollRef.current?.scrollTo({ top: 0 });
    } else {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [state.messages, state.view, state.thinking, state.result, state.questions]);

  // Debounced patient search (existing-patient path). Loading/clearing state is set in the input handler.
  useEffect(() => {
    if (state.view !== "diet-search" || state.search.trim().length < 2) return;
    const t = setTimeout(async () => {
      const r = await api<{ content: PatientHit[] }>(`/api/patients?search=${encodeURIComponent(state.search.trim())}&size=8`);
      setState(p => ({ ...p, searching: false, hits: r.ok && r.data ? r.data.content : [] }));
    }, 300);
    return () => clearTimeout(t);
  }, [state.search, state.view]);

  function reset() { setState(prev => ({ ...initial(true), questions: prev.questions })); }

  async function openDataChat() {
    setState(p => ({ ...p, view: "data", error: "" }));
    if (state.questions.length === 0) {
      const r = await api<StaticQuestion[]>("/api/chatbot/questions");
      if (r.ok && r.data) setState(p => ({ ...p, questions: r.data ?? [] }));
    }
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q || state.thinking) return;
    const id = nextId.current++;
    setState(p => ({ ...p, input: "", thinking: true, messages: [...p.messages, { id, role: "user", text: q }] }));
    const r = await api<DataAnswer>("/api/chatbot/data-query", { method: "POST", body: JSON.stringify({ question: q }) });
    const reply: Msg = r.ok && r.data
      ? {
          id: nextId.current++, role: "bot", text: r.data.answer,
          answer: r.data.rows.length > 0 || r.data.chart ? r.data : undefined,
          suggestions: r.data.suggestions,
        }
      : { id: nextId.current++, role: "bot", text: r.error };
    setState(p => ({ ...p, thinking: false, messages: [...p.messages, reply] }));
  }

  async function pickPatient(h: PatientHit) {
    setState(p => ({
      ...p, view: "diet-form", patientLabel: h.name, search: "", hits: [],
      form: { ...EMPTY_FORM, age: h.age ? String(h.age) : "", gender: h.gender ? GENDER_MAP[h.gender] ?? "" : "" },
    }));
    const v = await api<{ recordedAt: string; weight: number | null; height: number | null }[]>(`/api/case-sheet/vitals?patientId=${h.id}`);
    if (v.ok && v.data) {
      const withHW = [...v.data].filter(x => x.weight || x.height).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
      if (withHW) {
        setState(p => ({ ...p, form: {
          ...p.form,
          heightCm: p.form.heightCm || (withHW.height ? String(withHW.height) : ""),
          weightKg: p.form.weightKg || (withHW.weight ? String(withHW.weight) : ""),
        } }));
      }
    }
  }

  async function generateDiet() {
    const errors = validateDietForm(state.form);
    if (Object.keys(errors).length) { setState(p => ({ ...p, formErrors: errors })); return; }
    setState(p => ({ ...p, view: "diet-loading", formErrors: {}, error: "" }));
    const r = await api<DietPlanResponse>("/api/chatbot/diet-plan", { method: "POST", body: JSON.stringify(buildDietRequest(state.form)) });
    if (r.ok && r.data) setState(p => ({ ...p, view: "diet-result", result: r.data }));
    else setState(p => ({ ...p, view: "diet-form", error: r.error }));
  }

  const { open, view } = state;
  const grouped = groupQuestions(state.questions);
  const bubble = "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 max-w-[85%] whitespace-pre-line";
  const optionBtn = "w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 hover:border-[#00059f] hover:bg-sky-50 transition-colors";

  return (
    <>
      {!open && (
        <button type="button" aria-label="Open AI assistant" onClick={() => setState(p => ({ ...p, open: true }))}
          className="fixed bottom-5 right-5 z-[60] w-14 h-14 rounded-full bg-[#00059f] text-white shadow-lg hover:bg-blue-800 transition-colors flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m-9 6l2.2-3.3A8 8 0 1112 20H4z" /></svg>
        </button>
      )}

      {open && (
        <section role="dialog" aria-label="AI Assistant"
          className="fixed z-[60] bottom-4 right-4 sm:bottom-5 sm:right-5 w-[calc(100vw-2rem)] sm:w-[420px] h-[min(80vh,660px)] rounded-2xl shadow-2xl bg-[#f6f9fb] flex flex-col overflow-hidden border border-slate-200">
          <header className="bg-[#00059f] text-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-sm">✦</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">AI Assistant</p>
              <p className="text-xs text-white/70 leading-tight">Sen Hospital</p>
            </div>
            {view !== "menu" && (
              <button type="button" aria-label="Start over" onClick={reset} className="p-1.5 rounded-md hover:bg-white/15">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M5.6 15A8 8 0 0019 12M18.4 9A8 8 0 005 12" /></svg>
              </button>
            )}
            <button type="button" aria-label="Close assistant" onClick={() => setState(p => ({ ...p, open: false }))} className="p-1.5 rounded-md hover:bg-white/15">✕</button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {view === "menu" && (
              <>
                <div className="flex gap-2 items-start"><BotAvatar /><p className={bubble}>Hi, I&apos;m your AI assistant. What would you like to do?</p></div>
                {canDiet && <button type="button" className={optionBtn} onClick={() => setState(p => ({ ...p, view: "diet-type" }))}>🥗 Diet Recommendation</button>}
                <button type="button" className={optionBtn} onClick={openDataChat}>📊 Ask about hospital data</button>
              </>
            )}

            {view === "data" && (
              <>
                <div className="flex gap-2 items-start">
                  <BotAvatar />
                  <p className={bubble}>Ask me about hospital data — patient counts, revenue, expenses, insurance, doctor-wise visits, lab volumes, bed occupancy, and more.</p>
                </div>
                {state.messages.length === 0 && grouped.map(g => (
                  <div key={g.category} className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 pt-1">{CATEGORY_LABELS[g.category] ?? g.category}</p>
                    {g.questions.map(q => <button key={q.id} type="button" className={`${optionBtn} font-normal`} onClick={() => ask(q.text)}>{q.text}</button>)}
                  </div>
                ))}
                {state.messages.map(m => m.role === "user" ? (
                  <div key={m.id} className="flex justify-end"><p className="bg-[#00059f] text-white text-sm rounded-2xl px-4 py-2 max-w-[85%]">{m.text}</p></div>
                ) : (
                  <div key={m.id} className="flex gap-2 items-start">
                    <BotAvatar />
                    <div className="space-y-2 min-w-0 flex-1">
                      {m.text && <p className={bubble}>{m.text}</p>}
                      {m.answer && <DataAnswerCard answer={m.answer} />}
                      {m.suggestions?.map(sg => (
                        <button key={sg} type="button" className={`${optionBtn} font-normal`} onClick={() => ask(sg)}>{sg}</button>
                      ))}
                    </div>
                  </div>
                ))}
                {state.thinking && <div className="flex gap-2 items-center"><BotAvatar /><p className={`${bubble} text-slate-400`}>Thinking…</p></div>}
              </>
            )}

            {view === "diet-type" && (
              <>
                <div className="flex gap-2 items-start"><BotAvatar /><p className={bubble}>Is this for an existing patient or a new one?</p></div>
                <button type="button" className={optionBtn} onClick={() => setState(p => ({ ...p, view: "diet-search" }))}>🔎 Existing Patient</button>
                <button type="button" className={optionBtn} onClick={() => setState(p => ({ ...p, view: "diet-form", patientLabel: "", form: EMPTY_FORM }))}>➕ New / Walk-in</button>
              </>
            )}

            {view === "diet-search" && (
              <>
                <div className="flex gap-2 items-start"><BotAvatar /><p className={bubble}>Search the patient by name or UHID:</p></div>
                <input autoFocus value={state.search} onChange={e => { const v = e.target.value; setState(p => ({ ...p, search: v, searching: v.trim().length >= 2, hits: v.trim().length >= 2 ? p.hits : [] })); }}
                  aria-label="Search patient" className="w-full px-4 py-3 text-sm rounded-xl border-2 border-sky-400 bg-white focus:outline-none" />
                {state.searching && <p className="text-xs text-slate-400">Searching…</p>}
                {!state.searching && state.search.trim().length >= 2 && state.hits.length === 0 && <p className="text-xs text-slate-400">No patients found.</p>}
                {state.hits.map(h => (
                  <button key={h.id} type="button" className={optionBtn} onClick={() => pickPatient(h)}>
                    <span className="flex-1">{h.name}<span className="block text-xs font-normal text-slate-500">{h.uhid}{h.age ? ` · ${h.age} yrs` : ""}</span></span>
                  </button>
                ))}
              </>
            )}

            {view === "diet-form" && (
              <>
                <div className="flex gap-2 items-start">
                  <BotAvatar />
                  <p className={bubble}>{state.patientLabel ? `Great — ${state.patientLabel}. I need a few details to build the diet plan.` : "I need a few details to build the diet plan."}</p>
                </div>
                {state.error && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{state.error}</p>}
                <DietFormCard form={state.form} errors={state.formErrors}
                  onChange={patch => setState(p => ({ ...p, form: { ...p.form, ...patch } }))} onSubmit={generateDiet} />
              </>
            )}

            {view === "diet-loading" && (
              <div className="space-y-3" aria-live="polite">
                <p className="text-sm text-slate-500">✦ Generating diet plan…</p>
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 animate-pulse">
                  {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-3 rounded bg-slate-200" style={{ width: `${95 - i * 9}%` }} />)}
                </div>
              </div>
            )}

            {view === "diet-result" && state.result && (
              <DietPlanCard result={state.result} ageGender={`${state.form.age} yrs · ${state.form.gender}`} />
            )}
            <div ref={bottomRef} />
          </div>

          {view === "data" && (
            <form onSubmit={e => { e.preventDefault(); void ask(state.input); }} className="border-t border-slate-200 bg-white p-3 flex gap-2 flex-shrink-0">
              <input value={state.input} onChange={e => setState(p => ({ ...p, input: e.target.value }))} maxLength={300}
                placeholder="Ask a question…" aria-label="Ask a question"
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400" />
              <button type="submit" aria-label="Send" disabled={state.thinking || !state.input.trim()}
                className="px-3 rounded-xl bg-[#00059f] text-white disabled:opacity-40">➤</button>
            </form>
          )}
        </section>
      )}
    </>
  );
}
