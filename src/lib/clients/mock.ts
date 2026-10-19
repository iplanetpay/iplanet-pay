import { MOCK_USERS } from "@/lib/auth/mock";
import type { ReferralStatus } from "@/lib/referrals/types";
import type { UserRole } from "@/types/auth";

export type MockClientProfile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  store_id: string | null;
  cpf: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  address_number: string | null;
  birth_date: string | null;
  referral_code: string | null;
  referred_by: string | null;
  referral_status: ReferralStatus | null;
  created_at: string;
};

const ANA = MOCK_USERS.cliente.id;

function fromMockUser(role: UserRole, extra: Partial<MockClientProfile>): MockClientProfile {
  const user = MOCK_USERS[role];
  return {
    id: user.id,
    full_name: user.full_name,
    phone: user.phone ?? null,
    role: user.role,
    store_id: user.store_id ?? null,
    cpf: null,
    city: "São Paulo",
    state: "SP",
    address: null,
    address_number: null,
    birth_date: null,
    referral_code: null,
    referred_by: null,
    referral_status: null,
    created_at: "2026-08-01T12:00:00.000Z",
    ...extra,
  };
}

function referredClient(
  id: string,
  full_name: string,
  phone: string,
  referral_code: string,
  referred_by: string,
  referral_status: ReferralStatus,
  created_at: string,
): MockClientProfile {
  return {
    id,
    full_name,
    phone,
    role: "cliente",
    store_id: null,
    cpf: null,
    city: "São Paulo",
    state: "SP",
    address: null,
    address_number: null,
    birth_date: null,
    referral_code,
    referred_by,
    referral_status,
    created_at,
  };
}

const PROFILES: MockClientProfile[] = [
  fromMockUser("cliente", {
    cpf: "39053344705",
    address: "Rua Joaquim Floriano",
    address_number: "466",
    birth_date: "1992-05-20",
    referral_code: "ANA2026",
  }),
  fromMockUser("parceiro", {}),
  fromMockUser("staff", {}),
  fromMockUser("admin", {}),
  referredClient(
    "mock-indicado-bruno",
    "Bruno Lima",
    "+55 11 90000-0011",
    "BRUNO10",
    ANA,
    "completed",
    "2026-09-02T12:00:00.000Z",
  ),
  referredClient(
    "mock-indicado-carla",
    "Carla Souza",
    "+55 11 90000-0012",
    "CARLA25",
    ANA,
    "pending",
    "2026-09-20T12:00:00.000Z",
  ),
  referredClient(
    "mock-indicado-diego",
    "Diego Alves",
    "+55 11 90000-0013",
    "DIEGO77",
    "mock-indicado-bruno",
    "pending",
    "2026-10-05T12:00:00.000Z",
  ),
];

export function mockClientProfiles(): MockClientProfile[] {
  return PROFILES;
}

export function mockClientProfile(id: string): MockClientProfile | null {
  return PROFILES.find((p) => p.id === id) ?? null;
}

export function mockReferredBy(id: string): MockClientProfile[] {
  return PROFILES.filter((p) => p.referred_by === id);
}
