"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeBrazilPhone } from "@/lib/phone";
import {
  BRAZIL_STATES,
  identityMissingMessage,
} from "@/lib/profile/identity";

export function CompleteProfileForm({
  initialPhone = "",
}: {
  initialPhone?: string | null;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [cpf, setCpf] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing = identityMissingMessage({
      cpf,
      phone: normalizeBrazilPhone(phone) ?? phone,
      city,
      state,
      address,
      addressNumber,
      birthDate,
    });
    if (missing) {
      setMessage(missing);
      return;
    }
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
          state,
          address,
          address_number: addressNumber,
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
        type="tel"
        name="phone"
        autoComplete="tel"
        inputMode="tel"
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
      <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
        <Input
          label="Cidade"
          name="city"
          placeholder="São Paulo"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          required
        />
        <label className="flex w-full flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--ink)]">Estado</span>
          <select
            name="state"
            className="h-12 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-[var(--ink)] outline-none focus:border-[var(--ink)] focus:ring-4 focus:ring-black/5"
            value={state}
            onChange={(e) => setState(e.target.value)}
            required
          >
            <option value="">UF</option>
            {BRAZIL_STATES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
        <Input
          label="Endereço"
          name="address"
          placeholder="Rua, avenida, bairro"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
        <Input
          label="Número"
          name="address_number"
          inputMode="numeric"
          placeholder="123"
          value={addressNumber}
          onChange={(e) => setAddressNumber(e.target.value)}
          required
        />
      </div>
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
