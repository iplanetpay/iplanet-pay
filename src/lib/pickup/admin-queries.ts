import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import { mockFulfillmentRows, mockUpdateFulfillment } from "@/lib/pickup/mock";
import {
  canMoveFulfillment,
  isFulfillmentMode,
  isFulfillmentStatus,
  parseFulfillmentAddress,
  type FulfillmentAddress,
  type FulfillmentMode,
  type FulfillmentStatus,
} from "@/lib/pickup/fulfillment";
import { confirmRetirada } from "@/lib/reservations/mutations";
import { tryCreateServiceClient } from "@/lib/supabase/admin";

export type FulfillmentRow = {
  id: string;
  reservation_id: string;
  user_id: string;
  mode: FulfillmentMode;
  status: FulfillmentStatus;
  shipping_method: string | null;
  address: FulfillmentAddress | null;
  freight_cents: number;
  insurance_cents: number;
  freight_paid: boolean;
  loan_contract_signed_at: string | null;
  tracking_code: string | null;
  admin_notes: string | null;
  status_changed_at: string | null;
  created_at: string;
  updated_at: string;
  client: {
    full_name: string | null;
    phone: string | null;
    email: string | null;
    cpf: string | null;
  };
  device: {
    product_id: string | null;
    name: string;
    model: string | null;
    storage: string | null;
    color: string | null;
    image_url: string | null;
  };
  store: { id: string | null; name: string | null; city: string | null };
  reservation: {
    status: string;
    list_price_cents: number;
    amount_paid_cents: number;
  };
};

type RawRequest = {
  id: string;
  reservation_id: string;
  user_id: string;
  mode: string;
  status: string;
  shipping_method: string | null;
  address_json: unknown;
  freight_cents: number | null;
  insurance_cents: number | null;
  freight_pix_contribution_id: string | null;
  loan_contract_signed_at: string | null;
  tracking_code?: string | null;
  admin_notes?: string | null;
  status_changed_at?: string | null;
  created_at: string;
  updated_at: string;
};

type RawReservation = {
  id: string;
  status: string;
  list_price_cents: number;
  amount_paid_cents: number;
  product: Record<string, unknown> | Record<string, unknown>[] | null;
  store: Record<string, unknown> | Record<string, unknown>[] | null;
};

const BASE_COLUMNS =
  "id, reservation_id, user_id, mode, status, shipping_method, address_json, freight_cents, insurance_cents, freight_pix_contribution_id, loan_contract_signed_at, created_at, updated_at";
