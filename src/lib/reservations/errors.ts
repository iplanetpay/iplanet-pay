export function mapReservationError(message: string | null | undefined): string {
  if (!message) return "Não foi possível concluir.";
  const m = message.toLowerCase();
  if (m.includes("could not find the function") || m.includes("p_variant_id")) {
    return "Essa variante ainda não pode ser reservada. Tente novamente em instantes.";
  }
  if (m.includes("autenticado")) return "Entre para continuar.";
  if (m.includes("estoque") && m.includes("novo")) {
    return "Sem estoque disponível nesta loja para o novo aparelho.";
  }
  if (m.includes("estoque")) return "Sem estoque disponível nesta loja.";
  if (m.includes("produto de destino") || m.includes("já está reservado")) {
    return m.includes("já está")
      ? "Escolha um aparelho diferente do atual."
      : "Este produto não está disponível.";
  }
  if (m.includes("produto")) return "Este produto não está disponível.";
  if (m.includes("não encontrada") || m.includes("nao encontrada")) {
    return "Reserva não encontrada.";
  }
  if (m.includes("não pode trocar") || m.includes("nao pode trocar")) {
    return "Você não pode trocar esta reserva.";
  }
  if (m.includes("não pode cancelar") || m.includes("nao pode cancelar")) {
    return "Você não pode cancelar esta reserva.";
  }
  if (m.includes("zerada") || m.includes("sem aportes") || m.includes("já possui aporte")) {
    return "Só é possível cancelar reservas zeradas (sem aportes pagos).";
  }
  if (m.includes("própria loja") || m.includes("propria loja")) {
    return "Somente admin pode confirmar retirada.";
  }
  if (m.includes("confirmar retirada") || m.includes("retirada de reservas")) {
    return "Só é possível confirmar retirada de reservas quitadas.";
  }
  if (
    m.includes("staff, admin ou parceiro") ||
    m.includes("somente admin")
  ) {
    return "Somente admin pode confirmar retirada.";
  }
  if (m.includes("trocar reservas ativas") || m.includes("só é possível trocar")) {
    return "Só é possível trocar reservas ativas.";
  }
  if (m.includes("ativas") || m.includes("ativa")) {
    return "Só é possível cancelar reservas ativas.";
  }
  return message;
}
