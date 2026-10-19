import { MOCK_USERS } from "@/lib/auth/mock";
import { MOCK_CATALOG } from "@/lib/catalog/products";
import type {
  ReservationOpsRow,
  ReservationStatus,
  ReservationStore,
  ReservationWithDetails,
} from "@/lib/reservations/types";

function store(): Map<string, ReservationWithDetails> {
  const scope = globalThis as typeof globalThis & {
    __iplanetMockReservations?: Map<string, ReservationWithDetails>;
  };
  if (!scope.__iplanetMockReservations) {
    scope.__iplanetMockReservations = new Map();
  }
  return scope.__iplanetMockReservations;
}

function nowIso() {
  return new Date().toISOString();
}

export function mockListMine(userId: string): ReservationWithDetails[] {
  return [...store().values()]
    .filter((r) => r.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function mockListRecent(limit = 12): ReservationWithDetails[] {
  return [...store().values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export function mockGetById(id: string): ReservationWithDetails | null {
  return store().get(id) ?? null;
}

export function mockAddPaidCents(reservationId: string, cents: number) {
  const current = store().get(reservationId);
  if (!current || cents <= 0) return;
  const amountPaid = current.amount_paid_cents + Math.round(cents);
  const status: ReservationStatus =
    amountPaid >= current.list_price_cents && current.status === "ativa"
      ? "quitada"
      : current.status;
  store().set(reservationId, {
    ...current,
    amount_paid_cents: amountPaid,
    status,
    updated_at: nowIso(),
  });
}

export function mockCreate(
  userId: string,
  productId: string,
  storeId: string,
): { id: string } | { error: string } {
  const product = MOCK_CATALOG.find((p) => p.id === productId);
  if (!product || !product.active) {
    return { error: "Este produto não está disponível." };
  }
  const stock = product.store_stock.find(
    (row) => row.store?.id === storeId && row.qty_available > 0,
  );
  if (!stock?.store) {
    return { error: "Sem estoque disponível nesta loja." };
  }

  const created = nowIso();
  const id = globalThis.crypto.randomUUID();
  const reservation: ReservationWithDetails = {
    id,
    user_id: userId,
    product_id: product.id,
    store_id: stock.store.id,
    status: "ativa",
    list_price_cents: product.list_price_cents,
    amount_paid_cents: 0,
    notes: null,
    expires_at: null,
    created_at: created,
    updated_at: created,
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      model: product.model,
      storage: product.storage,
      color: product.color,
      image_url: product.image_url,
    },
    store: {
      id: stock.store.id,
      name: stock.store.name,
      slug: stock.store.slug,
      city: stock.store.slug === "sao-caetano" ? "São Caetano do Sul" : "São Paulo",
    },
  };
  store().set(id, reservation);
  return { id };
}

export function mockCancel(
  userId: string,
  role: string,
  reservationId: string,
): { id: string } | { error: string } {
  const current = store().get(reservationId);
  if (!current) return { error: "Reserva não encontrada." };
  const can = current.user_id === userId || role === "staff" || role === "admin";
  if (!can) return { error: "Você não pode cancelar esta reserva." };
  if (current.status !== "ativa") {
    return { error: "Só é possível cancelar reservas ativas." };
  }
  const next: ReservationWithDetails = {
    ...current,
    status: "cancelada" as ReservationStatus,
    updated_at: nowIso(),
  };
  store().set(reservationId, next);
  return { id: reservationId };
}

export function mockListQuitadas(
  storeId?: string | null,
  limit = 24,
): ReservationWithDetails[] {
  return [...store().values()]
    .filter((r) => r.status === "quitada")
    .filter((r) => !storeId || r.store_id === storeId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, limit);
}

export function mockConfirmRetirada(
  _userId: string,
  role: string,
  partnerStoreId: string | null | undefined,
  reservationId: string,
): { id: string } | { error: string } {
  if (role !== "staff" && role !== "admin" && role !== "parceiro") {
    return { error: "Somente staff, admin ou parceiro podem confirmar retirada." };
  }
  const current = store().get(reservationId);
  if (!current) return { error: "Reserva não encontrada." };
  if (
    role === "parceiro" &&
    partnerStoreId &&
    current.store_id !== partnerStoreId
  ) {
    return { error: "Parceiro só pode confirmar retirada da própria loja." };
  }
  if (current.status !== "quitada") {
    return { error: "Só é possível confirmar retirada de reservas quitadas." };
  }
  const next: ReservationWithDetails = {
    ...current,
    status: "retirada" as ReservationStatus,
    updated_at: nowIso(),
  };
  store().set(reservationId, next);
  return { id: reservationId };
}


export function mockSwitch(
  userId: string,
  role: string,
  reservationId: string,
  newProductId: string,
): { id: string } | { error: string } {
  const current = store().get(reservationId);
  if (!current) return { error: "Reserva não encontrada." };
  const can =
    current.user_id === userId || role === "staff" || role === "admin";
  if (!can) return { error: "Você não pode trocar esta reserva." };
  if (current.status !== "ativa") {
    return { error: "Só é possível trocar reservas ativas." };
  }
  if (current.product_id === newProductId) {
    return { error: "Escolha um aparelho diferente do atual." };
  }
  const product = MOCK_CATALOG.find((p) => p.id === newProductId);
  if (!product || !product.active) {
    return { error: "Este produto não está disponível." };
  }
  const stock = product.store_stock.find(
    (row) => row.store?.id === current.store_id && row.qty_available > 0,
  );
  if (!stock?.store) {
    return { error: "Sem estoque disponível nesta loja para o novo aparelho." };
  }

  const paid = current.amount_paid_cents;
  const newStatus: ReservationStatus =
    paid >= product.list_price_cents ? "quitada" : "ativa";
  const created = nowIso();
  const newId = globalThis.crypto.randomUUID();

  store().set(reservationId, {
    ...current,
    status: "trocada",
    amount_paid_cents: 0,
    updated_at: created,
  });

  const reservation: ReservationWithDetails = {
    id: newId,
    user_id: current.user_id,
    product_id: product.id,
    store_id: current.store_id,
    status: newStatus,
    list_price_cents: product.list_price_cents,
    amount_paid_cents: paid,
    notes: `Troca a partir de ${reservationId}`,
    expires_at: null,
    created_at: created,
    updated_at: created,
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      model: product.model,
      storage: product.storage,
      color: product.color,
      image_url: product.image_url,
    },
    store: current.store,
  };
  store().set(newId, reservation);
  return { id: newId };
}


const MOCK_STORES: ReservationStore[] = [
  {
    id: "store-itaim",
    name: "iPlanet Itaim Bibi",
    slug: "itaim-bibi",
    city: "São Paulo",
  },
  {
    id: "store-sc",
    name: "iPlanet São Caetano",
    slug: "sao-caetano",
    city: "São Caetano do Sul",
  },
];

export function mockListStores(): ReservationStore[] {
  return MOCK_STORES;
}

export function mockListOps(options?: {
  status?: ReservationStatus | null;
  storeId?: string | null;
  limit?: number;
}): ReservationOpsRow[] {
  const status = options?.status ?? null;
  const storeId = options?.storeId ?? null;
  const limit = options?.limit ?? 200;

  return [...store().values()]
    .filter((r) => !status || r.status === status)
    .filter((r) => !storeId || r.store_id === storeId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map((r) => {
      const user = Object.values(MOCK_USERS).find((u) => u.id === r.user_id);
      return {
        ...r,
        client: {
          id: r.user_id,
          full_name: user?.full_name ?? "Cliente demo",
          phone: user?.phone ?? null,
          email: user?.email ?? "cliente@iplanet.demo",
        },
      };
    });
}
