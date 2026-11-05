
import { NextRequest, NextResponse } from "next/server";

const API = process.env.TELEHEART_API_BASE_URL;

type Json = Record<string, any>;

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

async function backend(
  path: string,
  method: string,
  token?: string,
  payload?: unknown
) {
  if (!API) throw new Error("URL backend belum dikonfigurasi");

  const response = await fetch(`${API}/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(path === "auth/login"
        ? { "X-Client-Platform": "web" }
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

function failed(message: string, status = 400) {
  return NextResponse.json(
    { error: { message } },
    { status }
  );
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin && origin !== request.nextUrl.origin) {
    return failed("Origin tidak diizinkan", 403);
  }

  let body: Json;

  try {
    body = await request.json();
  } catch {
    return failed("Request JSON tidak valid");
  }

  const token = request.cookies.get("teleheart_token")?.value;

  try {
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
        { email: body.email, password: body.password }
      );

      if (result.status !== 200) {
        return NextResponse.json(result.json, {
          status: result.status,
        });
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

    const me = await backend("me", "GET", token);

    if (me.status !== 200) {
      const response = NextResponse.json(me.json, {
        status: me.status,
      });

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

    
    // TAHAP 4: Aksi konsultasi khusus Dokter
    if (body.action === "consultation") {
      if (role !== "doctor") {
        return failed("Hanya Dokter yang diizinkan", 403);
      }

      const id = String(body.consultationId ?? "");
      const operation = String(body.operation ?? "");

      const uuidPattern =
        /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

      if (!uuidPattern.test(id)) {
        return failed("ID konsultasi tidak valid", 400);
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
      };

      const config = operations[operation];

      if (!config) {
        return failed("Operasi konsultasi tidak tersedia", 400);
      }

      let payload: Record<string, string> = {};

      if (operation === "send") {
        const message = String(body.message ?? "").trim();

        if (!message || message.length > 5000) {
          return failed(
            "Pesan wajib diisi dan maksimal 5000 karakter",
            400
          );
        }

        payload = { message };
      }

      if (operation === "reject") {
        const reason = String(body.reason ?? "").trim();

        if (!reason || reason.length > 500) {
          return failed(
            "Alasan penolakan wajib diisi (maksimal 500 karakter)",
            400
          );
        }

        payload = { reason };
      }

      const path = `consultations/${id}${config.suffix}`;

      const result = await backend(
        path,
        config.method,
        token,
        payload
      );

      return NextResponse.json(result.json, {
        status: result.status,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    
    // TAHAP 5: Manajemen Dokter dan Admin
    if (body.action === "manage") {
      const operation = String(body.operation ?? "");

      // Dokter mengubah status online sendiri
      if (role === "doctor" && operation === "setOnline") {
        if (typeof body.is_online !== "boolean") {
          return failed("Status online harus boolean", 400);
        }

        const result = await backend(
          "doctors/me/online",
          "PATCH",
          token,
          { is_online: body.is_online }
        );

        return NextResponse.json(result.json, {
          status: result.status,
          headers: { "Cache-Control": "no-store" },
        });
      }

      // Admin memverifikasi pendaftaran dokter
      if (role === "admin" && operation === "verifyDoctor") {
        const id = String(body.doctorId ?? "");
        const status = String(body.status ?? "");
        const reason = String(body.reason ?? "").trim();

        const uuid =
          /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

        if (!uuid.test(id)) {
          return failed("ID dokter tidak valid", 400);
        }

        if (!["approved", "rejected"].includes(status)) {
          return failed("Status verifikasi tidak valid", 400);
        }

        if (status === "rejected" && !reason) {
          return failed("Alasan penolakan wajib diisi", 400);
        }

        if (reason.length > 500) {
          return failed("Alasan maksimal 500 karakter", 400);
        }

        const result = await backend(
          `admin/doctors/${id}/verification`,
          "PATCH",
          token,
          {
            status,
            ...(status === "rejected"
              ? { rejection_reason: reason }
              : {}),
          }
        );

        return NextResponse.json(result.json, {
          status: result.status,
          headers: { "Cache-Control": "no-store" },
        });
      }

      return failed("Operasi tidak diizinkan", 403);
    }



    if (body.action !== "resource") {
      return failed("Aksi tidak dikenal");
    }

    const name = String(body.name ?? "");
    const path = resources[role]?.[name];

    if (!path) {
      return failed("Resource tidak diizinkan", 403);
    }

    const result = await backend(path, "GET", token);

    return NextResponse.json(result.json, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return failed(
      "Gagal menghubungi backend TeleHeart",
      502
    );
  }
}
