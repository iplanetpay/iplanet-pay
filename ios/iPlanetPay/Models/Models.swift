import Foundation
import IPlanetCore

enum UserRole: String, Codable, Sendable, Hashable {
    case cliente
    case parceiro
    case staff
    case admin

    init(stored: String?) {
        self = UserRole(rawValue: stored ?? "") ?? .cliente
    }

    var homeTitle: String {
        switch self {
        case .cliente: "Início"
        case .admin: "Admin"
        case .parceiro, .staff: "Conta"
        }
    }
}

struct Profile: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var fullName: String
    var phone: String?
    var role: String
    var storeId: UUID?
    var avatarUrl: String?
    var pixKey: String?
    var pixKeyType: String?
    var referralCode: String?
    var referredBy: UUID?
    var referralBonusBalanceCents: Int?
    var cpf: String?
    var city: String?
    var state: String?
    var address: String?
    var addressNumber: String?
    var birthDate: String?
    var createdAt: Date?
    var termsAcceptedAt: Date?
    var termsVersion: String?

    var userRole: UserRole { UserRole(stored: role) }
    var bonusCents: Int { referralBonusBalanceCents ?? 0 }
    var displayName: String { fullName.isEmpty ? "Cliente" : fullName }

    var identityComplete: Bool {
        BrazilID.normalizeCPF(cpf) != nil
            && (BrazilPhone.normalize(phone)?.count ?? 0) >= 12
            && !(city ?? "").trimmingCharacters(in: .whitespaces).isEmpty
            && BrazilID.states.contains((state ?? "").uppercased())
            && !(address ?? "").trimmingCharacters(in: .whitespaces).isEmpty
            && !(addressNumber ?? "").trimmingCharacters(in: .whitespaces).isEmpty
            && BrazilID.validBirthDate(birthDate)
    }
}

struct Product: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var name: String
    var slug: String
    var brand: String
    var model: String
    var storage: String
    var color: String?
    var listPriceCents: Int
    var imageUrl: String?
    var description: String?
    var active: Bool
    var category: String?
    var categoryId: UUID?

    var subtitle: String {
        [storage, color].compactMap { value in
            let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed?.isEmpty == false ? trimmed : nil
        }.joined(separator: " · ")
    }
}

struct Store: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var name: String
    var slug: String
    var address: String?
    var city: String?
}

struct ProductCategory: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var name: String
    var slug: String
    var sortOrder: Int?
    var active: Bool?
}

struct ProductSnippet: Codable, Hashable, Sendable {
    let id: UUID
    var name: String
    var slug: String?
    var brand: String?
    var model: String?
    var storage: String?
    var color: String?
    var imageUrl: String?

    var subtitle: String {
        [storage, color].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
    }
}

struct StoreSnippet: Codable, Hashable, Sendable {
    let id: UUID
    var name: String
    var slug: String?
    var city: String?
}

struct ReservationRow: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var userId: UUID
    var productId: UUID
    var storeId: UUID
    var status: String
    var listPriceCents: Int
    var amountPaidCents: Int
    var notes: String?
    var expiresAt: Date?
    var createdAt: Date?
    var updatedAt: Date?
    var product: ProductSnippet?
    var store: StoreSnippet?

    var remainingCents: Int { max(0, listPriceCents - amountPaidCents) }

    var progress: Double {
        guard listPriceCents > 0 else { return 0 }
        return min(1, max(0, Double(amountPaidCents) / Double(listPriceCents)))
    }

    var statusLabel: String {
        switch status {
        case "ativa": "Ativa"
        case "quitada": "Quitada"
        case "cancelada": "Cancelada"
        case "retirada": "Retirada"
        case "trocada": "Trocada"
        case "saque_pendente": "Saque pendente"
        case "sacada": "Sacada"
        default: status
        }
    }
}

struct Contribution: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var userId: UUID
    var reservationId: UUID
    var amountCents: Int
    var paymentMethod: String
    var status: String
    var pixCode: String?
    var pixQrBase64: String?
    var gatewayPaymentId: String?
    var gatewayProvider: String?
    var confirmedAt: Date?
    var createdAt: Date?

    var statusLabel: String {
        switch status {
        case "pending": "Pendente"
        case "confirmed": "Confirmado"
        case "failed": "Falhou"
        case "refunded": "Estornado"
        case "expired": "Expirado"
        default: status
        }
    }
}

