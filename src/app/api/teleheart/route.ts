
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const API = process.env.TELEHEART_API_BASE_URL?.replace(/\/+$/, "");

type Json = Record<string, any>;

const UUID =
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const resources: Record<string, Record<string, string>> = {
  doctor: {
    incoming: "doctors/me/queue?type=incoming",
    active: "doctors/me/queue?type=active",
    consultations: "consultations",
    profile: "doctors/me/profile",
    tariffs: "doctors/me/tariffs",
  },
  admin: {
    users: "admin/users",
    transactions: "admin/transactions",
    audit: "admin/audit-logs",
    doctors: "admin/users?role=doctor",
  },
};

function getData(json: Json): Json {
  return json?.data ?? json;
}

function failed(message: string, status = 400) {
  return NextResponse.json(
    { error: { message } },
    { status }
  );
}

async function backend(
  path: string,
  method: string,
  token?: string,
  payload?: unknown
) {
  if (!API) {
    throw new Error("URL backend belum dikonfigurasi");
  }

  const response = await fetch(`${API}/${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "X-Client-Platform": "web",
      ...(method !== "GET"
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),
    },
    ...(method !== "GET"
      ? { body: JSON.stringify(payload ?? {}) }
      : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });

  const json = await response.json().catch(() => ({
    error: { message: "Respons backend bukan JSON" },
  }));

  return { status: response.status, json };
}

function forward(result: {
  status: number;
  json: Json;
}) {
  return NextResponse.json(result.json, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin && origin !== request.nextUrl.origin) {
    return failed("Origin tidak diizinkan", 403);
  }

  let body: Json;

  try {
    body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return failed("Request JSON tidak valid");
    }
  } catch {
    return failed("Request JSON tidak valid");
  }

  const token = request.cookies.get("teleheart_token")?.value;

  try {
    // LOGIN DOKTER / ADMIN
    if (body.action === "login") {
      if (
        typeof body.email !== "string" ||
        typeof body.password !== "string"
      ) {
        return failed("Email dan password wajib diisi");
      }

      const result = await backend(
        "auth/login",
        "POST",
        undefined,
        {
          email: body.email,
          password: body.password,
        }
      );

      if (result.status !== 200) {
        return forward(result);
      }

      const data = getData(result.json);
      const user = data.user ?? {};
      const role = user.role;

      if (!["doctor", "admin"].includes(role)) {
        return failed("Akun tidak memiliki akses website", 403);
      }

      const accessToken = data.access_token;

      if (typeof accessToken !== "string") {
        return failed("Access token tidak ditemukan", 502);
      }

      const response = NextResponse.json({
        data: { user },
      });

      response.cookies.set("teleheart_token", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: Math.min(
          Number(data.expires_in) || 3600,
          3600
        ),
      });

      return response;
    }

    // LOGOUT
    if (body.action === "logout") {
      if (token) {
        await backend("auth/logout", "POST", token)
          .catch(() => null);
      }

      const response = NextResponse.json({
        data: { success: true },
      });

      response.cookies.delete("teleheart_token");
      return response;
    }

    if (!token) {
      return failed("Silakan login terlebih dahulu", 401);
    }

    // VALIDASI SESI DAN ROLE
    const me = await backend("me", "GET", token);

    if (me.status !== 200) {
      const response = forward(me);

      if (me.status === 401) {
        response.cookies.delete("teleheart_token");
      }

      return response;
    }

    const profileData = getData(me.json);
    const user = profileData.user ?? profileData;
    const role = user.role;

    if (!["doctor", "admin"].includes(role)) {
      return failed("Akses ditolak", 403);
    }

    if (body.action === "me") {
      return NextResponse.json({ data: user });
    }

    // RIWAYAT MEDIS PASIEN
    // Hanya dokter; backend wajib memverifikasi
    // hubungan dokter dengan pasien tersebut.
    if (body.action === "patientHistory") {
      if (role !== "doctor") {
        return failed("Hanya Dokter yang diizinkan", 403);
      }

      const patientId = String(body.patientId ?? "");

      if (!UUID.test(patientId)) {
        return failed("ID pasien tidak valid");
      }

      const result = await backend(
        `patients/${patientId}/history`,
        "GET",
        token
      );

      return forward(result);
    }

    // KONSULTASI DOKTER
    if (body.action === "consultation") {
      if (role !== "doctor") {
        return failed("Hanya Dokter yang diizinkan", 403);
      }

      const id = String(body.consultationId ?? "");
      const operation = String(body.operation ?? "");

      if (!UUID.test(id)) {
        return failed("ID konsultasi tidak valid");
      }

      const operations: Record<
        string,
        { method: string; suffix: string }
      > = {
        detail: {
          method: "GET",
          suffix: "",
        },
        messages: {
          method: "GET",
          suffix: "/messages",
        },
        accept: {
          method: "POST",
          suffix: "/accept",
        },
        reject: {
          method: "POST",
          suffix: "/reject",
        },
        send: {
          method: "POST",
          suffix: "/messages",
        },
        markRead: {
          method: "PATCH",
          suffix: "/messages/read",
        },
        close: {
          method: "POST",
          suffix: "/close",
        },
        getPrescription: {
          method: "GET",
          suffix: "/prescription",
        },
        savePrescription: {
          method: "POST",
          suffix: "/prescription",
        },
        issuePrescription: {
          method: "POST",
          suffix: "/prescription/issue",
        },
      };

      const config = operations[operation];

      if (!config) {
        return failed("Operasi konsultasi tidak tersedia");
      }

      let payload: Json = {};

      // CHAT: mengikuti field "body" dari Postman.
      if (operation === "send") {
        const message = String(body.message ?? "").trim();

        if (!message || message.length > 5000) {
          return failed(
            "Pesan wajib diisi dan maksimal 5000 karakter"
          );
        }

        payload = { message };
      }

      // TOLAK KONSULTASI
      if (operation === "reject") {
        const reason = String(body.reason ?? "").trim();

        if (!reason || reason.length > 500) {
          return failed(
            "Alasan penolakan wajib diisi (maksimal 500 karakter)"
          );
        }

        payload = { reason };
      }

      // TUTUP KONSULTASI
      if (operation === "close") {
        const doctorSummary = String(
          body.doctor_summary ?? ""
        ).trim();

        if (!doctorSummary || doctorSummary.length > 5000) {
          return failed(
            "Ringkasan dokter wajib diisi dan maksimal 5000 karakter"
          );
        }

        payload = { doctor_summary: doctorSummary };
      }

      // SIMPAN DRAFT RESEP
      if (operation === "savePrescription") {
        const notes = String(body.notes ?? "").trim();
        const items = body.items;

        if (
          !Array.isArray(items) ||
          items.length === 0 ||
          items.length > 20
        ) {
          return failed(
            "Resep harus memiliki 1 sampai 20 item obat"
          );
        }

        const normalizedItems = items.map((item: Json) => ({
          medicine_name: String(
            item?.medicine_name ?? ""
          ).trim(),
          dosage: String(item?.dosage ?? "").trim(),
          instructions: String(
            item?.instructions ?? ""
          ).trim(),
          quantity: String(item?.quantity ?? "").trim(),
          ...(item?.notes
            ? { notes: String(item.notes).trim() }
            : {}),
        }));

        const invalid = normalizedItems.some(
          (item) =>
            !item.medicine_name ||
            !item.dosage ||
            !item.instructions ||
            !item.quantity ||
            Object.values(item).some(
              (value) => value.length > 1000
            )
        );

        if (invalid || notes.length > 5000) {
          return failed("Data obat dalam resep tidak valid");
        }

        payload = {
          notes,
          items: normalizedItems,
        };
      }

      const result = await backend(
        `consultations/${id}${config.suffix}`,
        config.method,
        token,
        payload
      );

      return forward(result);
    }

    // PENGATURAN DOKTER DAN VERIFIKASI ADMIN
    if (body.action === "manage") {
      const operation = String(body.operation ?? "");

      if (role === "doctor" && operation === "setOnline") {
        if (typeof body.is_online !== "boolean") {
          return failed("Status online harus boolean");
        }

        return forward(
          await backend(
            "doctors/me/online",
            "PATCH",
            token,
            { is_online: body.is_online }
          )
        );
      }

      if (role === "doctor" && operation === "saveTariffs") {
        const tariffs = body.tariffs;

        if (!Array.isArray(tariffs) || tariffs.length !== 3) {
          return failed("Tarif 15, 30 dan 60 menit wajib diisi");
        }

        const durations = new Set<number>();

        for (const item of tariffs) {
          const duration = item?.duration_minutes;
          const price = item?.price;

          if (
            ![15, 30, 60].includes(duration) ||
            durations.has(duration) ||
            !Number.isSafeInteger(price) ||
            price <= 0
          ) {
            return failed("Durasi atau nominal tarif tidak valid");
          }

          durations.add(duration);
        }

        if (durations.size !== 3) {
          return failed("Tarif harus mencakup 15, 30 dan 60 menit");
        }

        return forward(
          await backend(
            "doctors/me/tariffs",
            "PUT",
            token,
            { tariffs }
          )
        );
      }

      if (role === "doctor" && operation === "saveProfile") {
        const specialization = String(
          body.specialization ?? ""
        ).trim();
        const bio = String(body.bio ?? "").trim();

        if (
          !specialization ||
          specialization.length > 200 ||
          bio.length > 3000
        ) {
          return failed("Data profil tidak valid");
        }

        return forward(
          await backend(
            "doctors/me/profile",
            "PUT",
            token,
            { specialization, bio }
          )
        );
      }

      if (role === "admin" && operation === "verifyDoctor") {
        const id = String(body.doctorId ?? "");
        const status = String(body.status ?? "");
        const reason = String(body.reason ?? "").trim();

        if (!UUID.test(id)) {
          return failed("ID dokter tidak valid");
        }

        if (!["approved", "rejected"].includes(status)) {
          return failed("Status verifikasi tidak valid");
        }

        if (status === "rejected" && !reason) {
          return failed("Alasan penolakan wajib diisi");
        }

        if (reason.length > 500) {
          return failed("Alasan maksimal 500 karakter");
        }

        return forward(
          await backend(
            `admin/doctors/${id}/verification`,
            "PATCH",
            token,
            {
              status,
              ...(status === "rejected"
                ? { rejection_reason: reason }
                : {}),
            }
          )
        );
      }

      return failed("Operasi tidak diizinkan", 403);
    }

    // SUMBER DATA DASHBOARD DOKTER / ADMIN
    if (body.action !== "resource") {
      return failed("Aksi tidak dikenal");
    }

    const name = String(body.name ?? "");
    const path = resources[role]?.[name];

    if (!path) {
      return failed("Resource tidak diizinkan", 403);
    }

    const result = await backend(path, "GET", token);

    return forward(result);
  } catch {
    return failed(
      "Gagal menghubungi backend TeleHeart",
      502
    );
  }
}
