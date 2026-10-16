"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, KeyRound, UserRound, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { UserAvatar } from "@/components/ui/user-avatar";
import { MotionModal } from "@/components/ui/motion";
import { LogoutButton } from "@/components/auth/logout-button";
import { AvatarCropModal } from "@/components/profile/avatar-crop-modal";
import {
  PIX_KEY_TYPE_LABEL,
  type PixKeyType,
} from "@/lib/withdrawals/types";

type ConfirmKind = "full_name" | "email" | "phone" | null;

export function ConfiguracoesForm({
  fullName,
  email,
  phone,
  avatarUrl,
  pixKey,
  pixKeyType,
  referralCode,
}: {
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  pixKey: string | null;
  pixKeyType: PixKeyType | null;
  referralCode: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(fullName);
  const [emailValue, setEmailValue] = useState(email);
  const [phoneValue, setPhoneValue] = useState(phone ?? "");
  const [avatar, setAvatar] = useState(avatarUrl);
  const [pix, setPix] = useState(pixKey ?? "");
  const [pixType, setPixType] = useState<PixKeyType>(pixKeyType ?? "cpf");

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pixLoading, setPixLoading] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [confirmValue, setConfirmValue] = useState("");
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  function clearFeedback() {
    setMessage(null);
    setError(null);
  }

  async function patchProfile(body: Record<string, unknown>) {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      email_pending?: boolean;
    };
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? "Não foi possível salvar.");
    }
    return data;
  }

  function openConfirm(kind: ConfirmKind) {
    clearFeedback();
    setConfirmKind(kind);
    setConfirmValue("");
  }

  async function applyConfirmedChange() {
    if (!confirmKind) return;
    clearFeedback();

    const expected =
      confirmKind === "full_name"
        ? name.trim()
        : confirmKind === "email"
          ? emailValue.trim()
          : phoneValue.trim();

    if (!expected) {
      setError("Informe o novo valor antes de confirmar.");
      return;
    }
    if (confirmValue.trim() !== expected) {
      setError("Confirmação não confere. Digite o mesmo valor novamente.");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {};
      if (confirmKind === "full_name") body.full_name = expected;
      if (confirmKind === "email") body.email = expected;
      if (confirmKind === "phone") body.phone = expected || null;

      const data = await patchProfile(body);
      if (confirmKind === "email" && data.email_pending) {
        setMessage(
          "E-mail atualizado. Verifique a caixa de entrada do novo endereço para confirmar a alteração.",
        );
      } else {
        setMessage("Alteração confirmada e salva.");
      }
      setConfirmKind(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setLoading(false);
    }
  }


  function closeCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onAvatarPick(file: File | null) {
    if (!file) return;
    clearFeedback();
    if (!file.type.startsWith("image/")) {
      setError("Escolha um arquivo de imagem.");
      return;
    }
    // Any size allowed — client crops to a small JPEG before upload.
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(file));
  }

  async function onCropConfirm(blob: Blob) {
    clearFeedback();
    const previousAvatar = avatar;
    const previewUrl = URL.createObjectURL(blob);
    setAvatar(previewUrl);
    closeCrop();
    setAvatarLoading(true);
    try {
      const form = new FormData();
      form.append("file", blob, "avatar.jpg");
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        avatar_url?: string;
      };
      if (!res.ok || !data.ok || !data.avatar_url) {
        URL.revokeObjectURL(previewUrl);
        setAvatar(previousAvatar);
        setError(data.error ?? "Falha no upload da foto.");
        return;
      }
      setAvatar(data.avatar_url);
      URL.revokeObjectURL(previewUrl);
      setMessage("Foto atualizada.");
      router.refresh();
    } catch {
      URL.revokeObjectURL(previewUrl);
      setAvatar(previousAvatar);
      setError("Erro de rede no upload.");
    } finally {
      setAvatarLoading(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    clearFeedback();
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("As senhas não conferem.");
      return;
    }
    setPwdLoading(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível alterar a senha.");
        return;
      }
      setPassword("");
      setPasswordConfirm("");
      setMessage("Senha alterada com sucesso.");
    } catch {
      setError("Erro de rede.");
    } finally {
      setPwdLoading(false);
    }
  }

  async function onSavePix(e: React.FormEvent) {
    e.preventDefault();
    clearFeedback();
    setPixLoading(true);
    try {
      await patchProfile({
        pix_key: pix.trim() || null,
        pix_key_type: pix.trim() ? pixType : null,
      });
      setMessage("Chave Pix salva.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar Pix.");
    } finally {
      setPixLoading(false);
    }
  }

  const nameDirty = name.trim() !== fullName.trim();
  const emailDirty = emailValue.trim() !== email.trim();
  const phoneDirty = phoneValue.trim() !== (phone ?? "").trim();

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {message ? <p className="text-sm text-[var(--accent)]">{message}</p> : null}

      <Card className="space-y-4">
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <Camera className="h-5 w-5" />
          <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">
            Cadastrar foto
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <UserAvatar name={name || fullName} avatarUrl={avatar} size={72} />
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onAvatarPick(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={avatarLoading}
              onClick={() => fileRef.current?.click()}
            >
              {avatarLoading ? "Enviando…" : "Escolher foto"}
            </Button>
            <p className="text-xs text-[var(--ink-muted)]">
              Qualquer tamanho. Você ajusta o zoom e o recorte no círculo.
            </p>
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <UserRound className="h-5 w-5" />
          <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">
            Dados
          </h2>
        </div>
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label="Nome"
                name="full_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="accent"
              size="sm"
              disabled={!nameDirty || loading}
              onClick={() => openConfirm("full_name")}
            >
              Salvar nome
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label="E-mail"
                name="email"
                type="email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                hint="Pode exigir verificação no novo e-mail."
              />
            </div>
            <Button
              type="button"
              variant="accent"
              size="sm"
              disabled={!emailDirty || loading}
              onClick={() => openConfirm("email")}
            >
              Salvar e-mail
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label="Telefone"
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={phoneValue}
                onChange={(e) => setPhoneValue(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
            <Button
              type="button"
              variant="accent"
              size="sm"
              disabled={!phoneDirty || loading}
              onClick={() => openConfirm("phone")}
            >
              Salvar telefone
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <form className="space-y-4" onSubmit={onChangePassword}>
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <KeyRound className="h-5 w-5" />
            <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">
              Alterar senha
            </h2>
          </div>
          <Input
            label="Nova senha"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="Mínimo de 8 caracteres."
          />
          <Input
            label="Confirmar nova senha"
            name="password_confirm"
            type="password"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={pwdLoading}>
            {pwdLoading ? "Salvando…" : "Atualizar senha"}
          </Button>
        </form>
      </Card>

      <Card>
        <form className="space-y-4" onSubmit={onSavePix}>
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <Wallet className="h-5 w-5" />
            <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">
              Chave Pix
            </h2>
          </div>
          <Select
            label="Tipo da chave"
            value={pixType}
            onChange={(e) => setPixType(e.target.value as PixKeyType)}
          >
            {(Object.keys(PIX_KEY_TYPE_LABEL) as PixKeyType[]).map((k) => (
              <option key={k} value={k}>
                {PIX_KEY_TYPE_LABEL[k]}
              </option>
            ))}
          </Select>
          <Input
            label="Chave Pix"
            value={pix}
            onChange={(e) => setPix(e.target.value)}
            placeholder={
              pixType === "cpf"
                ? "000.000.000-00"
                : pixType === "email"
                  ? "voce@email.com"
                  : pixType === "phone"
                    ? "(11) 99999-9999"
                    : "Chave aleatória"
            }
          />
          <Button type="submit" variant="accent" disabled={pixLoading}>
            {pixLoading ? "Salvando…" : "Salvar chave Pix"}
          </Button>
        </form>
      </Card>

      <Card className="space-y-3">
        <div>
          <p className="text-sm text-[var(--ink-muted)]">Código de indicação</p>
          <p className="mt-1 text-xl font-bold tracking-widest text-[var(--accent)]">
            {referralCode ?? "—"}
          </p>
        </div>
        <Link href="/app/indicacoes">
          <Button variant="outline" size="md">
            Ver indicações
          </Button>
        </Link>
        <LogoutButton variant="outline" size="md" />
      </Card>

      <MotionModal
        open={confirmKind !== null}
        onClose={() => !loading && setConfirmKind(null)}
        labelledBy="confirm-change-title"
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <h2
            id="confirm-change-title"
            className="text-lg font-bold tracking-tight"
          >
            Confirmar alteração
          </h2>
          <button
            type="button"
            className="text-sm font-semibold text-[var(--ink-muted)]"
            onClick={() => !loading && setConfirmKind(null)}
          >
            Fechar
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-[var(--ink-muted)]">
            Para confirmar, digite novamente o novo valor
            {confirmKind === "full_name"
              ? " do nome"
              : confirmKind === "email"
                ? " do e-mail"
                : " do telefone"}
            .
          </p>
          <Input
            label="Confirmar valor"
            value={confirmValue}
            onChange={(e) => setConfirmValue(e.target.value)}
            autoFocus
          />
        </div>
        <div className="border-t border-[var(--line)] px-5 py-4">
          <Button
            type="button"
            variant="accent"
            fullWidth
            disabled={loading || !confirmValue.trim()}
            onClick={applyConfirmedChange}
          >
            {loading ? "Salvando…" : "Confirmar alteração"}
          </Button>
        </div>
      </MotionModal>

      <AvatarCropModal
        open={Boolean(cropSrc)}
        imageSrc={cropSrc}
        onClose={closeCrop}
        onConfirm={(blob) => void onCropConfirm(blob)}
        confirming={avatarLoading}
      />
    </div>
  );
}
