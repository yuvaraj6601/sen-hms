"use client";

import { useState, useEffect } from "react";
import Modal, { FormField, Input, Select, Textarea } from "./Modal";
import { printHtml } from "../_lib/print";
import { buildAdvanceReceiptHtml, type AdvanceReceiptSplit } from "../_lib/print-advance-receipt";

// ── Types ───────────────────────────────────────────────────────────────────

/** Minimal patient context the modal needs to record a receipt. */
export interface CollectCashPatient {
  id: number;
  uhid: string;
  name: string;
  age: number | null;
  gender: string | null;
  doctorName?: string | null;
  /** Active admission id, when known (resolved on the server when omitted). */
  admissionId?: number | null;
  admissionNo?: string | null;
  wardName?: string | null;
  bedNumber?: string | null;
}

type ReceiptType = "ADVANCE" | "SETTLEMENT" | "LAB" | "REFUND";
type PayMode = "CASH" | "CARD" | "CREDIT_CARD" | "DEBIT_CARD" | "UPI" | "CHEQUE";
type PayModeUI = PayMode | "MIXED";

interface Split { mode: PayMode; amount: number; ref: string; }

// ── Constants ─────────────────────────────────────────────────────────────────

const RECEIPT_TYPES: { value: ReceiptType; label: string }[] = [
  { value: "ADVANCE",    label: "Advance" },
  { value: "SETTLEMENT", label: "Settlement" },
  { value: "LAB",        label: "Lab" },
  { value: "REFUND",     label: "Refund" },
];

const PAY_MODES: { value: PayMode; label: string }[] = [
  { value: "CASH",        label: "Cash" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "DEBIT_CARD",  label: "Debit Card" },
  { value: "UPI",         label: "UPI" },
  { value: "CHEQUE",      label: "Cheque" },
];
const PAY_MODES_UI: { value: PayModeUI; label: string }[] = [
  ...PAY_MODES,
  { value: "MIXED", label: "Mixed (Split)" },
];
const SPLIT_MODES: PayMode[] = ["CASH", "CREDIT_CARD", "DEBIT_CARD", "UPI", "CHEQUE"];