const PREP_COLUMNS = "tracking_code, admin_notes, status_changed_at";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function listFulfillmentRequests(): Promise<{
  rows: FulfillmentRow[];
  error: string | null;
}> {
  if (USE_MOCK_AUTH) return { rows: mockFulfillmentRows(), error: null };
  const admin = tryCreateServiceClient();
  if (!admin) return { rows: [], error: "SUPABASE_SERVICE_ROLE_KEY não configurada." };

  let requests: RawRequest[] = [];
  const full = await admin
    .from("pickup_requests")
    .select(`${BASE_COLUMNS}, ${PREP_COLUMNS}`)
    .order("created_at", { ascending: false })
    .limit(300);
  if (full.error) {
    // Before migration 033 the preparation columns do not exist yet.
    const base = await admin
      .from("pickup_requests")
      .select(BASE_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(300);
    if (base.error) return { rows: [], error: base.error.message };
    requests = (base.data ?? []) as RawRequest[];
  } else {
    requests = (full.data ?? []) as RawRequest[];
  }
  if (requests.length === 0) return { rows: [], error: null };

  const reservationIds = [...new Set(requests.map((r) => r.reservation_id))];
  const userIds = [...new Set(requests.map((r) => r.user_id))];
  const freightIds = requests
    .map((r) => r.freight_pix_contribution_id)
    .filter((id): id is string => Boolean(id));

  const [reservations, profiles, freight, users] = await Promise.all([
    admin
      .from("reservations")
      .select(
        "id, status, list_price_cents, amount_paid_cents, product:products ( id, name, model, storage, color, image_url ), store:stores ( id, name, city )",
      )
      .in("id", reservationIds),
    admin.from("profiles").select("id, full_name, phone, cpf").in("id", userIds),
    freightIds.length
      ? admin.from("contributions").select("id, status").in("id", freightIds)
      : Promise.resolve({ data: [] as { id: string; status: string }[], error: null }),
    Promise.all(userIds.map((id) => admin.auth.admin.getUserById(id).catch(() => null))),
  ]);

  const reservationMap = new Map(
    ((reservations.data ?? []) as RawReservation[]).map((r) => [r.id, r]),
  );
  const profileMap = new Map(
    ((profiles.data ?? []) as { id: string; full_name: string | null; phone: string | null; cpf: string | null }[]).map(
      (p) => [p.id, p],
    ),
  );
  const freightPaid = new Set(
    ((freight.data ?? []) as { id: string; status: string }[])
      .filter((c) => c.status === "confirmed")
      .map((c) => c.id),
  );
  const emailMap = new Map<string, string | null>();
  users.forEach((result, index) => {
    emailMap.set(userIds[index], result?.data?.user?.email ?? null);
  });

  const rows: FulfillmentRow[] = [];
  for (const request of requests) {
    if (!isFulfillmentMode(request.mode) || !isFulfillmentStatus(request.status)) continue;
    const reservation = reservationMap.get(request.reservation_id);
    const product = one(reservation?.product);
    const store = one(reservation?.store);
    const profile = profileMap.get(request.user_id);
    rows.push({
      id: request.id,
      reservation_id: request.reservation_id,
      user_id: request.user_id,
      mode: request.mode,
      status: request.status,
      shipping_method: request.shipping_method,
      address: parseFulfillmentAddress(request.address_json),
      freight_cents: request.freight_cents ?? 0,
      insurance_cents: request.insurance_cents ?? 0,
      freight_paid: request.freight_pix_contribution_id
        ? freightPaid.has(request.freight_pix_contribution_id)
        : false,
      loan_contract_signed_at: request.loan_contract_signed_at,
      tracking_code: request.tracking_code ?? null,
      admin_notes: request.admin_notes ?? null,
      status_changed_at: request.status_changed_at ?? null,
      created_at: request.created_at,
      updated_at: request.updated_at,
      client: {
        full_name: profile?.full_name ?? null,
        phone: profile?.phone ?? null,
        email: emailMap.get(request.user_id) ?? null,
        cpf: profile?.cpf ?? null,
      },
      device: {
        product_id: str(product?.id),
        name: str(product?.name) ?? "Aparelho",
        model: str(product?.model),
        storage: str(product?.storage),
        color: str(product?.color),
        image_url: str(product?.image_url),
      },
      store: { id: str(store?.id), name: str(store?.name), city: str(store?.city) },
      reservation: {
        status: reservation?.status ?? "",
        list_price_cents: reservation?.list_price_cents ?? 0,
        amount_paid_cents: reservation?.amount_paid_cents ?? 0,
      },
    });
  }
  return { rows, error: null };
}

export type FulfillmentUpdate = {
  status?: FulfillmentStatus;
  tracking_code?: string | null;
  admin_notes?: string | null;
};

export async function updateFulfillmentRequest(
  id: string,
  update: FulfillmentUpdate,
  handledBy: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (USE_MOCK_AUTH) return mockUpdateFulfillment(id, update);
  const admin = tryCreateServiceClient();
  if (!admin) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY não configurada." };

  const { data: current, error } = await admin
    .from("pickup_requests")
    .select("id, mode, status, reservation_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !current) return { ok: false, error: "Solicitação não encontrada." };
  if (!isFulfillmentMode(current.mode) || !isFulfillmentStatus(current.status)) {
    return { ok: false, error: "Solicitação com status desconhecido." };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (update.status && update.status !== current.status) {
    if (!canMoveFulfillment(current.status, update.status, current.mode)) {
      return { ok: false, error: "Essa mudança de status não é permitida." };
    }
    patch.status = update.status;
  }

  const prep: Record<string, unknown> = {};
  if (update.tracking_code !== undefined) prep.tracking_code = update.tracking_code?.trim() || null;
  if (update.admin_notes !== undefined) prep.admin_notes = update.admin_notes?.trim() || null;
  if (patch.status) {
    prep.status_changed_at = now;
    prep.handled_by = handledBy;
  }

  let result = await admin.from("pickup_requests").update({ ...patch, ...prep }).eq("id", id);
  if (result.error && Object.keys(prep).length > 0 && !patch.status) {
    return { ok: false, error: "Aplique a migração 033 para salvar rastreio e observações." };
  }
  if (result.error && patch.status) {
    result = await admin.from("pickup_requests").update(patch).eq("id", id);
  }
  if (result.error) return { ok: false, error: result.error.message };

  if (patch.status === "completed") {
    const { data: reservation } = await admin
      .from("reservations")
      .select("status")
      .eq("id", current.reservation_id)
      .maybeSingle();
    if (reservation?.status === "quitada") await confirmRetirada(current.reservation_id);
  }
  return { ok: true };
}
