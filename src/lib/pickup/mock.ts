import { MOCK_USERS } from "@/lib/auth/mock";
import type { FulfillmentRow, FulfillmentUpdate } from "@/lib/pickup/admin-queries";
import { canMoveFulfillment } from "@/lib/pickup/fulfillment";

const ITAIM = { id: "store-itaim", name: "iPlanet Itaim Bibi", city: "São Paulo" };
const SAO_CAETANO = { id: "store-sc", name: "iPlanet São Caetano", city: "São Caetano do Sul" };

const ANA = {
  full_name: MOCK_USERS.cliente.full_name,
  phone: MOCK_USERS.cliente.phone ?? null,
  email: MOCK_USERS.cliente.email,
  cpf: "39053344705",
};

function seed(): FulfillmentRow[] {
  return [
    {
      id: "mock-pickup-1",
      reservation_id: "mock-res-pickup-1",
      user_id: MOCK_USERS.cliente.id,
      mode: "shipping",
      status: "approved",
      shipping_method: "sedex",
      address: {
        street: "Rua Joaquim Floriano",
        number: "466",
        complement: "Apto 52",
        district: "Itaim Bibi",
        city: "São Paulo",
        state: "SP",
        zip: "04534002",
      },
      freight_cents: 4500,
      insurance_cents: 1200,
      freight_paid: true,
      loan_contract_signed_at: null,
      tracking_code: null,
      admin_notes: null,
      status_changed_at: "2026-10-18T15:00:00.000Z",
      created_at: "2026-10-18T13:20:00.000Z",
      updated_at: "2026-10-18T15:00:00.000Z",
      client: ANA,
      device: {
        product_id: "mock-iphone-17",
        name: "iPhone 17",
        model: "iPhone 17",
        storage: "256 GB",
        color: "Lavanda",
        image_url: "/products/iphone-17.png",
      },
      store: ITAIM,
      reservation: { status: "quitada", list_price_cents: 799900, amount_paid_cents: 799900 },
    },
    {
      id: "mock-pickup-2",
      reservation_id: "mock-res-pickup-2",
      user_id: "mock-indicado-bruno",
      mode: "store",
      status: "pending",
      shipping_method: null,
      address: null,
      freight_cents: 0,
      insurance_cents: 0,
      freight_paid: false,
      loan_contract_signed_at: "2026-10-19T11:10:00.000Z",
      tracking_code: null,
      admin_notes: null,
      status_changed_at: null,
      created_at: "2026-10-19T11:10:00.000Z",
      updated_at: "2026-10-19T11:10:00.000Z",
      client: { full_name: "Bruno Lima", phone: "+55 11 90000-0011", email: null, cpf: null },
      device: {
        product_id: "mock-macbook-air",
        name: "MacBook Air",
        model: "MacBook Air",
        storage: "256 GB",
        color: "Prata",
        image_url: "/products/macbook-air-m4.jpg",
      },
      store: SAO_CAETANO,
      reservation: { status: "ativa", list_price_cents: 899900, amount_paid_cents: 674925 },
    },
    {
      id: "mock-pickup-3",
      reservation_id: "mock-res-pickup-3",
      user_id: "mock-indicado-carla",
      mode: "store",
      status: "completed",
      shipping_method: null,
      address: null,
      freight_cents: 0,
      insurance_cents: 0,
      freight_paid: false,
      loan_contract_signed_at: null,
      tracking_code: null,
      admin_notes: "Retirado com RG.",
      status_changed_at: "2026-10-10T17:40:00.000Z",
      created_at: "2026-10-08T10:00:00.000Z",
      updated_at: "2026-10-10T17:40:00.000Z",
      client: { full_name: "Carla Souza", phone: "+55 11 90000-0012", email: null, cpf: null },
      device: {
        product_id: "mock-iphone-17-pro",
        name: "iPhone 17 Pro",
        model: "iPhone 17 Pro",
        storage: "256 GB",
        color: "Azul",
        image_url: "/products/iphone-17.png",
      },
      store: ITAIM,
      reservation: { status: "retirada", list_price_cents: 999900, amount_paid_cents: 999900 },
    },
  ];
}

function rows(): FulfillmentRow[] {
  const scope = globalThis as typeof globalThis & { __iplanetMockFulfillment?: FulfillmentRow[] };
  if (!scope.__iplanetMockFulfillment) scope.__iplanetMockFulfillment = seed();
  return scope.__iplanetMockFulfillment;
}

export function mockFulfillmentRows(): FulfillmentRow[] {
  return rows().map((row) => ({ ...row }));
}

export function mockUpdateFulfillment(
  id: string,
  update: FulfillmentUpdate,
): { ok: true } | { ok: false; error: string } {
  const list = rows();
  const index = list.findIndex((row) => row.id === id);
  if (index < 0) return { ok: false, error: "Solicitação não encontrada." };
  const current = list[index];
  const now = new Date().toISOString();
  const next: FulfillmentRow = { ...current, updated_at: now };
  if (update.status && update.status !== current.status) {
    if (!canMoveFulfillment(current.status, update.status, current.mode)) {
      return { ok: false, error: "Essa mudança de status não é permitida." };
    }
    next.status = update.status;
    next.status_changed_at = now;
  }
  if (update.tracking_code !== undefined) next.tracking_code = update.tracking_code?.trim() || null;
  if (update.admin_notes !== undefined) next.admin_notes = update.admin_notes?.trim() || null;
  list[index] = next;
  return { ok: true };
}
