"use client";

import { useEffect, useState } from "react";
import { Bell, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { EmptyState } from "@/components/ui/empty-state";
import { readJson } from "@/lib/http/read-json";
import {
  NOTICE_KIND_LABEL,
  couponNotice,
  raffleDateNotice,
  winnerNotice,
  type NoticeKind,
} from "@/lib/notices/copy";

type Coupon = { id: string; code: string; title: string };
type NoticeRow = {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  coupon_code: string | null;
  created_at: string;
};
type Winner = {
  winner_name: string | null;
  winner_tickets: number | null;
  draw_month: string | null;
} | null;

export function AvisosAdminPanel() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [winner, setWinner] = useState<Winner>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [couponCode, setCouponCode] = useState("");
  const [couponTitle, setCouponTitle] = useState("");
  const [kind, setKind] = useState<NoticeKind>("recado");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedCoupon, setSelectedCoupon] = useState("");

  const raffle = raffleDateNotice();
  const winnerDraft = winner?.winner_name
    ? winnerNotice(winner.winner_name, winner.winner_tickets ?? 0)
    : null;
  const selected = coupons.find((coupon) => coupon.code === selectedCoupon) ?? null;
  const couponDraft = selected ? couponNotice(selected.code, selected.title) : null;

  async function reload() {
    const res = await fetch("/api/admin/avisos");
    const data = await readJson<{
      ok?: boolean;
      error?: string;
      unavailable?: boolean;
      notices?: NoticeRow[];
      coupons?: Coupon[];
      winner?: Winner;
    }>(res);
    if (!res.ok || !data.ok) {
      setMessage(data.error ?? "Não foi possível carregar os avisos.");
      return;
    }
    setUnavailable(Boolean(data.unavailable));
    setNotices(data.notices ?? []);
    setCoupons(data.coupons ?? []);
    setWinner(data.winner ?? null);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function send(payload: Record<string, string>) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/avisos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson<{ ok?: boolean; error?: string }>(res);
      if (!res.ok || !data.ok) {
        setMessage(data.error ?? "Não foi possível salvar.");
        return;
      }
      setMessage(payload.action === "coupon" ? "Cupom cadastrado." : "Aviso disparado.");
      if (payload.action === "coupon") {
        setCouponCode("");
        setCouponTitle("");
      }
      if (payload.action === "notice" && (payload.kind === "recado" || payload.kind === "pendencia")) {
        setTitle("");
        setBody("");
      }
      await reload();
    } catch {
      setMessage("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {unavailable ? (
        <p className="text-sm text-[var(--danger)]">
          As tabelas de avisos ainda não existem neste banco. Aplique a migration 027 para gravar e disparar.
        </p>
      ) : null}
      {message ? <p className="text-sm text-[var(--ink-muted)]">{message}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="text-lg font-bold">Cupom pré-criado</h2>
          <p className="text-sm text-[var(--ink-muted)]">
            Cadastre o código antes. O disparo só envia um cupom que já existe aqui.
          </p>
          <Input
            label="Código"
            name="coupon_code"
            placeholder="IPLANET10"
            value={couponCode}
            onChange={(event) => setCouponCode(event.target.value)}
          />
          <Input
            label="Nome do cupom"
            name="coupon_title"
            placeholder="Desconto de retirada"
            value={couponTitle}
            onChange={(event) => setCouponTitle(event.target.value)}
          />
          <Button
            type="button"
            variant="accent"
            disabled={loading}
            onClick={() =>
              void send({ action: "coupon", code: couponCode, title: couponTitle })
            }
          >
            Cadastrar cupom
          </Button>
          <ul className="space-y-2">
            {coupons.map((coupon) => (
              <li key={coupon.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold">{coupon.code}</span>
                <span className="text-[var(--ink-muted)]">{coupon.title}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-bold">Recado ou pendência</h2>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Tipo</span>
            <select
              className="h-12 rounded-2xl border border-[var(--line)] bg-white px-4"
              value={kind}
              onChange={(event) => setKind(event.target.value as NoticeKind)}
            >
              <option value="recado">Recado</option>
              <option value="pendencia">Pendência</option>
            </select>
          </label>
          <Input
            label="Título"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Texto</span>
            <textarea
              className="min-h-28 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--ink)]"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          <Button
            type="button"
            disabled={loading}
            onClick={() => void send({ action: "notice", kind, title, body })}
          >
            Disparar
          </Button>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="space-y-3">
          <h2 className="font-bold">Data do sorteio</h2>
          <p className="text-sm text-[var(--ink-muted)]">{raffle.body}</p>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() =>
              void send({ action: "notice", kind: raffle.kind, title: raffle.title, body: raffle.body })
            }
          >
            Disparar data
          </Button>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-bold">Ganhador</h2>
          <p className="text-sm text-[var(--ink-muted)]">
            {winnerDraft
              ? winnerDraft.body
              : "Nenhum sorteio registrado ainda. O ganhador aparece depois do sorteio do mês."}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={loading || !winnerDraft}
            onClick={() => {
              if (!winnerDraft) return;
              void send({
                action: "notice",
                kind: winnerDraft.kind,
                title: winnerDraft.title,
                body: winnerDraft.body,
              });
            }}
          >
            Disparar ganhador
          </Button>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-bold">Enviar cupom</h2>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Cupom</span>
            <select
              className="h-12 rounded-2xl border border-[var(--line)] bg-white px-4"
              value={selectedCoupon}
              onChange={(event) => setSelectedCoupon(event.target.value)}
            >
              <option value="">Escolha um cupom</option>
              {coupons.map((coupon) => (
                <option key={coupon.id} value={coupon.code}>
                  {coupon.code} · {coupon.title}
                </option>
              ))}
            </select>
          </label>
          {couponDraft ? <p className="text-sm text-[var(--ink-muted)]">{couponDraft.body}</p> : null}
          <Button
            type="button"
            variant="outline"
            disabled={loading || !couponDraft}
            onClick={() => {
              if (!couponDraft?.couponCode) return;
              void send({
                action: "notice",
                kind: couponDraft.kind,
                title: couponDraft.title,
                body: couponDraft.body,
                coupon_code: couponDraft.couponCode,
              });
            }}
          >
            Disparar cupom
          </Button>
        </Card>
      </div>

      {notices.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title="Nenhum aviso disparado"
          description="Recados, data do sorteio, ganhador e cupons aparecem aqui e no sininho do cliente."
        />
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => (
            <Card key={notice.id} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-[var(--ink-muted)]">
                  {new Date(notice.created_at).toLocaleString("pt-BR")}
                </p>
                <p className="font-semibold">{notice.title}</p>
                <p className="text-sm text-[var(--ink-muted)]">{notice.body}</p>
              </div>
              <Pill tone={notice.kind === "pendencia" ? "danger" : "lavender"}>
                {notice.kind === "cupom" ? <Ticket className="h-3.5 w-3.5" /> : null}
                {NOTICE_KIND_LABEL[notice.kind] ?? notice.kind}
              </Pill>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
