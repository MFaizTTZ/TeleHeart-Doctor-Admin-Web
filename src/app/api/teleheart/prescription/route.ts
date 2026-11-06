
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const API = process.env.TELEHEART_API_BASE_URL?.replace(/\/+$/, "");
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

type Data = Record<string, unknown>;

function objectOf(value: unknown): Data {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Data)
    : {};
}

function fail(message: string, status = 400) {
  return NextResponse.json(
    { error: { message } },
    { status }
  );
}

async function backend(
  path: string,
  method: "GET" | "POST",
  token: string,
  body?: Data
) {
  if (!API) {
    throw new Error("URL backend belum dikonfigurasi");
  }

  const response = await fetch(`${API}/${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "X-Client-Platform": "web",
      ...(method === "POST"
        ? { "Content-Type": "application/json" }
        : {}),
    },
    ...(method === "POST"
      ? { body: JSON.stringify(body ?? {}) }
      : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });

  const json: unknown = await response.json().catch(() => ({
    error: { message: `Backend mengembalikan HTTP ${response.status}` },
  }));

  return { status: response.status, json };
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin && origin !== request.nextUrl.origin) {
    return fail("Origin tidak diizinkan", 403);
  }

  const token = request.cookies.get("teleheart_token")?.value;

  if (!token) {
    return fail("Silakan login sebagai dokter", 401);
  }

  try {
    const input = objectOf(await request.json().catch(() => null));

    const id = String(input.consultationId ?? "");
    const action = String(input.action ?? "");

    if (!UUID.test(id)) {
      return fail("ID konsultasi tidak valid");
    }

    const allowed = [
      "detail",
      "getPrescription",
      "savePrescription",
      "issuePrescription",
    ];

    if (!allowed.includes(action)) {
      return fail("Aksi resep tidak tersedia");
    }

    const session = await backend("me", "GET", token);

    if (session.status !== 200) {
      return NextResponse.json(session.json, {
        status: session.status,
      });
    }

    const root = objectOf(session.json);
    const data = objectOf(root.data);
    const user = objectOf(data.user ?? root.user ?? data);

    if (user.role !== "doctor") {
      return fail("Hanya dokter yang memiliki akses", 403);
    }

    let path = `consultations/${id}`;
    let method: "GET" | "POST" = "GET";
    let payload: Data = {};

    if (action === "getPrescription") {
      path += "/prescription";
    }

    if (action === "savePrescription") {
      path += "/prescription";
      method = "POST";

      const notes = String(input.notes ?? "").trim();
      const rawItems = input.items;

      if (
        !Array.isArray(rawItems) ||
        rawItems.length < 1 ||
        rawItems.length > 20
      ) {
        return fail("Resep wajib memiliki 1 sampai 20 item obat");
      }

      const items = rawItems.map((raw: unknown) => {
        const item = objectOf(raw);

        return {
          medicine_name: String(item.medicine_name ?? "").trim(),
          dosage: String(item.dosage ?? "").trim(),
          instructions: String(item.instructions ?? "").trim(),
          quantity: String(item.quantity ?? "").trim(),
          notes: String(item.notes ?? "").trim(),
        };
      });

      const invalid = items.some(
        (item) =>
          !item.medicine_name ||
          !item.dosage ||
          !item.instructions ||
          !item.quantity ||
          Object.values(item).some((value) => value.length > 1000)
      );

      if (invalid || notes.length > 5000) {
        return fail(
          "Lengkapi nama obat, dosis, aturan pakai dan jumlah obat"
        );
      }

      payload = { notes, items };
    }

    if (action === "issuePrescription") {
      path += "/prescription/issue";
      method = "POST";
    }

    const result = await backend(path, method, token, payload);

    // Sebelum resep dibuat, backend dapat mengembalikan 404.
    if (
      action === "getPrescription" &&
      result.status === 404
    ) {
      return NextResponse.json({
        data: null,
        has_prescription: false,
      });
    }

    return NextResponse.json(result.json, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return fail("Gagal menghubungi backend TeleHeart", 502);
  }
}