function splitSum(s: Split[]) { return s.reduce((a, x) => a + (x.amount || 0), 0); }
function inr(n: number) { return "\u20B9" + (n || 0).toLocaleString("en-IN"); }
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  const json = await res.json();
  return { ok: res.ok && json.success, data: json.data, error: json.error ?? "Request failed" };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CollectCashModal({
  open, onClose, patient, receivedBy, onSaved, initialReceiptType,
}: {
  open: boolean;
  onClose: () => void;
  patient: CollectCashPatient | null;
  /** Logged-in user name — recorded as "received by" on the receipt. */
  receivedBy?: string | null;
  /** Called after a receipt is saved (so the caller can refresh its ledger). */
  onSaved?: () => void;
  /** Pre-select a receipt type when the modal opens (e.g. "LAB" from a lab-order row). */
  initialReceiptType?: ReceiptType | null;
}) {
  const [receiptType, setReceiptType] = useState<ReceiptType>("ADVANCE");
  const [amount, setAmount]   = useState<number>(0);
  const [payMode, setPayMode] = useState<PayModeUI>("CASH");
  const [payRef, setPayRef]   = useState("");
  const [splits, setSplits]   = useState<Split[]>([]);
  const [notes, setNotes]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");

  // Reset the form each time the modal is opened for a patient.
  useEffect(() => {
    if (open) {
      setReceiptType(initialReceiptType ?? "ADVANCE");
      setAmount(0);
      setPayMode("CASH");
      setPayRef("");
      setSplits([]);
      setNotes("");
      setErr("");
    }
  }, [open, patient?.id, initialReceiptType]);

  // Keep amount in sync with split total when MIXED.
  useEffect(() => {
    if (payMode === "MIXED") setAmount(splitSum(splits));
  }, [payMode, splits]);

  function addSplit() {
    setSplits(prev => {
      const used = new Set(prev.map(s => s.mode));
      const next = SPLIT_MODES.find(m => !used.has(m)) ?? "CASH";
      return [...prev, { mode: next, amount: 0, ref: "" }];
    });
  }
  function removeSplit(i: number) { setSplits(prev => prev.filter((_, x) => x !== i)); }
  function updateSplit(i: number, field: keyof Split, val: unknown) {
    setSplits(prev => prev.map((s, x) => (x === i ? { ...s, [field]: val } : s)));
    setErr("");
  }

  async function handleSubmit() {
    if (!patient) return;

    // Determine the signed amount: REFUND is stored negative.
    let effectiveAmount = amount;
    if (payMode === "MIXED") {
      const valid = splits.filter(s => s.amount > 0);
      if (valid.length === 0) { setErr("Add at least one split with amount > 0"); return; }
      effectiveAmount = splitSum(valid);
    }
    if (!effectiveAmount || effectiveAmount <= 0) { setErr("Enter an amount greater than 0"); return; }

    const signed = receiptType === "REFUND" ? -Math.abs(effectiveAmount) : Math.abs(effectiveAmount);

    const splitsJson = payMode === "MIXED"
      ? JSON.stringify(splits.filter(s => s.amount > 0).map(s => ({ mode: s.mode, amount: s.amount, ref: s.ref || null })))
      : null;

    const refNo = payMode !== "MIXED" && payMode !== "CASH" ? (payRef || null) : null;
    const body = {
      patientId:    patient.id,
      admissionId:  patient.admissionId ?? null,
      patientName:  patient.name,
      uhid:         patient.uhid,
      age:          patient.age,
      gender:       patient.gender,
      doctorName:   patient.doctorName ?? null,
      ward:         patient.wardName ?? null,
      bedNumber:    patient.bedNumber ?? null,
      date:         localDate(),
      amount:       signed,
      paymentMode:  payMode,
      paymentSplitsJson: splitsJson,
      receiptType,
      referenceNo:  refNo,
      receivedBy:   receivedBy || null,
    };

    setSaving(true);
    setErr("");
    // One bill per admission, many receipts: the backend find-or-creates the
    // admission's single bill and attaches this receipt. Returns the bill.
    const res = await apiFetch("/api/bills/collect", { method: "POST", body: JSON.stringify(body) });
    setSaving(false);

    if (!res.ok) { setErr(res.error); return; }

    // The new receipt is the most-recently-created payment on the returned bill.
    const bill = res.data as {
      payments?: { id: number; date: string; receiptNo?: string; amount: number }[];
    };
    const saved = (bill.payments ?? []).reduce<{ id: number; date: string; receiptNo?: string } | null>(
      (latest, p) => (!latest || p.id > latest.id ? p : latest), null);

    const printSplits: AdvanceReceiptSplit[] | null = payMode === "MIXED"
      ? splits.filter(s => s.amount > 0).map(s => ({ mode: s.mode, amount: s.amount, ref: s.ref || null }))
      : null;

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    printHtml(buildAdvanceReceiptHtml({
      receiptNo:   saved?.receiptNo ?? "—",
      date:        saved?.date ?? body.date,
      time:        nowTime(),
      patientId:   patient.id,
      patientName: patient.name,
      uhid:        patient.uhid,
      admissionNo: patient.admissionNo ?? null,
      ward:        patient.wardName ?? null,
      bedNumber:   patient.bedNumber ?? null,
      doctorName:  patient.doctorName ?? null,
      age:         patient.age,
      gender:      patient.gender,
      amount:      signed,
      receiptType,
      paymentMode: payMode,
      splits:      printSplits,
      referenceNo: refNo,
      receivedBy:  receivedBy ?? null,
    }, origin));

    onSaved?.();
    onClose();
  }

  const isRefund = receiptType === "REFUND";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={patient ? `Collect Cash — ${patient.name}` : "Collect Cash"}
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-slate-100 text-slate-600 font-medium hover:bg-slate-200">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-sky-600 text-white font-semibold hover:bg-sky-700 disabled:opacity-60">
            {saving ? "Saving…" : isRefund ? "Record Refund & Print" : "Collect & Print Receipt"}
          </button>
        </>
      }
    >
      {patient && (
        <div className="space-y-4">
          {/* Patient summary */}
          <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">{patient.name}</span>
            {" · "}{patient.uhid}
            {patient.admissionNo ? ` · ${patient.admissionNo}` : ""}
            {patient.wardName ? ` · ${patient.wardName}${patient.bedNumber ? " / Bed " + patient.bedNumber : ""}` : ""}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Receipt Type" required>
              <Select value={receiptType} onChange={e => { setReceiptType(e.target.value as ReceiptType); setErr(""); }}>
                {RECEIPT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Payment Mode" required>
              <Select value={payMode} onChange={e => { setPayMode(e.target.value as PayModeUI); setErr(""); }}>
                {PAY_MODES_UI.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            </FormField>
          </div>

          {payMode !== "MIXED" ? (
            <div className="grid grid-cols-2 gap-3">
              <FormField label={isRefund ? "Refund Amount (₹)" : "Amount (₹)"} required>
                <Input type="number" min={0} value={amount || ""}
                  onChange={e => { setAmount(parseFloat(e.target.value) || 0); setErr(""); }}
                  placeholder="0" />
              </FormField>
              {payMode !== "CASH" && (
                <FormField label="Reference No">
                  <Input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Txn / cheque no" />
                </FormField>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Split Payment</p>
                <button type="button" onClick={addSplit}
                  className="text-xs text-sky-600 hover:text-sky-800 font-medium">+ Add split</button>
              </div>
              {splits.length === 0 && (
                <p className="text-xs text-slate-500">Add one row per mode, e.g. ₹2,500 Cash + ₹2,500 Card.</p>
              )}
              {splits.map((sp, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Select value={sp.mode} onChange={e => updateSplit(i, "mode", e.target.value as PayMode)}
                    className="w-28 flex-shrink-0">
                    {SPLIT_MODES.map(m => (
                      <option key={m} value={m}>{PAY_MODES.find(x => x.value === m)?.label ?? m}</option>
                    ))}
                  </Select>
                  <Input type="number" min={0} value={sp.amount || ""} placeholder="Amount (₹)"
                    className="w-28 flex-shrink-0"
                    onChange={e => updateSplit(i, "amount", parseFloat(e.target.value) || 0)} />
                  {sp.mode !== "CASH" && (
                    <Input value={sp.ref} placeholder="Reference no (optional)" className="flex-1 min-w-[110px]"
                      onChange={e => updateSplit(i, "ref", e.target.value)} />
                  )}
                  <button type="button" onClick={() => removeSplit(i)}
                    className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0 ml-auto">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <p className="text-xs text-right text-slate-600">
                Split total: <span className="font-semibold text-slate-800">{inr(splitSum(splits))}</span>
              </p>
            </div>
          )}

          <FormField label="Notes">
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Optional note for this receipt" />
          </FormField>

          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
      )}
    </Modal>
  );
}
