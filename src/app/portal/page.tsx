
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  HeartPulse,
  LayoutDashboard,
  Users,
  ClipboardList,
  MessageCircle,
  CreditCard,
  ScrollText,
  LogOut,
  RefreshCw,
  Stethoscope,
} from "lucide-react";
import "./portal.css";

type Role = "doctor" | "admin";
type Resource =
  | "users"
  | "transactions"
  | "audit"
  | "incoming"
  | "active"
  | "consultations";

type Row = Record<string, unknown>;

type User = {
  id?: string;
  full_name?: string;
  name?: string;
  email: string;
  role: Role;
};

type Column = {
  title: string;
  render: (row: Row) => ReactNode;
};

const ROLE_RESOURCES: Record<Role, Resource[]> = {
  admin: ["users", "transactions", "audit"],
  doctor: ["incoming", "active", "consultations"],
};

const TITLES: Record<Resource, string> = {
  users: "Data Pengguna",
  transactions: "Transaksi",
  audit: "Audit Log",
  incoming: "Antrean Konsultasi",
  active: "Sesi Konsultasi Aktif",
  consultations: "Riwayat Konsultasi",
};

function isRow(value: unknown): value is Row {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Ya" : "Tidak";
  }

  if (typeof value === "object") {
    return "-";
  }

  return String(value);
}

function extractRows(value: unknown, depth = 0): Row[] {
  if (Array.isArray(value)) {
    return value.filter(isRow);
  }

  if (!isRow(value) || depth > 4) {
    return [];
  }

  const keys = [
    "data",
    "items",
    "results",
    "rows",
    "users",
    "transactions",
    "audit_logs",
    "logs",
    "consultations",
    "queue",
    "queues",
    "incoming",
    "active",
    "messages",
  ];

  for (const key of keys) {
    const nested = value[key];

    if (Array.isArray(nested)) {
      return nested.filter(isRow);
    }

    if (isRow(nested)) {
      const found = extractRows(nested, depth + 1);
      if (found.length > 0) return found;
    }
  }

  return [];
}


function patientName(row: Row): string {
  const patient = isRow(row.patient) ? row.patient : {};

  const name =
    row.patient_name ??
    patient.full_name ??
    patient.name;

  if (typeof name === "string" && name.trim()) {
    return name;
  }

  const patientId = row.patient_id ?? patient.id;

  if (typeof patientId === "string" && patientId.trim()) {
    return `Pasien (ID: ${patientId.slice(0, 8)}...)`;
  }

  return "Nama pasien belum tersedia";
}


function dateTime(value: unknown) {
  if (typeof value !== "string") return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return display(value);

  return date.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function rupiah(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(number);
}

function consultationStatus(value: unknown): string {
  const statuses: Record<string, string> = {
    draft: "Draf",
    waiting_doctor: "Menunggu Dokter",
    active: "Sedang Berlangsung",
    closed: "Selesai",
    cancelled: "Dibatalkan",
  };

  const key = String(value ?? "");
  return statuses[key] ?? display(value);
}

const COLUMNS: Record<Resource, Column[]> = {
  users: [
    {
      title: "Nama",
      render: (r) => display(r.full_name ?? r.name),
    },
    {
      title: "Email",
      render: (r) => display(r.email),
    },
    {
      title: "Role",
      render: (r) => display(r.role),
    },
    {
      title: "Status",
      render: (r) =>
        r.is_active === true
          ? "Aktif"
          : r.is_active === false
            ? "Nonaktif"
            : display(r.status),
    },
  ],
  transactions: [
    {
      title: "ID Transaksi",
      render: (r) => display(r.id),
    },
    {
      title: "Nominal",
      render: (r) =>
        rupiah(r.amount ?? r.total_amount),
    },
    {
     title: "Status",
     render: (r) => consultationStatus(r.status),
    },
    {
      title: "Tanggal",
      render: (r) => dateTime(r.created_at),
    },
  ],
  audit: [
    {
      title: "Aktivitas",
      render: (r) => display(r.action),
    },
    {
      title: "Pelaku",
      render: (r) =>
        display(r.actor_role ?? r.actor_id),
    },
    {
      title: "Waktu",
      render: (r) => dateTime(r.created_at),
    },
  ],
  incoming: [
    {
      title: "Pasien",
      render: patientName,
    },
    {
      title: "Konsultasi",
      render: (r) =>
        display(r.consultation_id ?? r.id),
    },
    {
      title: "Status",
      render: (r) => display(r.status),
    },
    {
      title: "Dibuat",
      render: (r) => dateTime(r.created_at),
    },
  ],
  active: [
    {
      title: "Pasien",
      render: patientName,
    },
    {
      title: "Konsultasi",
      render: (r) =>
        display(r.consultation_id ?? r.id),
    },
    {
      title: "Durasi",
      render: (r) =>
        r.duration_minutes == null
          ? "-"
          : `${display(r.duration_minutes)} menit`,
    },
    {
      title: "Status",
      render: (r) => display(r.status),
    },
  ],
  consultations: [
    {
      title: "Pasien",
      render: patientName,
    },
    {
      title: "ID",
      render: (r) => display(r.id),
    },
    {
      title: "Status",
      render: (r) => display(r.status),
    },
    {
      title: "Tanggal",
      render: (r) => dateTime(r.created_at),
    },
  ],
};

async function api(
  action: string,
  extra: Row = {}
): Promise<Row> {
  const response = await fetch("/api/teleheart", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      ...extra,
    }),
    cache: "no-store",
  });

  const json: unknown = await response.json().catch(() => ({}));
  const result = isRow(json) ? json : {};

  if (!response.ok) {
    const error = isRow(result.error) ? result.error : {};

    throw new Error(
      `HTTP ${response.status}: ${display(
        error.message ?? result.message ?? "Permintaan gagal"
      )}`
    );
  }

  return result;
}


