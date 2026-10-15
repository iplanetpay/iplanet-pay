import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import { getCurrentUser } from "@/lib/auth/session";
import { mapReservationError } from "@/lib/reservations/errors";
import { mockCancel, mockConfirmRetirada, mockCreate, mockSwitch } from "@/lib/reservations/mock";

export type MutationResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createReservation(
  productId: string,
  storeId: string,
): Promise<MutationResult> {
  if (!productId || !storeId) {
    return { ok: false, error: "Escolha o produto e a loja." };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entre para continuar." };

  if (USE_MOCK_AUTH) {
    const result = mockCreate(user.id, productId, storeId);
    if ("error" in result) return { ok: false, error: result.error };
    return { ok: true, id: result.id };
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_reservation", {
      p_product_id: productId,
      p_store_id: storeId,
    });

    if (error || !data) {
      return { ok: false, error: mapReservationError(error?.message) };
    }
    return { ok: true, id: data as string };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao reservar";
    return { ok: false, error: mapReservationError(message) };
  }
}

export async function cancelReservation(
  reservationId: string,
): Promise<MutationResult> {
  if (!reservationId) {
    return { ok: false, error: "Reserva inválida." };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entre para continuar." };

  if (USE_MOCK_AUTH) {
    const result = mockCancel(user.id, user.role, reservationId);
    if ("error" in result) return { ok: false, error: result.error };
    return { ok: true, id: result.id };
  }

  try {
    const { tryCreateServiceClient } = await import("@/lib/supabase/admin");
    const admin = tryCreateServiceClient();
    if (admin && user.role !== "admin") {
      const { data: reservation, error: loadError } = await admin
        .from("reservations")
        .select("id, user_id, status, amount_paid_cents")
        .eq("id", reservationId)
        .maybeSingle();
      if (loadError || !reservation) {
        return { ok: false, error: "Reserva não encontrada." };
      }
      if (reservation.user_id !== user.id) {
        return { ok: false, error: "Você não pode cancelar esta reserva." };
      }
      if (reservation.status !== "ativa") {
        return { ok: false, error: "Só é possível cancelar reservas ativas." };
      }
      const { data: contribs } = await admin
        .from("contributions")
        .select("id, amount_cents")
        .eq("reservation_id", reservationId)
        .eq("status", "confirmed");
      const refund = (contribs ?? []).reduce((sum, row) => sum + (row.amount_cents ?? 0), 0);
      const { creditWallet } = await import("@/lib/wallet/balance");
      if (refund > 0) {
        const credited = await creditWallet({
          userId: user.id,
          amountCents: refund,
          memo: `credito-cancelamento ${reservationId}`,
          reservationId,
        });
        if (!credited.ok) return { ok: false, error: credited.error };
        await admin
          .from("contributions")
          .update({ status: "refunded", updated_at: new Date().toISOString() })
          .eq("reservation_id", reservationId)
          .eq("status", "confirmed");
      }
      const { error: cancelError } = await admin
        .from("reservations")
        .update({
          status: "cancelada",
          amount_paid_cents: 0,
          cancel_reason: "manual",
          updated_at: new Date().toISOString(),
        })
        .eq("id", reservationId)
        .eq("status", "ativa");
      if (cancelError) return { ok: false, error: cancelError.message };
      return { ok: true, id: reservationId };
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("cancel_reservation", {
      p_reservation_id: reservationId,
    });

    if (error) {
      return { ok: false, error: mapReservationError(error.message) };
    }
    return { ok: true, id: (data as string) ?? reservationId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao cancelar";
    return { ok: false, error: mapReservationError(message) };
  }
}

export async function confirmRetirada(
  reservationId: string,
): Promise<MutationResult> {
  if (!reservationId) {
    return { ok: false, error: "Reserva inválida." };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entre para continuar." };

  if (user.role !== "admin") {
    return {
      ok: false,
      error: "Somente admin pode confirmar retirada.",
    };
  }

  if (USE_MOCK_AUTH) {
    const result = mockConfirmRetirada(user.id, user.role, user.store_id, reservationId);
    if ("error" in result) return { ok: false, error: result.error };
    return { ok: true, id: result.id };
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("confirm_retirada", {
      p_reservation_id: reservationId,
    });

    if (error) {
      return { ok: false, error: mapReservationError(error.message) };
    }
    return { ok: true, id: (data as string) ?? reservationId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao confirmar retirada";
    return { ok: false, error: mapReservationError(message) };
  }
}

export async function switchReservation(
  reservationId: string,
  productId: string,
): Promise<MutationResult> {
  if (!reservationId || !productId) {
    return { ok: false, error: "Escolha o novo aparelho." };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Entre para continuar." };

  if (USE_MOCK_AUTH) {
    const result = mockSwitch(user.id, user.role, reservationId, productId);
    if ("error" in result) return { ok: false, error: result.error };
    return { ok: true, id: result.id };
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("switch_reservation", {
      p_old_reservation_id: reservationId,
      p_new_product_id: productId,
    });

    if (error || !data) {
      return { ok: false, error: mapReservationError(error?.message) };
    }
    return { ok: true, id: data as string };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao trocar aparelho";
    return { ok: false, error: mapReservationError(message) };
  }
}