struct WalletEntry: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var userId: UUID
    var reservationId: UUID?
    var contributionId: UUID?
    var entryType: String
    var amountCents: Int
    var memo: String?
    var createdAt: Date?

    var label: String {
        switch entryType {
        case "aporte": "Aporte"
        case "aplicacao": "Aplicação"
        case "estorno": "Estorno"
        case "ajuste": "Ajuste"
        default: entryType
        }
    }
}

struct PaymentGoal: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var userId: UUID
    var productId: UUID
    var reservationId: UUID?
    var name: String
    var targetDate: String
    var reminderDay: Int?
    var amountCents: Int
    var installmentCents: Int
    var installmentsCount: Int
    var frequency: String?
    var planStartDate: String?
    var status: String
    var whatsappPhone: String?
    var createdAt: Date?
}

struct ReferralRow: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var referrerId: UUID
    var referredId: UUID
    var status: String
    var bonusAmountCents: Int
    var bonusCredited: Bool
    var createdAt: Date?

    var statusLabel: String {
        switch status {
        case "pending": "Pendente"
        case "completed": "Concluída"
        case "cap_reached": "Limite"
        case "cancelled": "Cancelada"
        default: status
        }
    }
}

struct Notice: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var kind: String
    var title: String
    var body: String
    var couponCode: String?
    var createdAt: Date?

    var kindLabel: String {
        switch kind {
        case "pendencia": "Pendência"
        case "recado": "Recado"
        case "sorteio": "Sorteio"
        case "ganhador": "Ganhador"
        case "cupom": "Cupom"
        default: kind
        }
    }
}

struct NoticeRead: Codable, Hashable, Sendable {
    var noticeId: UUID
    var userId: UUID
}

struct WithdrawalRequest: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var userId: UUID
    var reservationId: UUID
    var totalPaidCents: Int
    var feePercentage: Double?
    var feeAmountCents: Int
    var refundAmountCents: Int
    var pixKey: String
    var pixKeyType: String
    var holderFullName: String
    var status: String
    var payoutStatus: String?
    var createdAt: Date?

    var statusLabel: String {
        switch status {
        case "pending": "Pendente"
        case "approved": "Aprovado"
        case "rejected": "Recusado"
        case "cancelled": "Cancelado"
        default: status
        }
    }
}

struct UsedDeviceOffer: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var reservationId: UUID
    var deviceModel: String
    var imei: String
    var expectedValueCents: Int
    var minimumValueCents: Int
    var status: String
    var adminMessage: String?
    var approvedValueCents: Int?
    var batteryHealthPct: Int?
    var reviewedAt: Date?
    var createdAt: Date?

    var isCounterOffer: Bool {
        status == "pending" && reviewedAt != nil && (approvedValueCents ?? 0) > 0
    }

    var statusLabel: String {
        switch status {
        case "pending": "Pendente de avaliação"
        case "approved": "Aprovado"
        case "rejected": "Recusado"
        default: status
        }
    }
}

struct PickupRequest: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var reservationId: UUID
    var mode: String
    var status: String
    var shippingMethod: String?
    var freightCents: Int?
    var trackingCode: String?
    var createdAt: Date?

    var modeLabel: String { mode == "shipping" ? "Envio" : "Retirada na loja" }

    var label: String {
        let fulfillment = FulfillmentStatus(rawValue: status)
        let fulfillmentMode = FulfillmentMode(rawValue: mode) ?? .store
        if let fulfillment {
            return FulfillmentRules.statusLabel(fulfillment, mode: fulfillmentMode)
        }
        return status
    }
}

struct RaffleDraw: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var drawMonth: String?
    var winnerName: String?
    var winnerTickets: Int?
    var totalTicketsPool: Int?
    var drawnAt: Date?
}

struct FinancialClosing: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var periodStart: String
    var periodEnd: String
    var totalRevenueCents: Int
    var totalContributionsCount: Int
    var totalWithdrawalsCents: Int
    var netCents: Int
    var notes: String?
    var createdAt: Date?
}

struct IDRow: Codable, Hashable, Sendable {
    let id: UUID
}
