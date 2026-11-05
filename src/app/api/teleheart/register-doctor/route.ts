
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const API = process.env.TELEHEART_API_BASE_URL?.replace(/\/+$/, "");
const MAX_FILE = 10 * 1024 * 1024;

const MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function failure(message: string, status = 400) {
  return NextResponse.json(
    { error: { message } },
    { status }
  );
}

function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function validDocument(value: FormDataEntryValue | null): value is File {
  if (!(value instanceof File)) return false;

  return (
    value.size > 0 &&
    value.size <= MAX_FILE &&
    MIME_TYPES.has(value.type) &&
    /\.(pdf|jpe?g|png|webp)$/i.test(value.name)
  );
}

function apiMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;

  const root = body as Record<string, unknown>;
  const err =
    root.error && typeof root.error === "object"
      ? root.error as Record<string, unknown>
      : {};

  const main = err.message ?? root.message ?? fallback;
  const details =
    err.details ?? err.issues ?? root.details ?? root.errors;

  const extra: string[] = [];

  if (Array.isArray(details)) {
    for (const item of details) {
      if (typeof item === "string") {
        extra.push(item);
      } else if (item && typeof item === "object") {
        const issue = item as Record<string, unknown>;
        const field = Array.isArray(issue.path)
          ? issue.path.join(".")
          : String(issue.field ?? issue.path ?? "");

        extra.push(
          `${field}: ${String(issue.message ?? "Tidak valid")}`
        );
      }
    }
  } else if (details && typeof details === "object") {
    for (const [key, value] of Object.entries(details)) {
      extra.push(
        `${key}: ${
          typeof value === "string"
            ? value
            : Array.isArray(value)
              ? value.join(", ")
              : "Tidak valid"
        }`
      );
    }
  }

  return [String(main), ...extra]
    .filter(Boolean)
    .join(" | ")
    .slice(0, 1000);
}

async function uploadDocument(
  file: File,
  label: string
): Promise<string> {
  const upload = new FormData();
  upload.append("file", file, file.name);

  const response = await fetch(
    `${API}/auth/upload-document`,
    {
      method: "POST",
      headers: {
        "X-Client-Platform": "web",
        Accept: "application/json",
      },
      body: upload,
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    }
  );

  const result: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `Upload ${label} gagal (HTTP ${response.status}): ` +
      apiMessage(result, "Dokumen tidak diterima backend")
    );
  }

  const root =
    result && typeof result === "object"
      ? result as Record<string, unknown>
      : {};

  const data =
    root.data && typeof root.data === "object"
      ? root.data as Record<string, unknown>
      : {};

  const path = data.file_path;

  if (typeof path !== "string" || !path.trim()) {
    throw new Error(
      `Upload ${label} berhasil, tetapi file_path tidak ditemukan`
    );
  }

  // Gunakan path persis dari backend,
  // bukan download_url atau nama file lokal.
  return path;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin && origin !== request.nextUrl.origin) {
    return failure("Origin tidak diizinkan", 403);
  }

  if (!API) {
    return failure("URL API TeleHeart belum dikonfigurasi", 503);
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return failure("Formulir tidak valid");
  }

  const fullName = text(form, "full_name");
  const email = text(form, "email").toLowerCase();

  // Jangan trim password, karena spasi bisa menjadi
  // bagian dari password yang sengaja dipilih pengguna.
  const rawPassword = form.get("password");
  const password =
    typeof rawPassword === "string" ? rawPassword : "";

  const confirmation = form.get("confirm_password");
  const confirmPassword =
    typeof confirmation === "string" ? confirmation : "";

  const specialization = text(form, "specialization");
  const workplace = text(form, "workplace");
  const strNumber = text(form, "str_number");
  const sipNumber = text(form, "sip_number");

  const strFile = form.get("str_document");
  const sipFile = form.get("sip_document");

  if (fullName.length < 2) {
    return failure("Nama dokter minimal 2 karakter");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return failure("Format email tidak valid");
  }

  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    return failure(
      "Password minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, serta angka"
    );
  }

  if (password !== confirmPassword) {
    return failure("Konfirmasi password tidak cocok");
  }

  if (strNumber.length < 5 || sipNumber.length < 5) {
    return failure("Nomor STR dan SIP minimal 5 karakter");
  }

  if (!validDocument(strFile)) {
    return failure(
      "STR wajib PDF/JPG/PNG/WEBP, maksimal 10 MB"
    );
  }

  if (!validDocument(sipFile)) {
    return failure(
      "SIP wajib PDF/JPG/PNG/WEBP, maksimal 10 MB"
    );
  }

  if (text(form, "consent") !== "yes") {
    return failure(
      "Persetujuan kebijakan privasi dan pemrosesan data wajib diberikan"
    );
  }

  try {
    // LANGKAH 1: Upload STR
    const strPath = await uploadDocument(strFile, "STR");

    // LANGKAH 2: Upload SIP
    const sipPath = await uploadDocument(sipFile, "SIP");

    // LANGKAH 3: Registrasi menggunakan JSON
    const body = {
      full_name: fullName,
      email,
      password,
      str_number: strNumber,
      sip_number: sipNumber,
      specialization: specialization || "Kardiologi",
      ...(workplace ? { workplace } : {}),
      str_file_path: strPath,
      sip_file_path: sipPath,
      consents: [
        {
          consent_type: "privacy_policy",
          version: "1.0",
        },
        {
          consent_type: "medical_data_processing",
          version: "1.0",
        },
      ],
    };

    const response = await fetch(
      `${API}/auth/register/doctor`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Platform": "web",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      }
    );

    const result: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return failure(
        "Registrasi gagal: " +
        apiMessage(result, "Backend menolak data registrasi"),
        response.status
      );
    }

    const root =
      result && typeof result === "object"
        ? result as Record<string, unknown>
        : {};

    const data =
      root.data && typeof root.data === "object"
        ? root.data as Record<string, unknown>
        : {};

    // Access token dan refresh token dari respons registrasi
    // sengaja tidak dikirim ke browser.
    return NextResponse.json(
      {
        success: true,
        data: {
          email: data.email ?? email,
          verification_status:
            data.verification_status ?? "pending",
        },
        message:
          "Pendaftaran berhasil. Akun menunggu verifikasi Admin.",
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal menghubungi backend";

    return failure(message.slice(0, 1000), 502);
  }
}
