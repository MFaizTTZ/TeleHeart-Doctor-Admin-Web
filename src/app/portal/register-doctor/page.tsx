
"use client";

import { useState, type FormEvent } from "react";
import {
  HeartPulse,
  ArrowLeft,
  UserRound,
  FileCheck2,
  ShieldCheck,
  CheckCircle2,
  Upload,
} from "lucide-react";
import "./register.css";

type DocumentState = {
  str: string;
  sip: string;
};

export default function RegisterDoctorPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [documents, setDocuments] = useState<DocumentState>({
    str: "",
    sip: "",
  });

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) return;

    const form = event.currentTarget;
    const data = new FormData(form);

    const password = String(data.get("password") ?? "");
    const confirmation = String(
      data.get("confirm_password") ?? ""
    );

    setError("");

    if (password !== confirmation) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/teleheart/register-doctor",
        {
          method: "POST",
          body: data,
          credentials: "same-origin",
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof result.error === "string"
            ? result.error
            : result.error?.message ??
              result.message ??
              "Pendaftaran gagal";

        throw new Error(
          `HTTP ${response.status}: ${message}`
        );
      }

      setSuccess(true);
      form.reset();
      setDocuments({ str: "", sip: "" });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat pendaftaran"
      );
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="rd-page rd-success-page">
        <section className="rd-success-card">
          <CheckCircle2 size={65} color="#318d7d" />

          <h1>Pendaftaran Diterima!</h1>

          <p>
            Backend telah menerima permintaan pendaftaran
            dokter Anda.
          </p>

          <div className="rd-info">
            Silakan periksa email untuk proses verifikasi,
            lalu tunggu peninjauan dokumen STR dan SIP
            oleh Administrator TeleHeart.
          </div>

          <p>
            Akun yang masih menunggu persetujuan belum
            dapat menerima konsultasi pasien.
          </p>

          <a className="rd-primary-link" href="/portal">
            Kembali ke Login
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="rd-page">
      <div className="rd-container">
        <header className="rd-header">
          <a href="/portal" className="rd-back">
            <ArrowLeft size={18} />
            Kembali ke Login
          </a>

          <div className="rd-brand">
            <HeartPulse size={30} />
            <strong>TeleHeart</strong>
          </div>
        </header>

        <div className="rd-intro">
          <span>TELEHEART MEDICAL PARTNER</span>
          <h1>Pendaftaran Dokter Baru</h1>
          <p>
            Bergabung sebagai mitra dokter TeleHeart.
            Lengkapi identitas profesional Anda untuk
            proses pemeriksaan dan verifikasi.
          </p>
        </div>

        <div className="rd-steps">
          <div>
            <UserRound size={22} />
            <span>Identitas Dokter</span>
          </div>
          <div>
            <FileCheck2 size={22} />
            <span>Dokumen STR/SIP</span>
          </div>
          <div>
            <ShieldCheck size={22} />
            <span>Verifikasi Admin</span>
          </div>
        </div>

        <form
          className="rd-form"
          onSubmit={handleSubmit}
          encType="multipart/form-data"
        >
          <section className="rd-card">
            <div className="rd-section-title">
              <UserRound size={23} />
              <div>
                <h2>Informasi Akun</h2>
                <p>
                  Gunakan email aktif yang dapat menerima
                  verifikasi.
                </p>
              </div>
            </div>

            <div className="rd-grid">
              <label className="rd-field rd-full">
                Nama Lengkap Dokter
                <input
                  name="full_name"
                  type="text"
                  placeholder="Contoh: dr. Andi Pratama, Sp.JP"
                  autoComplete="name"
                  maxLength={150}
                  required
                />
              </label>

              <label className="rd-field rd-full">
                Email
                <input
                  name="email"
                  type="email"
                  placeholder="dokter@email.com"
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </label>

              
                <label className="rd-field">
                Password
                <input
                    name="password"
                    type="password"
                    placeholder="Minimal 8 karakter, huruf besar, kecil, dan angka"
                    minLength={8}
                    pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}"
                    title="Password harus minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka"
                    autoComplete="new-password"
                    required
                />
                </label>


              <label className="rd-field">
                Konfirmasi Password
                <input
                  name="confirm_password"
                  type="password"
                  placeholder="Ulangi password"
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </label>

            <label className="rd-field rd-full">
            Tempat Praktik / Rumah Sakit
            <input
                name="workplace"
                type="text"
                placeholder="Contoh: RS Jantung Harapan"
                maxLength={150}
            />
            </label>

            </div>
          </section>

          <section className="rd-card">
            <div className="rd-section-title">
              <FileCheck2 size={23} />
              <div>
                <h2>Informasi Profesional</h2>
                <p>
                  Data ini akan diperiksa oleh Administrator.
                </p>
              </div>
            </div>

            <div className="rd-grid">
              <label className="rd-field rd-full">
                Spesialisasi
                <select
                  name="specialization"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Pilih spesialisasi
                  </option>
                  <option value="Spesialis Jantung dan Pembuluh Darah">
                    Spesialis Jantung dan Pembuluh Darah
                  </option>
                </select>
              </label>

              <label className="rd-field">
                Nomor STR
                <input
                  name="str_number"
                  placeholder="Nomor Surat Tanda Registrasi"
                  maxLength={100}
                  required
                />
              </label>

              <label className="rd-field">
                Nomor SIP
                <input
                  name="sip_number"
                  placeholder="Nomor Surat Izin Praktik"
                  maxLength={100}
                  required
                />
              </label>
            </div>
          </section>

          <section className="rd-card">
            <div className="rd-section-title">
              <Upload size={23} />
              <div>
                <h2>Unggah Dokumen</h2>
                <p>
                  Format PDF, JPG, atau PNG. Maksimal
                  10 MB per dokumen.
                </p>
              </div>
            </div>

            <div className="rd-upload-grid">
              <label className="rd-upload">
                <Upload size={27} />
                <strong>Dokumen STR</strong>
                <span>
                  {documents.str || "Pilih file STR"}
                </span>

                <input
                  type="file"
                  name="str_document"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  required
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setDocuments((current) => ({
                      ...current,
                      str: file?.name ?? "",
                    }));
                  }}
                />
              </label>

              <label className="rd-upload">
                <Upload size={27} />
                <strong>Dokumen SIP</strong>
                <span>
                  {documents.sip || "Pilih file SIP"}
                </span>

                <input
                  type="file"
                  name="sip_document"
                  accept=".pdf,.jpg,.jpeg,.png"
                  required
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setDocuments((current) => ({
                      ...current,
                      sip: file?.name ?? "",
                    }));
                  }}
                />
              </label>
            </div>
          </section>

          <section className="rd-card rd-submit-card">
            <label className="rd-consent">
              <input
                name="consent"
                type="checkbox"
                value="yes"
                required
              />
              <span>
                Saya menyetujui pengiriman dan pemrosesan
                identitas serta dokumen STR/SIP untuk
                keperluan verifikasi profesional oleh
                Administrator TeleHeart.
              </span>
            </label>

            {error && (
              <div className="rd-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="rd-submit"
              disabled={loading}
            >
              <ShieldCheck size={20} />
              {loading
                ? "Mengirim Pendaftaran..."
                : "Kirim Pendaftaran Dokter"}
            </button>

            <p className="rd-note">
              Setelah mendaftar, akun perlu menjalani
              verifikasi email dan pemeriksaan Admin
              sebelum dapat menerima konsultasi.
            </p>
          </section>
        </form>
      </div>
    </main>
  );
}
