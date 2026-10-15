"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeBrazilPhone } from "@/lib/phone";

export function CompleteProfileForm({
  initialPhone = "",
}: {
  initialPhone?: string | null;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [cpf, setCpf] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/profile/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizeBrazilPhone(phone) ?? phone,
          cpf,
          city,
          address,
          birth_date: birthDate,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMessage(data.error ?? "Não foi possível salvar o cadastro.");
        return;
      }
      router.push("/app");
      router.refresh();
    } catch {
      setMessage("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <Input
        label="Telefone"
        name="phone"
        placeholder="(11) 99999-9999"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
      />
      <Input
        label="CPF"
        name="cpf"
        inputMode="numeric"
        placeholder="000.000.000-00"
        value={cpf}
        onChange={(e) => setCpf(e.target.value)}
        required
      />
      <Input
        label="Cidade"
        name="city"
        placeholder="São Paulo"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        required
      />
      <Input
        label="Endereço"
        name="address"
        placeholder="Rua, número, bairro"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        required
      />
      <Input
        label="Data de nascimento"
        name="birth_date"
        type="date"
        value={birthDate}
        onChange={(e) => setBirthDate(e.target.value)}
        required
      />
      {message ? <p className="text-sm text-[var(--danger)]">{message}</p> : null}
      <Button type="submit" variant="accent" fullWidth disabled={loading}>
        {loading ? "Salvando…" : "Concluir cadastro"}
      </Button>
    </form>
  );
}