type ConsultationDetailProps = {
  record: Row;
  onClose: () => void;
  onUpdated: () => Promise<void>;
};

function ConsultationDetail({
  record,
  onClose,
  onUpdated,
}: ConsultationDetailProps) {
  const id = String(record.id ?? record.consultation_id ?? "");

  const [detail, setDetail] = useState<Row>(record);
  const [messages, setMessages] = useState<Row[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [chatError, setChatError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true);
    setDetailError("");
    setChatError("");

    try {
      const result = await api("consultation", {
        operation: "detail",
        consultationId: id,
      });

      const data = isRow(result.data) ? result.data : result;
      const consultation = isRow(data.consultation)
        ? data.consultation
        : data;

      setDetail(consultation);
    } catch (error) {
      setDetailError(
        error instanceof Error
          ? error.message
          : "Gagal membaca detail konsultasi"
      );
    }

    try {
      const result = await api("consultation", {
        operation: "messages",
        consultationId: id,
      });

      setMessages(extractRows(result));
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : "Gagal membaca percakapan"
      );
    } finally {
      setBusy(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const status = String(detail.status ?? record.status ?? "");

  async function perform(
    operation: "accept" | "reject",
    reason?: string
  ) {
    if (
      operation === "accept" &&
      !window.confirm(
        "Terima konsultasi ini? Status sesi pada backend akan berubah."
      )
    ) {
      return;
    }

    setBusy(true);
    setDetailError("");
    setNotice("");

    try {
      await api("consultation", {
        operation,
        consultationId: id,
        ...(reason ? { reason } : {}),
      });

      setNotice(
        operation === "accept"
          ? "Konsultasi berhasil diterima."
          : "Konsultasi berhasil ditolak."
      );

      await refresh();
      await onUpdated();
    } catch (error) {
      setDetailError(
        error instanceof Error
          ? error.message
          : "Aksi gagal"
      );
    } finally {
      setBusy(false);
    }
  }

  function reject() {
    const reason = window.prompt(
      "Tuliskan alasan penolakan konsultasi:"
    );

    if (reason === null) return;

    if (!reason.trim()) {
      setDetailError("Alasan penolakan tidak boleh kosong.");
      return;
    }

    void perform("reject", reason.trim());
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();

    const message = draft.trim();
    if (!message || busy) return;

    setBusy(true);
    setChatError("");

    try {
      await api("consultation", {
        operation: "send",
        consultationId: id,
        message,
      });

      setDraft("");
      await refresh();
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : "Pesan gagal dikirim"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="th-panel th-session-panel">
      <div className="th-panel-header">
        <div>
          <h3>Ruang Konsultasi</h3>
          <p>
            Detail dan percakapan untuk satu sesi TeleHeart.
          </p>
        </div>

        <div className="th-session-actions">
          <button
            type="button"
            className="th-outline"
            onClick={() => void refresh()}
            disabled={busy}
          >
            <RefreshCw size={16} />
            Perbarui
          </button>

          <button
            type="button"
            className="th-outline"
            onClick={onClose}
          >
            Tutup Panel
          </button>
        </div>
      </div>

      {notice && (
        <div className="th-session-success">{notice}</div>
      )}

      {detailError && (
        <div className="th-error">{detailError}</div>
      )}

      <div className="th-session-info">
        <div>
          <span>Pasien</span>
          <strong>{patientName(detail)}</strong>
        </div>

        <div>
          <span>Status</span>
          <strong>{consultationStatus(status)}</strong>
        </div>

        <div>
          <span>Durasi</span>
          <strong>
            {detail.duration_minutes == null
              ? "-"
              : `${display(detail.duration_minutes)} menit`}
          </strong>
        </div>

        <div>
          <span>ID Konsultasi</span>
          <small>{id}</small>
        </div>
      </div>

      {status === "waiting_doctor" && (
        <div className="th-session-actions">
          <button
            className="th-primary"
            type="button"
            disabled={busy}
            onClick={() => void perform("accept")}
          >
            Terima Konsultasi
          </button>

          <button
            className="th-danger"
            type="button"
            disabled={busy}
            onClick={reject}
          >
            Tolak Konsultasi
          </button>
        </div>
      )}

      <div className="th-chat-section">
        <h3>Percakapan Dokter dan Pasien</h3>

        {chatError && (
          <div className="th-error">{chatError}</div>
        )}

        <div className="th-chat-messages">
          {messages.length === 0 ? (
            <p>Belum ada pesan yang dapat ditampilkan.</p>
          ) : (
            messages.map((item, index) => (
              <article
                className="th-chat-message"
                key={String(item.id ?? index)}
              >
                <small>
                  {dateTime(item.created_at)}
                </small>
                <p>
                  {display(
                    item.message ??
                    item.body ??
                    item.content
                  )}
                </p>
              </article>
            ))
          )}
        </div>

        {status === "active" ? (
          <form
            className="th-chat-compose"
            onSubmit={sendMessage}
          >
            <input
              value={draft}
              onChange={(event) =>
                setDraft(event.target.value)
              }
              maxLength={5000}
              placeholder="Tulis pesan untuk pasien..."
            />

            <button
              className="th-primary"
              disabled={busy || !draft.trim()}
              type="submit"
            >
              Kirim
            </button>
          </form>
        ) : (
          <p className="th-chat-hint">
            Pengiriman pesan tersedia ketika status
            konsultasi aktif.
          </p>
        )}

        <p className="th-chat-hint">
          Pesan terbaru dimuat melalui tombol Perbarui.
          Pembaruan otomatis realtime belum diaktifkan.
        </p>
      </div>
    </section>
  );
}


export default function TeleHeartPortal() {
  const [user, setUser] = useState<User | null>(null);
  const [starting, setStarting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [tab, setTab] = useState<string>("dashboard");
  const [records, setRecords] = useState<
    Partial<Record<Resource, Row[]>>
  >({});
  const [errors, setErrors] = useState<
    Partial<Record<Resource, string>>
  >({});
  const [search, setSearch] = useState("");
  const [selectedConsultation, setSelectedConsultation] =
  useState<Row | null>(null);

  const role = user?.role;
  const isAdmin = role === "admin";

  const menu = isAdmin
    ? [
        {
          id: "dashboard",
          name: "Dashboard",
          icon: LayoutDashboard,
        },
        {
          id: "users",
          name: "Pengguna",
          icon: Users,
        },
        {
          id: "transactions",
          name: "Transaksi",
          icon: CreditCard,
        },
        {
          id: "audit",
          name: "Audit Log",
          icon: ScrollText,
        },
      ]
    : [
        {
          id: "dashboard",
          name: "Dashboard",
          icon: LayoutDashboard,
        },
        {
          id: "incoming",
          name: "Antrean",
          icon: ClipboardList,
        },
        {
          id: "active",
          name: "Sesi Aktif",
          icon: MessageCircle,
        },
        {
          id: "consultations",
          name: "Konsultasi",
          icon: Stethoscope,
        },
      ];

  useEffect(() => {
    api("me")
      .then((result) => {
        const data = result.data;
        if (isRow(data) && (
          data.role === "doctor" ||
          data.role === "admin"
        )) {
          setUser(data as User);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setStarting(false));
  }, []);

  const loadAll = useCallback(async (currentRole: Role) => {
    setLoading(true);
    setErrors({});

    const nextRecords: Partial<Record<Resource, Row[]>> = {};
    const nextErrors: Partial<Record<Resource, string>> = {};

    await Promise.all(
      ROLE_RESOURCES[currentRole].map(async (name) => {
        try {
          const result = await api("resource", { name });
          nextRecords[name] = extractRows(result);
        } catch (error) {
          nextErrors[name] =
            error instanceof Error
              ? error.message
              : "Gagal mengambil data";
        }
      })
    );

    setRecords(nextRecords);
    setErrors(nextErrors);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (role) void loadAll(role);
  }, [role, loadAll]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setLoginError("");

    try {
      await api("login", {
        email: email.trim(),
        password,
      });

      const profile = await api("me");
      const data = profile.data;

      if (!isRow(data)) {
        throw new Error("Profil pengguna tidak valid");
      }

      if (data.role !== "doctor" && data.role !== "admin") {
        throw new Error("Akun tidak memiliki akses portal");
      }

      setUser(data as User);
      setTab("dashboard");
      setPassword("");
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "Login gagal"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await api("logout").catch(() => null);
    setUser(null);
    setRecords({});
    setErrors({});
    setPassword("");
    setTab("dashboard");
    setSelectedConsultation(null);
  }

  const currentResource =
    tab === "dashboard" ? null : tab as Resource;

  const currentRows = currentResource
    ? records[currentResource] ?? []
    : [];

  const filteredRows = currentRows.filter((row) => {
    const fields =
      currentResource
        ? COLUMNS[currentResource].map((col) =>
            String(col.render(row))
          )
        : [];

    return fields
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase());
  });

  if (starting) {
    return (
      <div className="th-loading">
        Memeriksa sesi TeleHeart...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="th-login">
        <section className="th-login-left">
          <div className="th-logo">
            <HeartPulse size={30} /> TeleHeart
          </div>

          <HeartPulse className="th-login-heart" size={150} />

          <h1>
            Kesehatan jantung lebih dekat dari rumah.
          </h1>
          <p>
            Portal konsultasi dokter spesialis jantung
            dan administrasi layanan TeleHeart.
          </p>
        </section>

        <form className="th-login-form" onSubmit={handleLogin}>
          <div className="th-login-symbol">
            <HeartPulse size={27} />
          </div>

          <h2>Selamat Datang!</h2>
          <p>Masuk menggunakan akun Dokter atau Admin.</p>

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Masukkan email"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Masukkan password"
          />

          {loginError && (
            <div className="th-error">{loginError}</div>
          )}

          
        {/* Tombol Login */}
        <button
          type="submit"
          className="th-primary"
          disabled={busy}
        >
                {busy ? "Memproses..." : "Masuk ke TeleHeart"}
              </button>

              {/* Pendaftaran Dokter Baru */}
              <div className="th-register-section">
                <p>Belum mempunyai akun Dokter?</p>

                <a
                  href="/portal/register-doctor"
                  className="th-register-button"
                >
                  Daftar sebagai Dokter
                </a>
              </div>

              {/* Informasi Pasien */}
              <small className="th-login-footer">
                Akun pasien digunakan pada aplikasi Mobile.
              </small>
              </form>
              </div>
              );
              }


  return (
    <div className="th-app">
      <aside className="th-sidebar">
        <div className="th-logo">
          <HeartPulse size={28} /> TeleHeart
        </div>

        <p className="th-role">
          {isAdmin ? "ADMIN PORTAL" : "DOCTOR PORTAL"}
        </p>

        <nav className="th-menu">
          {menu.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => {
                setTab(id);
                setSearch("");
                setSelectedConsultation(null);
             }}
            >
              <Icon size={19} />
              {name}
            </button>
          ))}
        </nav>

        <a
          href="/portal/management"
          className="th-mgmt-nav"
        >
          {isAdmin ? "Verifikasi Dokter" : "Pengaturan Dokter"}
        </a>

        <div className="th-profile">
          <strong>
            {user.full_name ?? user.name ?? "Pengguna"}
          </strong>
          <small>{user.email}</small>
          <button onClick={handleLogout}>
            <LogOut size={17} />
            Keluar
          </button>
        </div>
      </aside>

      <main className="th-main">
        <header className="th-topbar">
          <div>
            <h1>
              {tab === "dashboard"
                ? "Dashboard"
                : TITLES[tab as Resource]}
            </h1>
            <p>
              {isAdmin
                ? "Operasional dan administrasi TeleHeart"
                : "Layanan konsultasi dokter TeleHeart"}
            </p>
          </div>

          <button
            className="th-outline"
            disabled={loading}
            onClick={() => loadAll(user.role)}
          >
            <RefreshCw size={17} />
            {loading ? "Memuat..." : "Perbarui"}
          </button>
        </header>

        {tab === "dashboard" ? (
          <>
            <section className="th-hero">
              <div>
                <span>TELEHEART PORTAL</span>
                <h2>
                  Halo, {user.full_name ?? user.name ?? "Pengguna"}!
                </h2>
                <p>
                  {isAdmin
                    ? "Pantau operasional dan pengelolaan sistem."
                    : "Pantau antrean dan sesi konsultasi pasien."}
                </p>
              </div>
              <HeartPulse size={110} />
            </section>

            <div className="th-stats">
              {ROLE_RESOURCES[user.role].map((name) => (
                <div className="th-card" key={name}>
                  <HeartPulse size={24} />
                  <strong>
                    {loading
                      ? "..."
                      : errors[name]
                        ? "—"
                        : records[name]?.length ?? 0}
                  </strong>
                  <span>{TITLES[name]}</span>
                  <small className="th-count-label">
                    {errors[name]
                      ? "Gagal memuat"
                      : "Jumlah data yang dimuat"}
                  </small>
                </div>
              ))}
            </div>

            <section className="th-panel">
              <h3>Status Koneksi API</h3>
              <p>
                Statistik di atas dihitung dari data yang
                diterima website, bukan angka simulasi.
                Jika API menggunakan pagination, jumlah
                ini bukan total keseluruhan database.
              </p>

              {ROLE_RESOURCES[user.role].map((name) => (
                <div className="th-api-status" key={name}>
                  <strong>{TITLES[name]}</strong>
                  <span>
                    {loading
                      ? "Memuat..."
                      : errors[name]
                        ? errors[name]
                        : `${records[name]?.length ?? 0} data diterima`}
                  </span>
                </div>
              ))}
            </section>
          </>
        ) : currentResource ? (
          <section className="th-panel">
            <div className="th-panel-header">
              <div>
                <h3>{TITLES[currentResource]}</h3>
                <p>
                  Data dibaca langsung dari backend TeleHeart.
                </p>
              </div>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari dalam data..."
                aria-label="Cari data"
              />
            </div>

            {loading ? (
              <p>Memuat data dari backend...</p>
            ) : errors[currentResource] ? (
              <div className="th-error">
                <strong>Gagal memuat data</strong>
                <p>{errors[currentResource]}</p>
              </div>
            ) : filteredRows.length === 0 ? (
              <p>
                {search
                  ? "Tidak ditemukan hasil yang cocok."
                  : "Belum ada data pada resource ini."}
              </p>
            ) : (
              <div className="th-table-wrap">
                <table className="th-live-table">
                  <thead>
                    <tr>
                      {COLUMNS[currentResource].map((col) => (
                        <th key={col.title}>{col.title}</th>
                      ))}

                      {!isAdmin && <th>Aksi</th>}
                    </tr>
                  </thead>

                  
                <tbody>
                {filteredRows.map((row, index) => (
                    <tr key={String(row.id ?? index)}>
                    {COLUMNS[currentResource].map((col) => (
                        <td key={col.title}>
                        {col.render(row)}
                        </td>
                    ))}

                    {!isAdmin && (
                        <td>
                        <button
                            type="button"
                            className="th-outline"
                            onClick={() => setSelectedConsultation(row)}
                        >
                            Buka Detail
                        </button>
                        </td>
                    )}
                    </tr>
                ))}
                </tbody>

                </table>
              </div>
            )}
          </section>
        ) : null}
      </main>
      
        {!isAdmin && selectedConsultation && (
        <ConsultationDetail
            record={selectedConsultation}
            onClose={() => setSelectedConsultation(null)}
            onUpdated={() => loadAll(user.role)}
        />
        )}

    </div>
  );
}
