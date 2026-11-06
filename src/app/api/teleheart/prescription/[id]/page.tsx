
"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  HeartPulse,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  FileCheck2,
  RefreshCw,
} from "lucide-react";
import "./prescription.css";

type RecordData = Record<string, unknown>;

type Medicine = {
  medicine_name: string;
  dosage: string;
  instructions: string;
  quantity: string;
  notes: string;
};

const newMedicine = (): Medicine => ({
  medicine_name: "",
  dosage: "",
  instructions: "",
  quantity: "",
  notes: "",
});

function objectOf(value: unknown): RecordData {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as RecordData)
    : {};
}

function unwrap(value: unknown): unknown {
  const root = objectOf(value);
  return root.data ?? value;
}

function stringOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function prescriptionApi(
  action: string,
  consultationId: string,
  extra: RecordData = {}
): Promise<unknown> {
  const response = await fetch("/api/teleheart/prescription", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      consultationId,
      ...extra,
    }),
  });

  const result: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const root = objectOf(result);
    const error = objectOf(root.error);

    throw new Error(
      `HTTP ${response.status}: ` +
      stringOf(error.message ?? root.message) ||
      "Permintaan resep gagal"
    );
  }

  return result;
}

export default function PrescriptionPage() {
  const params = useParams<{ id: string }>();
  const consultationId = params.id;

  const [patientName, setPatientName] = useState("");
  const [status, setStatus] = useState("");
  const [medicines, setMedicines] = useState<Medicine[]>([
    newMedicine(),
  ]);
  const [notes, setNotes] = useState("");

  const [hasDraft, setHasDraft] = useState(false);
  const [issued, setIssued] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isActive = ["in_progress", "active"].includes(status);
  const canEdit = isActive && !issued && !busy && !loading;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const detailResponse = await prescriptionApi(
        "detail",
        consultationId
      );

      const detailData = objectOf(unwrap(detailResponse));
      const detail = objectOf(
        detailData.consultation ?? detailData
      );
      const patient = objectOf(detail.patient);

      setPatientName(
        stringOf(detail.patient_name) ||
        stringOf(detail.patient_full_name) ||
        stringOf(patient.full_name) ||
        stringOf(patient.name) ||
        "Nama pasien belum tersedia"
      );

      setStatus(stringOf(detail.status).toLowerCase());

      const prescriptionResponse = await prescriptionApi(
        "getPrescription",
        consultationId
      );

      const raw = unwrap(prescriptionResponse);
      const data = objectOf(raw);
      const prescription = objectOf(data.prescription ?? data);

      if (!raw || Object.keys(prescription).length === 0) {
        setMedicines([newMedicine()]);
        setNotes("");
        setHasDraft(false);
        setIssued(false);
      } else {
        const sourceItems = prescription.items;

        const items: Medicine[] = Array.isArray(sourceItems)
          ? sourceItems.map((value) => {
              const item = objectOf(value);

              return {
                medicine_name: stringOf(item.medicine_name),
                dosage: stringOf(item.dosage),
                instructions: stringOf(item.instructions),
                quantity: stringOf(item.quantity),
                notes: stringOf(item.notes),
              };
            })
          : [];

        setMedicines(
          items.length > 0 ? items : [newMedicine()]
        );

        setNotes(stringOf(prescription.notes));
        setHasDraft(items.length > 0);

        setIssued(
          ["issued", "finalized"].includes(
            stringOf(prescription.status).toLowerCase()
          ) || Boolean(prescription.issued_at)
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memuat data resep"
      );
    } finally {
      setLoading(false);
    }
  }, [consultationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function editMedicine(
    index: number,
    field: keyof Medicine,
    value: string
  ) {
    setMedicines((current) =>
      current.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
    setHasDraft(false);
    setSuccess("");
  }

  async function saveDraft() {
    if (!canEdit) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      await prescriptionApi(
        "savePrescription",
        consultationId,
        { notes, items: medicines }
      );

      setHasDraft(true);
      setSuccess("Draft resep berhasil disimpan.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal menyimpan resep"
      );
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!canEdit || !hasDraft) return;

    const confirmed = window.confirm(
      "Pastikan obat, dosis, jumlah, dan aturan pakai sudah benar. Terbitkan resep ini?"
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      await prescriptionApi(
        "issuePrescription",
        consultationId
      );

      setIssued(true);
      setSuccess(
        "Resep berhasil diterbitkan. Periksa akses PDF melalui aplikasi pasien."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal menerbitkan resep"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="rx-page">
      <div className="rx-container">
        <header className="rx-header">
          <a className="rx-back" href="/portal">
            <ArrowLeft size={17} />
            Kembali ke Dashboard
          </a>

          <div className="rx-brand">
            <HeartPulse size={24} />
            <strong>TeleHeart</strong>
          </div>
        </header>

        <div className="rx-title">
          <div>
            <span>PORTAL DOKTER</span>
            <h1>Resep Digital</h1>
            <p>
              Buat, simpan, dan terbitkan resep untuk
              konsultasi pasien.
            </p>
          </div>

          <button
            className="rx-outline"
            onClick={() => void loadData()}
            disabled={loading || busy}
          >
            <RefreshCw size={16} />
            Perbarui
          </button>
        </div>

        <section className="rx-info">
          <div>
            <small>NAMA PASIEN</small>
            <strong>{patientName || "Memuat..."}</strong>
          </div>

          <div>
            <small>STATUS KONSULTASI</small>
            <strong>{status || "Memuat..."}</strong>
          </div>

          <div>
            <small>ID KONSULTASI</small>
            <span title={consultationId}>
              {consultationId.slice(0, 8)}...
            </span>
          </div>
        </section>

        {error && (
          <div className="rx-error" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="rx-success" role="status">
            {success}
          </div>
        )}

        {!loading && !isActive && (
          <div className="rx-warning">
            Resep hanya dapat dibuat ketika konsultasi
            sedang berlangsung.
          </div>
        )}

        {issued && (
          <div className="rx-success">
            Resep sudah diterbitkan dan tidak dapat diedit
            melalui formulir ini.
          </div>
        )}

        <section className="rx-card">
          <h2>Daftar Obat</h2>
          <p className="rx-help">
            Lengkapi informasi obat sesuai hasil pemeriksaan.
          </p>

          {medicines.map((item, index) => (
            <div className="rx-medicine" key={index}>
              <div className="rx-medicine-head">
                <strong>Obat {index + 1}</strong>

                <button
                  type="button"
                  className="rx-remove"
                  disabled={!canEdit || medicines.length === 1}
                  onClick={() => {
                    setMedicines((current) =>
                      current.filter((_, i) => i !== index)
                    );
                    setHasDraft(false);
                  }}
                >
                  <Trash2 size={15} />
                  Hapus
                </button>
              </div>

              <div className="rx-grid">
                {([
                  ["medicine_name", "Nama Obat"],
                  ["dosage", "Dosis"],
                  ["quantity", "Jumlah Obat"],
                  ["instructions", "Aturan Pakai"],
                  ["notes", "Catatan Obat (Opsional)"],
                ] as [keyof Medicine, string][]).map(
                  ([field, label]) => (
                    <label className="rx-field" key={field}>
                      {label}
                      <input
                        value={item[field]}
                        onChange={(e) =>
                          editMedicine(
                            index,
                            field,
                            e.target.value
                          )
                        }
                        disabled={!canEdit}
                        placeholder={`Masukkan ${label.toLowerCase()}`}
                        maxLength={1000}
                      />
                    </label>
                  )
                )}
              </div>
            </div>
          ))}

          <button
            className="rx-outline"
            disabled={!canEdit || medicines.length >= 20}
            onClick={() => {
              setMedicines((current) => [
                ...current,
                newMedicine(),
              ]);
              setHasDraft(false);
            }}
          >
            <Plus size={16} />
            Tambah Obat
          </button>
        </section>

        <section className="rx-card">
          <h2>Catatan Resep</h2>

          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setHasDraft(false);
            }}
            disabled={!canEdit}
            rows={4}
            maxLength={5000}
            placeholder="Catatan tambahan untuk pasien..."
          />

          <div className="rx-actions">
            <button
              className="rx-outline"
              onClick={() => void saveDraft()}
              disabled={!canEdit}
            >
              <Save size={17} />
              {busy ? "Memproses..." : "Simpan Draft"}
            </button>

            <button
              className="rx-primary"
              onClick={() => void publish()}
              disabled={!canEdit || !hasDraft}
            >
              <FileCheck2 size={17} />
              {issued
                ? "Sudah Diterbitkan"
                : "Terbitkan Resep"}
            </button>
          </div>

          <p className="rx-help">
            Periksa kembali seluruh informasi sebelum
            menerbitkan resep. Gunakan data simulasi hanya
            pada lingkungan pengujian yang diizinkan.
          </p>
        </section>
      </div>
    </main>
  );
}
