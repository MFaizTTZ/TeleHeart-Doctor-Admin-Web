
"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  ArrowLeft,
  HeartPulse,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import "../portal.css";
import "./management.css";

type Row = Record<string, unknown>;
type Role = "doctor" | "admin";

type User = {
  role: Role;
  full_name?: string;
  email?: string;
};

function obj(value: unknown): Row {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as Row
    : {};
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return typeof value === "object" ? "-" : String(value);
}

function extractList(value: unknown, depth = 0): Row[] {
  if (Array.isArray(value)) {
    return value.map(obj);
  }

  if (depth > 4) return [];

  const record = obj(value);

  for (const key of [
    "data",
    "items",
    "doctors",
    "tariffs",
    "doctor_tariffs",
    "results",
    "rows",
    "users",
  ]) {
    if (record[key] !== undefined) {
      const result = extractList(record[key], depth + 1);
      if (result.length) return result;

      if (Array.isArray(record[key])) return [];
    }
  }

  return [];
}

function extractProfile(value: unknown): Row {
  const data = obj(obj(value).data);
  const base = Object.keys(data).length ? data : obj(value);

  const profile = obj(
    base.profile ??
    base.doctor_profile ??
    base.doctor
  );

  return Object.keys(profile).length ? profile : base;
}

function verificationStatus(record: Row): string {
  const profile = obj(
    record.doctor_profile ?? record.profile
  );

  const raw =
    record.verification_status ??
    record.doctor_verification_status ??
    profile.verification_status;

  if (raw == null || raw === "") {
    return "Status verifikasi belum tersedia";
  }

  const labels: Record<string, string> = {
    pending: "Menunggu Verifikasi",
    approved: "Disetujui",
    rejected: "Ditolak",
  };

  return labels[String(raw)] ?? String(raw);
}

function money(value: unknown): string {
  const number = Number(value);

  if (!Number.isFinite(number) || value == null) {
    return "-";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(number);
}

async function api(
  action: string,
  extra: Row = {}
): Promise<Row> {
  const response = await fetch("/api/teleheart", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
    cache: "no-store",
  });

  const result = obj(
    await response.json().catch(() => ({}))
  );

  if (!response.ok) {
    const error = obj(result.error);
    throw new Error(
      `HTTP ${response.status}: ${
        display(error.message ?? result.message)
      }`
    );
  }

  return result;
}

