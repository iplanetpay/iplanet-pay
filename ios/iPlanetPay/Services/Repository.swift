import Foundation
import Supabase

enum Repository {
    private static var client: SupabaseClient { SupabaseService.client }

    static func profile(id: UUID) async throws -> Profile? {
        let rows: [Profile] = try await client
            .from("profiles")
            .select("id, full_name, phone, role, store_id, avatar_url, pix_key, pix_key_type, referral_code, referred_by, referral_bonus_balance_cents, cpf, city, state, address, address_number, birth_date, created_at, terms_accepted_at, terms_version")
            .eq("id", value: id)
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    static func ensureProfile(id: UUID, fullName: String) async throws -> Profile {
        if let existing = try await profile(id: id) {
            return existing
        }
        let seed: [String: String] = [
            "id": id.uuidString,
            "full_name": fullName,
            "role": "cliente",
        ]
        do {
            try await client.from("profiles").insert(seed).execute()
        } catch {
            if let existing = try await profile(id: id) {
                return existing
            }
            throw error
        }
        if let created = try await profile(id: id) {
            return created
        }
        throw RepoError("Perfil não encontrado depois do cadastro.")
    }

    static func updateProfile(id: UUID, fields: [String: String?]) async throws {
        try await client.from("profiles").update(fields).eq("id", value: id).execute()
    }

    static func products() async throws -> [Product] {
        let rows: [Product] = try await client
            .from("products")
            .select("id, name, slug, brand, model, storage, color, list_price_cents, image_url, description, active, category, category_id")
            .eq("active", value: true)
            .order("list_price_cents", ascending: true)
            .execute()
            .value
        return rows
    }

    static func allProducts() async throws -> [Product] {
        let rows: [Product] = try await client
            .from("products")
            .select("id, name, slug, brand, model, storage, color, list_price_cents, image_url, description, active, category, category_id")
            .order("name", ascending: true)
            .limit(300)
            .execute()
            .value
        return rows
    }

    static func setProductActive(id: UUID, active: Bool) async throws {
        try await client
            .from("products")
            .update(["active": active])
            .eq("id", value: id)
            .execute()
    }

    static func stores() async throws -> [Store] {
        let rows: [Store] = try await client
            .from("stores")
            .select("id, name, slug, address, city")
            .order("name", ascending: true)
            .execute()
            .value
        return rows
    }

    static func categories() async throws -> [ProductCategory] {
        let rows: [ProductCategory] = try await client
            .from("product_categories")
            .select("id, name, slug, sort_order, active")
            .order("sort_order", ascending: true)
            .execute()
            .value
        return rows.filter { $0.active != false }
    }

    static func myReservations(userId: UUID) async throws -> [ReservationRow] {
        try await reservations(eqUser: userId)
    }

    static func reservations(eqUser: UUID? = nil, limit: Int = 80) async throws -> [ReservationRow] {
        let select = """
        id, user_id, product_id, store_id, status, list_price_cents, amount_paid_cents, notes, expires_at, created_at, updated_at, \
        product:products(id, name, slug, brand, model, storage, color, image_url), \
        store:stores(id, name, slug, city)
        """
        if let eqUser {
            let rows: [ReservationRow] = try await client
                .from("reservations")
                .select(select)
                .eq("user_id", value: eqUser)
                .order("created_at", ascending: false)
                .limit(limit)
                .execute()
                .value
            return rows
        }
        let rows: [ReservationRow] = try await client
            .from("reservations")
            .select(select)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
        return rows
    }

    static func reservation(id: UUID) async throws -> ReservationRow? {
        let select = """
        id, user_id, product_id, store_id, status, list_price_cents, amount_paid_cents, notes, expires_at, created_at, updated_at, \
        product:products(id, name, slug, brand, model, storage, color, image_url), \
        store:stores(id, name, slug, city)
        """
        let rows: [ReservationRow] = try await client
            .from("reservations")
            .select(select)
            .eq("id", value: id)
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    static func createReservation(productId: UUID, storeId: UUID) async throws -> UUID {
        let id: UUID = try await client
            .rpc("create_reservation", params: RPC.CreateReservation(pProductId: productId, pStoreId: storeId))
            .execute()
            .value
        return id
    }

    static func cancelReservation(id: UUID) async throws {
        try await client.rpc("cancel_reservation", params: RPC.ReservationID(pReservationId: id)).execute()
    }

    static func switchReservation(id: UUID, productId: UUID) async throws -> UUID {
        let newId: UUID = try await client
            .rpc(
                "switch_reservation",
                params: RPC.SwitchReservation(pOldReservationId: id, pNewProductId: productId)
            )
            .execute()
            .value
        return newId
    }

    static func confirmRetirada(id: UUID) async throws {
        try await client.rpc("confirm_retirada", params: RPC.ReservationID(pReservationId: id)).execute()
    }

    static func contributions(reservationId: UUID) async throws -> [Contribution] {
        let rows: [Contribution] = try await client
            .from("contributions")
            .select("id, user_id, reservation_id, amount_cents, payment_method, status, pix_code, pix_qr_base64, gateway_payment_id, gateway_provider, confirmed_at, created_at")
            .eq("reservation_id", value: reservationId)
            .order("created_at", ascending: false)
            .execute()
            .value
        return rows
    }

    static func myContributions(userId: UUID) async throws -> [Contribution] {
        let rows: [Contribution] = try await client
            .from("contributions")
            .select("id, user_id, reservation_id, amount_cents, payment_method, status, pix_code, pix_qr_base64, gateway_payment_id, gateway_provider, confirmed_at, created_at")
            .eq("user_id", value: userId)
            .order("created_at", ascending: false)
            .limit(80)
            .execute()
            .value
        return rows
    }

    static func pendingContributions() async throws -> [Contribution] {
        let rows: [Contribution] = try await client
            .from("contributions")
            .select("id, user_id, reservation_id, amount_cents, payment_method, status, pix_code, pix_qr_base64, gateway_payment_id, gateway_provider, confirmed_at, created_at")
            .eq("status", value: "pending")
            .order("created_at", ascending: false)
            .limit(40)
            .execute()
            .value
        return rows
    }

    static func createContribution(reservationId: UUID, amountCents: Int) async throws -> UUID {
        let id: UUID = try await client
            .rpc(
                "create_contribution",
                params: RPC.CreateContribution(pReservationId: reservationId, pAmountCents: amountCents)
            )
            .execute()
            .value
        return id
    }

    static func adminConfirmContribution(id: UUID) async throws {
        try await client
            .rpc("admin_confirm_contribution", params: RPC.ContributionID(pContributionId: id))
            .execute()
    }

    static func acceptAporteContract(userId: UUID, reservationId: UUID) async throws -> UUID {
        struct Insert: Encodable {
            let userId: UUID
            let reservationId: UUID
            let contractVersion: String
            let contractText: String
            let scrolledToEnd: Bool
            let userAgent: String
            let acceptLanguage: String
            let fingerprint: [String: String]
        }
        let row = Insert(
            userId: userId,
            reservationId: reservationId,
            contractVersion: LegalCopy.aporteContractVersion,
            contractText: LegalCopy.aporteContract,
            scrolledToEnd: true,
            userAgent: "iPlanetPay-iOS",
            acceptLanguage: "pt-BR",
            fingerprint: [
                "platform": "ios",
                "bundle": AppConfig.bundleID,
            ]
        )
        let created: [IDRow] = try await client
            .from("aporte_contracts")
            .insert(row)
            .select("id")
            .execute()
            .value
        guard let id = created.first?.id else {
            throw RepoError("Não foi possível registrar o contrato do aporte.")
        }
        return id
    }

    static func linkContract(id: UUID, contributionId: UUID, userId: UUID) async throws {
        try await client
            .from("aporte_contracts")
            .update(["contribution_id": contributionId.uuidString])
            .eq("id", value: id)
            .eq("user_id", value: userId)
            .execute()
    }

    static func ledger(userId: UUID) async throws -> [WalletEntry] {
        let rows: [WalletEntry] = try await client
            .from("wallet_ledger")
            .select("id, user_id, reservation_id, contribution_id, entry_type, amount_cents, memo, created_at")
            .eq("user_id", value: userId)
            .order("created_at", ascending: false)
            .limit(80)
            .execute()
            .value
        return rows
    }

    static func goals(userId: UUID) async throws -> [PaymentGoal] {
        let rows: [PaymentGoal] = try await client
            .from("payment_goals")
            .select("id, user_id, product_id, reservation_id, name, target_date, reminder_day, amount_cents, installment_cents, installments_count, frequency, plan_start_date, status, whatsapp_phone, created_at")
            .eq("user_id", value: userId)
            .order("created_at", ascending: false)
            .execute()
            .value
        return rows
    }

    static func saveGoal(_ goal: GoalDraft) async throws {
        if let id = goal.existingId {
            try await client
                .from("payment_goals")
                .update(goal.updateRow)
                .eq("id", value: id)
                .eq("user_id", value: goal.userId)
                .execute()
        } else {
            try await client.from("payment_goals").insert(goal.insertRow).execute()
        }
    }

    static func setGoalStatus(id: UUID, userId: UUID, status: String) async throws {
        try await client
            .from("payment_goals")
            .update(["status": status])
            .eq("id", value: id)
            .eq("user_id", value: userId)
            .execute()
    }

    static func referrals(userId: UUID) async throws -> [ReferralRow] {
        let rows: [ReferralRow] = try await client
            .from("referrals")
            .select("id, referrer_id, referred_id, status, bonus_amount_cents, bonus_credited, created_at")
            .eq("referrer_id", value: userId)
            .order("created_at", ascending: false)
            .execute()
            .value
        return rows
    }

    static func profiles(ids: [UUID]) async throws -> [Profile] {
        guard !ids.isEmpty else { return [] }
        let rows: [Profile] = try await client
            .from("profiles")
            .select("id, full_name, phone, role, store_id, avatar_url, pix_key, pix_key_type, referral_code, referred_by, referral_bonus_balance_cents, cpf, city, state, address, address_number, birth_date, created_at, terms_accepted_at, terms_version")
            .in("id", values: ids.map { $0 as any PostgrestFilterValue })
            .execute()
            .value
        return rows
    }

    static func clients(search: String) async throws -> [Profile] {
        let columns = "id, full_name, phone, role, store_id, avatar_url, pix_key, pix_key_type, referral_code, referred_by, referral_bonus_balance_cents, cpf, city, state, address, address_number, birth_date, created_at, terms_accepted_at, terms_version"
        let query = search.trimmingCharacters(in: .whitespacesAndNewlines)
        if query.isEmpty {
            let rows: [Profile] = try await client
                .from("profiles")
                .select(columns)
                .order("created_at", ascending: false)
                .limit(80)
                .execute()
                .value
            return rows
        }
        let rows: [Profile] = try await client
            .from("profiles")
            .select(columns)
            .ilike("full_name", pattern: "%\(query)%")
            .order("created_at", ascending: false)
            .limit(80)
            .execute()
            .value
        return rows
    }

    static func applyReferral(code: String) async throws {
        try await client.rpc("apply_referral_code", params: RPC.ReferralCode(pCode: code)).execute()
    }

    static func applyBonus(reservationId: UUID) async throws {
        try await client
            .rpc("apply_referral_bonus_to_reservation", params: RPC.ReservationID(pReservationId: reservationId))
            .execute()
    }

    static func notices() async throws -> [Notice] {
        let rows: [Notice] = try await client
            .from("platform_notices")
            .select("id, kind, title, body, coupon_code, created_at")
            .order("created_at", ascending: false)
            .limit(50)
            .execute()
            .value
        return rows
    }

    static func noticeReads(userId: UUID) async throws -> Set<UUID> {
        let rows: [NoticeRead] = try await client
            .from("platform_notice_reads")
            .select("notice_id, user_id")
            .eq("user_id", value: userId)
            .execute()
            .value
        return Set(rows.map(\.noticeId))
    }

    static func markNoticeRead(noticeId: UUID, userId: UUID) async throws {
        let row: [String: String] = [
            "notice_id": noticeId.uuidString,
            "user_id": userId.uuidString,
        ]
        try await client.from("platform_notice_reads").insert(row).execute()
    }

    static func publishNotice(kind: String, title: String, body: String, coupon: String?, author: UUID) async throws {
        var row: [String: String] = [
            "kind": kind,
            "title": title,
            "body": body,
            "created_by": author.uuidString,
        ]
        if let coupon, !coupon.isEmpty {
            row["coupon_code"] = coupon
        }
        try await client.from("platform_notices").insert(row).execute()
    }

    static func withdrawals(userId: UUID) async throws -> [WithdrawalRequest] {
        let rows: [WithdrawalRequest] = try await client
            .from("withdrawal_requests")
            .select("id, user_id, reservation_id, total_paid_cents, fee_amount_cents, refund_amount_cents, pix_key, pix_key_type, holder_full_name, status, payout_status, created_at")
            .eq("user_id", value: userId)
            .order("created_at", ascending: false)
            .execute()
            .value
        return rows
    }

    static func requestWithdrawal(_ params: RPC.Withdrawal) async throws {
        try await client.rpc("request_withdrawal", params: params).execute()
    }

    static func offers(reservationId: UUID) async throws -> [UsedDeviceOffer] {
        let rows: [UsedDeviceOffer] = try await client
            .from("used_device_offers")
            .select("id, reservation_id, device_model, imei, expected_value_cents, minimum_value_cents, status, admin_message, approved_value_cents, battery_health_pct, created_at")
            .eq("reservation_id", value: reservationId)
            .order("created_at", ascending: false)
            .execute()
            .value
        return rows
    }

    static func submitTradeIn(_ params: RPC.TradeIn) async throws {
        try await client.rpc("create_used_device_offers", params: params).execute()
    }

    static func uploadPhoto(bucket: String, path: String, data: Data) async throws {
        try await client.storage
            .from(bucket)
            .upload(
                path,
                data: data,
                options: FileOptions(contentType: "image/jpeg", upsert: true)
            )
    }

    static func publicURL(bucket: String, path: String) throws -> URL {
        try client.storage.from(bucket).getPublicURL(path: path)
    }

    static func pickups(reservationId: UUID) async throws -> [PickupRequest] {
        let rows: [PickupRequest] = try await client
            .from("pickup_requests")
            .select("id, reservation_id, mode, status, shipping_method, freight_cents, tracking_code, created_at")
            .eq("reservation_id", value: reservationId)
            .order("created_at", ascending: false)
            .execute()
            .value
        return rows
    }

    static func raffleDraws() async throws -> [RaffleDraw] {
        let rows: [RaffleDraw] = try await client
            .from("monthly_raffle_draws")
            .select("id, draw_month, winner_name, winner_tickets, total_tickets_pool, drawn_at")
            .order("drawn_at", ascending: false)
            .limit(6)
            .execute()
            .value
        return rows
    }

    static func closings() async throws -> [FinancialClosing] {
        let rows: [FinancialClosing] = try await client
            .from("financial_closings")
            .select("id, period_start, period_end, total_revenue_cents, total_contributions_count, total_withdrawals_cents, net_cents, notes, created_at")
            .order("created_at", ascending: false)
            .limit(12)
            .execute()
            .value
        return rows
    }

    static func setRole(userId: UUID, role: String) async throws {
        try await client
            .rpc("admin_set_user_role", params: RPC.RoleChange(pUserId: userId, pRole: role))
            .execute()
    }
}

struct GoalDraft: Sendable {
    var existingId: UUID?
    var userId: UUID
    var productId: UUID
    var reservationId: UUID?
    var name: String
    var targetDate: String
    var reminderDay: Int?
    var amountCents: Int
    var installmentCents: Int
    var installmentsCount: Int
    var frequency: String
    var planStartDate: String
    var whatsappPhone: String?

    fileprivate struct Row: Encodable, Sendable {
        var userId: UUID?
        var productId: UUID
        var reservationId: UUID?
        var name: String
        var targetDate: String
        var reminderDay: Int?
        var amountCents: Int
        var installmentCents: Int
        var installmentsCount: Int
        var frequency: String
        var planStartDate: String
        var status: String
        var whatsappPhone: String?
    }

    fileprivate var updateRow: Row {
        Row(
            userId: nil,
            productId: productId,
            reservationId: reservationId,
            name: name,
            targetDate: targetDate,
            reminderDay: reminderDay,
            amountCents: amountCents,
            installmentCents: installmentCents,
            installmentsCount: installmentsCount,
            frequency: frequency,
            planStartDate: planStartDate,
            status: "active",
            whatsappPhone: whatsappPhone
        )
    }

    fileprivate var insertRow: Row {
        var row = updateRow
        row.userId = userId
        return row
    }
}

struct RepoError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

enum RaffleMath {
    static let fichaCents = 10_000
    static let minPercent = 30

    struct Balance: Hashable, Sendable {
        var contributedCents: Int
        var eligibleCents: Int
        var tickets: Int
        var eligible: Bool
    }

    static func balance(contributions: [Contribution], reservations: [ReservationRow]) -> Balance {
        let prices = Dictionary(uniqueKeysWithValues: reservations.map { ($0.id, $0.listPriceCents) })
        var byReservation: [UUID: Int] = [:]
        for contribution in contributions where contribution.status == "confirmed" {
            byReservation[contribution.reservationId, default: 0] += contribution.amountCents
        }
        var contributed = 0
        var eligibleCents = 0
        for (id, cents) in byReservation {
            contributed += cents
            let price = prices[id] ?? 0
            if price > 0 && cents * 100 >= price * minPercent {
                eligibleCents += cents
            }
        }
        return Balance(
            contributedCents: contributed,
            eligibleCents: eligibleCents,
            tickets: eligibleCents / fichaCents,
            eligible: eligibleCents > 0
        )
    }
}
