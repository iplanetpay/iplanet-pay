import { USE_MOCK_AUTH } from "@/lib/auth/mock";
import { mockCreateReset, mockRevertReset } from "@/lib/raffle/mock";
import { getRaffleAdminState, loadRaffleBalances, raffleClient } from "@/lib/raffle/queries";
import { ticketBaselineSnapshot } from "@/lib/raffle/utils";
import type { AuthUser } from "@/types/auth";

type MutationResult = { ok: true } | { ok: false; error: string };

export async function resetRaffleTickets(admin: AuthUser): Promise<MutationResult> {
  const { state } = await getRaffleAdminState();
  switch (state.kind) {
    case "awaiting_draw":
      return { ok: false, error: "Faça o sorteio antes de zerar as fichas." };
    case "reset":
      return { ok: false, error: "As fichas deste sorteio já foram zeradas." };
    case "ready":
      break;
    default: {
      const unhandled: never = state;
      return unhandled;
    }
  }

  const { balances, error } = await loadRaffleBalances();
  if (error) return { ok: false, error };

  const snapshot = ticketBaselineSnapshot(balances);
  const holders = balances.filter((b) => b.tickets > 0);
  const usersCount = holders.length;
  const totalTickets = holders.reduce((s, b) => s + b.tickets, 0);

  if (USE_MOCK_AUTH) {
    mockCreateReset(state.drawId, snapshot, usersCount, totalTickets);
    return { ok: true };
  }

  try {
    const client = await raffleClient();
    const { error: insertError } = await client.from("raffle_ticket_resets").insert({
      draw_id: state.drawId,
      snapshot,
      users_count: usersCount,
      total_tickets: totalTickets,
      created_by: admin.id,
    });
    if (insertError) return { ok: false, error: insertError.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao zerar fichas" };
  }
}

export async function revertRaffleTicketReset(
  admin: AuthUser,
  resetId: string,
): Promise<MutationResult> {
  const { state } = await getRaffleAdminState();
  if (state.kind !== "reset" || state.resetId !== resetId) {
    return { ok: false, error: "Não há reset de fichas para reverter." };
  }

  if (USE_MOCK_AUTH) {
    return mockRevertReset(resetId)
      ? { ok: true }
      : { ok: false, error: "Reset não encontrado." };
  }

  try {
    const client = await raffleClient();
    const { data, error } = await client
      .from("raffle_ticket_resets")
      .update({ reverted_at: new Date().toISOString(), reverted_by: admin.id })
      .eq("id", resetId)
      .is("reverted_at", null)
      .select("id");
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) return { ok: false, error: "Reset não encontrado." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao reverter" };
  }
}