export default function ManagementPage() {
  const [user, setUser] = useState<User | null>(null);
  const [starting, setStarting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [profile, setProfile] = useState<Row>({});
  const [tariffs, setTariffs] = useState<Row[]>([]);
  const [doctors, setDoctors] = useState<Row[]>([]);
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});

  const load = useCallback(async (role: Role) => {
    setLoading(true);
    setError("");

    try {
      if (role === "doctor") {
        const results = await Promise.allSettled([
          api("resource", { name: "profile" }),
          api("resource", { name: "tariffs" }),
        ]);

        const [profileResult, tariffResult] = results;

        const failures: string[] = [];

        if (profileResult.status === "fulfilled") {
          setProfile(extractProfile(profileResult.value));
        } else {
          failures.push(
            "Profil: " + String(profileResult.reason)
          );
        }

        if (tariffResult.status === "fulfilled") {
          setTariffs(extractList(tariffResult.value));
        } else {
          failures.push(
            "Tarif: " + String(tariffResult.reason)
          );
        }

        if (failures.length) {
          setError(failures.join(" | "));
        }
      } else {
        const result = await api("resource", {
        name: "doctors",
        });

        const allUsers = extractList(result);

        const doctorUsers = allUsers.filter((item) => {
        const account = obj(item.user);

        const role = String(
            item.role ?? account.role ?? ""
        ).toLowerCase();

        return role === "doctor" || role === "dokter";
        });

        setDoctors(doctorUsers);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api("me")
      .then((result) => {
        const currentUser = obj(result.data);

        if (
          currentUser.role === "doctor" ||
          currentUser.role === "admin"
        ) {
          setUser(currentUser as User);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setStarting(false));
  }, []);

  useEffect(() => {
    if (user) void load(user.role);
  }, [user, load]);

  async function setOnline(next: boolean) {
    if (!user || user.role !== "doctor") return;

    if (!window.confirm(
      `Ubah status menjadi ${next ? "Online" : "Offline"}?`
    )) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await api("manage", {
        operation: "setOnline",
        is_online: next,
      });

      setNotice("Status ketersediaan berhasil diperbarui.");
      await load("doctor");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mengubah status"
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyDoctor(
    doctorId: string,
    status: "approved" | "rejected"
  ) {
    if (!user || user.role !== "admin") return;

    if (!reviewed[doctorId]) {
      setError("Konfirmasi pemeriksaan STR/SIP terlebih dahulu.");
      return;
    }

    let reason = "";

    if (status === "rejected") {
      const input = window.prompt(
        "Tuliskan alasan penolakan dokter:"
      );

      if (input === null) return;
      reason = input.trim();

      if (!reason) {
        setError("Alasan penolakan wajib diisi.");
        return;
      }
    }

    if (!window.confirm(
      `Yakin ingin ${
        status === "approved" ? "menyetujui" : "menolak"
      } dokter ini?`
    )) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await api("manage", {
        operation: "verifyDoctor",
        doctorId,
        status,
        ...(reason ? { reason } : {}),
      });

      setNotice("Status verifikasi dokter berhasil diperbarui.");
      setReviewed({});
      await load("admin");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Verifikasi gagal"
      );
    } finally {
      setBusy(false);
    }
  }

  if (starting) {
    return (
      <div className="th-loading">
        Memeriksa akun TeleHeart...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="th-management-empty">
        <h2>Sesi tidak tersedia</h2>
        <p>Silakan login melalui portal TeleHeart.</p>
        <a href="/portal">Kembali ke Login</a>
      </div>
    );
  }

  const isAdmin = user.role === "admin";
  const onlineValue = profile.is_online;
  const hasOnlineStatus = typeof onlineValue === "boolean";

  return (
    <div className="th-app">
      <main className="th-main th-management">
        <header className="th-management-top">
          <a href="/portal" className="th-outline">
            <ArrowLeft size={17} />
            Kembali ke Dashboard
          </a>

          <div className="th-logo">
            <HeartPulse size={27} />
            TeleHeart
          </div>
        </header>

        <section className="th-hero">
          <div>
            <span>TELEHEART MANAGEMENT</span>
            <h2>
              {isAdmin
                ? "Verifikasi Dokter"
                : "Profil dan Pengaturan Dokter"}
            </h2>
            <p>
              {isAdmin
                ? "Kelola status verifikasi tenaga medis."
                : "Pantau profil, tarif dan ketersediaan konsultasi."}
            </p>
          </div>
          {isAdmin
            ? <ShieldCheck size={100} />
            : <Stethoscope size={100} />}
        </section>

        <div className="th-management-toolbar">
          <div>
            <strong>
              {isAdmin ? "Daftar Dokter" : "Akun Dokter"}
            </strong>
            <p>{user.email}</p>
          </div>

          <button
            className="th-outline"
            disabled={loading || busy}
            onClick={() => void load(user.role)}
          >
            <RefreshCw size={17} />
            {loading ? "Memuat..." : "Perbarui"}
          </button>
        </div>

        {error && <div className="th-error">{error}</div>}
        {notice && (
          <div className="th-management-notice">{notice}</div>
        )}

        {isAdmin ? (
          <section className="th-panel">
            <h3>Pengajuan dan Status Verifikasi Dokter</h3>
            <p>
              Persetujuan hanya boleh dilakukan setelah
              dokumen STR/SIP diperiksa melalui akses
              dokumen resmi sistem.
            </p>

            {loading && <p>Memuat daftar dokter...</p>}

            {!loading && doctors.length === 0 && (
              <p>Belum ada data dokter yang dapat ditampilkan.</p>
            )}

            <div className="th-doctor-list">
              {doctors.map((doctor, index) => {
                const account = obj(doctor.user);
                const professional = obj(
                  doctor.doctor_profile ??
                  doctor.profile
                );

                const id = display(
                  doctor.id ?? doctor.user_id ?? account.id
                );

                const name = display(
                  doctor.full_name ??
                  doctor.name ??
                  account.full_name ??
                  account.name
                );

                const email = display(
                  doctor.email ?? account.email
                );

                const status = verificationStatus(doctor);
                const pending = status === "Menunggu Verifikasi";

                return (
                  <article
                    className="th-doctor-entry"
                    key={`${id}-${index}`}
                  >
                    <div className="th-doctor-details">
                      <h4>{name}</h4>
                      <p>{email}</p>
                      <p>
                        Spesialisasi: {display(
                          doctor.specialization ??
                          professional.specialization
                        )}
                      </p>
                      <span className="th-management-status">
                        {status}
                      </span>
                    </div>

                    {pending && (
                      <div className="th-doctor-review">
                        <label>
                          <input
                            type="checkbox"
                            checked={reviewed[id] ?? false}
                            onChange={(event) =>
                              setReviewed((old) => ({
                                ...old,
                                [id]: event.target.checked,
                              }))
                            }
                          />
                          Saya sudah memeriksa STR dan SIP
                          melalui dokumen resmi.
                        </label>

                        <div className="th-management-actions">
                          <button
                            className="th-primary"
                            disabled={
                              busy || !reviewed[id] || id === "-"
                            }
                            onClick={() =>
                              void verifyDoctor(id, "approved")
                            }
                          >
                            Setujui
                          </button>

                          <button
                            className="th-danger"
                            disabled={
                              busy || !reviewed[id] || id === "-"
                            }
                            onClick={() =>
                              void verifyDoctor(id, "rejected")
                            }
                          >
                            Tolak
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          <>
            <div className="th-management-grid">
              <section className="th-panel">
                <h3>Profil Profesional</h3>

                <div className="th-info-line">
                  <span>Nama Dokter</span>
                  <strong>{display(
                    profile.full_name ??
                    profile.name ??
                    user.full_name
                  )}</strong>
                </div>

                <div className="th-info-line">
                  <span>Spesialisasi</span>
                  <strong>{display(profile.specialization)}</strong>
                </div>

                <div className="th-info-line">
                  <span>Nomor STR</span>
                  <strong>{display(profile.str_number)}</strong>
                </div>

                <div className="th-info-line">
                  <span>Nomor SIP</span>
                  <strong>{display(profile.sip_number)}</strong>
                </div>

                <div className="th-info-line">
                  <span>Status Verifikasi</span>
                  <strong>{verificationStatus(profile)}</strong>
                </div>
              </section>

              <section className="th-panel">
                <h3>Ketersediaan Konsultasi</h3>

                <div className="th-online-indicator">
                  <span className={
                    onlineValue === true
                      ? "th-online-dot active"
                      : "th-online-dot"
                  } />

                  <strong>
                    {!hasOnlineStatus
                      ? "Status online belum tersedia"
                      : onlineValue
                        ? "Sedang Online"
                        : "Sedang Offline"}
                  </strong>
                </div>

                <p>
                  Status online menentukan ketersediaan
                  dokter untuk menerima permintaan konsultasi.
                </p>

                <button
                  className="th-primary"
                  disabled={busy || loading || !hasOnlineStatus}
                  onClick={() =>
                    void setOnline(onlineValue !== true)
                  }
                >
                  {onlineValue === true
                    ? "Jadikan Offline"
                    : "Jadikan Online"}
                </button>
              </section>
            </div>

            <section className="th-panel">
              <h3>Tarif Konsultasi</h3>
              <p>
                Tarif dibaca dari backend. Pengubahan nominal
                akan ditambahkan setelah format payload
                penyimpanan tarif terkonfirmasi.
              </p>

              <div className="th-tariff-grid">
                {[15, 30, 60].map((duration) => {
                  const tariff = tariffs.find((item) =>
                    Number(
                      item.duration_minutes ??
                      item.duration
                    ) === duration
                  );

                  return (
                    <div
                      className="th-tariff-card"
                      key={duration}
                    >
                      <span>{duration} Menit</span>
                      <strong>
                        {tariff
                          ? money(
                              tariff.price ??
                              tariff.price_amount ??
                              tariff.amount
                            )
                          : "Belum tersedia"}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
