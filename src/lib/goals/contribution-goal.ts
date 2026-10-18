import { getCurrentUser } from "@/lib/auth/session";
import { listCatalogProducts } from "@/lib/catalog/products";
import { storesForProduct } from "@/lib/catalog/stores-for-product";
import { getActiveGoalForReservation } from "@/lib/goals/queries";
import { createPaymentGoal } from "@/lib/goals/mutations";
import { createReservation } from "@/lib/reservations/mutations";
import { getReservationById } from "@/lib/reservations/queries";
import {
  buildContributionPlan,
  isContributionFrequency,
  type ContributionFrequency,
} from "@/lib/reservations/contribution-plan";

export type SaveContributionMetaResult =
  | { ok: true; goal_id: string; reservation_id: string }
  | { ok: false; error: string; needsAuth?: boolean };

export async function saveContributionMeta(input: {
  name: string;
  product_id: string;
  target_date: string;
  start_date: string;
  frequency: ContributionFrequency;
  reservation_id?: string | null;
}): Promise<SaveContributionMetaResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Entre para salvar a meta.", needsAuth: true };
  }

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Dê um nome para a meta." };
  if (!isContributionFrequency(input.frequency)) {
    return { ok: false, error: "Frequência inválida." };
  }

  const startDate = input.start_date.trim();
  const targetDate = input.target_date.trim();
  if (!startDate) return { ok: false, error: "Informe a data de início." };
  let reservationId = input.reservation_id?.trim() || null;
  let productId = input.product_id.trim();
  let targetCents = 0;
  let contributedCents = 0;
  let storeId: string | null = null;

  if (reservationId) {
    const { reservation, error } = await getReservationById(reservationId);
    if (error || !reservation) {
      return { ok: false, error: error ?? "Reserva não encontrada." };
    }
    if (reservation.user_id !== user.id) {
      return { ok: false, error: "Você não pode criar meta nesta reserva." };
    }
    if (reservation.status !== "ativa") {
      return { ok: false, error: "Só é possível criar meta em uma reserva ativa." };
    }
    productId = reservation.product_id;
    targetCents = reservation.list_price_cents;
    contributedCents = reservation.amount_paid_cents;
  } else {
    if (!productId) return { ok: false, error: "Escolha um produto." };
    const { products, error } = await listCatalogProducts();
    if (error) return { ok: false, error: error };
    const product = products.find((item) => item.id === productId && item.active);
    if (!product) return { ok: false, error: "Produto não encontrado." };
    storeId =
      storesForProduct(product).find((row) => row.store && row.qty_available > 0)?.store
        ?.id ?? null;
    if (!storeId) {
      return { ok: false, error: "Nenhuma loja com estoque para este produto." };
    }
    targetCents = product.list_price_cents;
    contributedCents = 0;
  }

  let plan;
  try {
    plan = buildContributionPlan({
      targetCents,
      contributedCents,
      startDate,
      endDate: targetDate,
      frequency: input.frequency,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível montar o plano.";
    return { ok: false, error: message };
  }

  const installmentCents =
    plan.amountPerInstallmentCents > 0
      ? plan.amountPerInstallmentCents
      : plan.lastInstallmentCents;
  if (plan.remainingCents <= 0 || plan.installmentCount < 1 || installmentCents <= 0) {
    return { ok: false, error: "Não há valor restante para aportar." };
  }

  if (!reservationId) {
    if (!storeId) {
      return { ok: false, error: "Nenhuma loja com estoque para este produto." };
    }
    const created = await createReservation(productId, storeId);
    if (!created.ok) return { ok: false, error: created.error };
    reservationId = created.id;
  }

  const existing = await getActiveGoalForReservation(reservationId);
  const saved = await createPaymentGoal({
    product_id: productId,
    name,
    target_date: targetDate,
    amount_cents: plan.remainingCents,
    installment_cents: installmentCents,
    installments_count: plan.installmentCount,
    reservation_id: reservationId,
    frequency: input.frequency,
    plan_start_date: startDate,
    goal_id: existing?.id ?? null,
  });

  if (!saved.ok) return saved;
  return { ok: true, goal_id: saved.goal_id, reservation_id: reservationId };
}
