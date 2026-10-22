import IPlanetCore
import Foundation
import Supabase

protocol APIReply {
    var ok: Bool { get }
    var error: String? { get }
}

enum WebAPI {
    struct Failure: LocalizedError, Sendable {
        var message: String
        var errorDescription: String? { message }
    }

    struct AuthResponse: Decodable, Sendable, APIReply {
        var ok: Bool
        var error: String?
        var accessToken: String?
        var refreshToken: String?
        var needsEmailConfirmation: Bool?
        var message: String?
        var warning: String?
    }

    struct StatusResponse: Decodable, Sendable, APIReply {
        var ok: Bool
        var error: String?
        var id: UUID?
        var goalId: UUID?
        var reservationId: UUID?
        var contractId: UUID?
        var contributionId: UUID?
        var message: String?
    }

    struct PixCode: Decodable, Sendable {
        var copyPaste: String?
        var qrBase64: String?
        var chargeId: String?
        var provider: String?
    }

    struct PixResponse: Decodable, Sendable, APIReply {
        var ok: Bool
        var error: String?
        var contributionId: UUID?
        var amountCents: Int?
        var gatewayConfigured: Bool?
        var pix: PixCode?
    }

    struct LoginBody: Encodable, Sendable {
        var email: String
        var password: String
        var client: String
    }

    struct SignupBody: Encodable, Sendable {
        var fullName: String
        var email: String
        var password: String
        var phone: String
        var cpf: String
        var city: String
        var state: String
        var address: String
        var addressNumber: String
        var birthDate: String
        var termsAccepted: Bool
        var termsVersion: String
        var referralCode: String?
        var client: String
    }

    struct IdentityBody: Encodable, Sendable {
        var phone: String
        var cpf: String
        var city: String
        var state: String
        var address: String
        var addressNumber: String
        var birthDate: String
    }

    struct ProfilePatch: Encodable, Sendable {
        var fullName: String?
        var phone: String?
        var pixKey: String?
        var pixKeyType: String?
    }

    struct PasswordBody: Encodable, Sendable {
        var password: String
    }

    struct ReservationBody: Encodable, Sendable {
        var productId: UUID
        var storeId: UUID
        var variantId: UUID?
    }

    struct ReservationIDBody: Encodable, Sendable {
        var reservationId: UUID
    }

    struct ProductBody: Encodable, Sendable {
        var productId: UUID
    }

    struct PixBody: Encodable, Sendable {
        var reservationId: UUID
        var amountCents: Int
        var contractId: UUID?
    }

    struct ContractFingerprint: Encodable, Sendable {
        var platform: String
        var bundle: String
    }

    struct ContractBody: Encodable, Sendable {
        var reservationId: UUID
        var scrolledToEnd: Bool
        var contractVersion: String
        var fingerprint: ContractFingerprint
    }

    struct GoalBody: Encodable, Sendable {
        var name: String
        var productId: UUID
        var startDate: String
        var targetDate: String
        var frequency: String
        var reservationId: UUID?
    }

    struct WithdrawalBody: Encodable, Sendable {
        var reservationId: UUID
        var pixKey: String
        var pixKeyType: String
        var holderFullName: String
        var holderCpf: String
    }

    struct WalletWithdrawBody: Encodable, Sendable {
        var amountCents: Int
        var pixKey: String
        var pixKeyType: String
        var holderFullName: String
        var holderCpf: String
    }

    struct CodeBody: Encodable, Sendable {
        var code: String
    }

    struct NoticeBody: Encodable, Sendable {
        var noticeId: UUID
    }

    struct PickupAddress: Encodable, Sendable {
        var street: String
        var number: String
        var city: String
        var state: String
        var zip: String
    }

    struct PickupBody: Encodable, Sendable {
        var mode: String
        var shippingMethod: String?
        var address: PickupAddress?
        var freightCents: Int?
        var insuranceCents: Int?
        var loanContractSigned: Bool
    }

    struct TradeInRespondBody: Encodable, Sendable {
        var offerId: UUID
        var action: String
        var expectedCents: Int?
    }

    struct TradeInDevice: Sendable {
        var deviceModel: String
        var imei: String
        var expectedBrl: String
        var minimumBrl: String
        var maintenanceOptions: [String]
        var liquidExposure: Bool
        var batteryHealthPct: String
        var batteryHealthReason: String?
        var photos: [Data]
    }

    static func login(email: String, password: String) async throws -> AuthResponse {
        try await post(
            path: "/api/auth/login",
            body: LoginBody(email: email, password: password, client: "native"),
            authorize: false
        )
    }

    static func signup(_ body: SignupBody) async throws -> AuthResponse {
        try await post(path: "/api/auth/signup", body: body, authorize: false)
    }

    static func logout() async throws {
        let _: StatusResponse = try await post(path: "/api/auth/logout", body: EmptyBody(), authorize: true)
    }

    static func updatePassword(_ password: String) async throws {
        let _: StatusResponse = try await post(
            path: "/api/profile/password",
            body: PasswordBody(password: password),
            authorize: true
        )
    }

    static func saveIdentity(_ body: IdentityBody) async throws {
        let _: StatusResponse = try await post(path: "/api/profile/identity", body: body, authorize: true)
    }

    static func patchProfile(_ body: ProfilePatch) async throws {
        let _: StatusResponse = try await send(method: "PATCH", path: "/api/profile", body: body, authorize: true)
    }

    static func createReservation(productId: UUID, storeId: UUID, variantId: UUID? = nil) async throws -> UUID {
        let response: StatusResponse = try await post(
            path: "/api/reservations",
            body: ReservationBody(productId: productId, storeId: storeId, variantId: variantId),
            authorize: true
        )
        guard let id = response.id else { throw Failure(message: "A reserva não foi criada.") }
        return id
    }

    static func cancelReservation(id: UUID) async throws {
        let _: StatusResponse = try await post(
            path: "/api/reservations/cancel",
            body: ReservationIDBody(reservationId: id),
            authorize: true
        )
    }

    static func switchReservation(id: UUID, productId: UUID) async throws -> UUID {
        let response: StatusResponse = try await post(
            path: "/api/reservations/\(id.uuidString)/switch",
            body: ProductBody(productId: productId),
            authorize: true
        )
        guard let newId = response.id else { throw Failure(message: "A troca não foi concluída.") }
        return newId
    }

    static func acceptContract(reservationId: UUID) async throws -> UUID {
        let response: StatusResponse = try await post(
            path: "/api/aportes/contract",
            body: ContractBody(
                reservationId: reservationId,
                scrolledToEnd: true,
                contractVersion: LegalCopy.aporteContractVersion,
                fingerprint: ContractFingerprint(platform: "ios", bundle: AppConfig.bundleID)
            ),
            authorize: true
        )
        guard let id = response.contractId ?? response.id else {
            throw Failure(message: "Não foi possível registrar o contrato do aporte.")
        }
        return id
    }

    static func generatePix(reservationId: UUID, amountCents: Int, contractId: UUID?) async throws -> PixResponse {
        try await post(
            path: "/api/pix/generate",
            body: PixBody(reservationId: reservationId, amountCents: amountCents, contractId: contractId),
            authorize: true
        )
    }

    static func confirmRetirada(id: UUID) async throws {
        let _: StatusResponse = try await post(
            path: "/api/reservations/\(id.uuidString)/retirada",
            body: EmptyBody(),
            authorize: true
        )
    }

    static func requestPickup(reservationId: UUID, body: PickupBody) async throws {
        let _: StatusResponse = try await post(
            path: "/api/reservations/\(reservationId.uuidString)/pickup",
            body: body,
            authorize: true
        )
    }

    struct SavedGoal: Sendable {
        var goalId: UUID
        var reservationId: UUID?
    }

    static func saveGoal(_ body: GoalBody) async throws -> SavedGoal {
        let response: StatusResponse = try await post(path: "/api/goals", body: body, authorize: true)
        guard let id = response.goalId else { throw Failure(message: "A meta não foi criada.") }
        return SavedGoal(goalId: id, reservationId: response.reservationId)
    }

    static func requestWithdrawal(_ body: WithdrawalBody) async throws {
        let _: StatusResponse = try await post(path: "/api/withdrawals/request", body: body, authorize: true)
    }

    struct PreviewResponse: Decodable, Sendable, APIReply {
        var ok: Bool
        var error: String?
        var split: WithdrawalBreakdown?
    }

    static func withdrawalPreview(reservationId: UUID) async throws -> WithdrawalBreakdown {
        let id = reservationId.uuidString.lowercased()
        let reply: PreviewResponse = try await sendRaw(method: "GET", path: "/api/withdrawals/preview?reservation_id=\(id)", body: nil, contentType: "application/json", authorize: true)
        guard let split = reply.split else { throw Failure(message: "Não foi possível calcular o saque.") }
        return split
    }

    struct BonusWithdrawBody: Encodable, Sendable {
        var pixKey: String
        var pixKeyType: String
        var holderFullName: String
        var holderCpf: String
    }

    struct RequestIDResponse: Decodable, Sendable, APIReply {
        var ok: Bool
        var error: String?
        var requestId: UUID?
    }

    /// `POST /api/referrals/withdraw-bonus` → RPC `request_bonus_withdrawal` (sem taxa, aprovação do admin).
    static func withdrawBonus(_ body: BonusWithdrawBody) async throws -> UUID? {
        let reply: RequestIDResponse = try await post(path: "/api/referrals/withdraw-bonus", body: body, authorize: true)
        return reply.requestId
    }

    @discardableResult
    static func requestWithdrawalReturningID(_ body: WithdrawalBody) async throws -> UUID? {
        let reply: RequestIDResponse = try await post(path: "/api/withdrawals/request", body: body, authorize: true)
        return reply.requestId
    }

    static func withdrawWallet(_ body: WalletWithdrawBody) async throws {
        let _: StatusResponse = try await post(path: "/api/wallet/withdraw", body: body, authorize: true)
    }

    static func applyWallet(reservationId: UUID, amountCents: Int) async throws {
        struct Body: Encodable {
            var reservationId: UUID
            var amountCents: Int
        }
        let _: StatusResponse = try await post(
            path: "/api/wallet/apply",
            body: Body(reservationId: reservationId, amountCents: amountCents),
            authorize: true
        )
    }

    static func applyReferral(code: String) async throws {
        let _: StatusResponse = try await post(path: "/api/referrals/apply", body: CodeBody(code: code), authorize: true)
    }

    static func applyBonus(reservationId: UUID) async throws {
        let _: StatusResponse = try await post(
            path: "/api/referrals/apply-bonus",
            body: ReservationIDBody(reservationId: reservationId),
            authorize: true
        )
    }

    static func markNoticeRead(id: UUID) async throws {
        let _: StatusResponse = try await post(path: "/api/notices/read", body: NoticeBody(noticeId: id), authorize: true)
    }

    static func respondTradeIn(offerId: UUID, action: String, expectedCents: Int? = nil) async throws {
        let _: StatusResponse = try await post(
            path: "/api/trade-in/respond",
            body: TradeInRespondBody(offerId: offerId, action: action, expectedCents: expectedCents),
            authorize: true
        )
    }

    static func submitTradeIn(reservationId: UUID, devices: [TradeInDevice]) async throws {
        let boundary = "Boundary-\(UUID().uuidString)"
        var payload: [[String: Any]] = []
        for device in devices {
            var item: [String: Any] = [
                "deviceModel": device.deviceModel,
                "imei": device.imei,
                "expectedBrl": device.expectedBrl,
                "minimumBrl": device.minimumBrl,
                "maintenanceOptions": device.maintenanceOptions,
                "liquidExposure": device.liquidExposure,
                "batteryHealthPct": device.batteryHealthPct,
            ]
            if let reason = device.batteryHealthReason {
                item["batteryHealthReason"] = reason
            }
            payload.append(item)
        }
        let devicesData = try JSONSerialization.data(withJSONObject: payload)
        let devicesJSON = String(data: devicesData, encoding: .utf8) ?? "[]"
        var body = Data()
        func append(_ text: String) {
            body.append(Data(text.utf8))
        }
        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"reservation_id\"\r\n\r\n")
        append("\(reservationId.uuidString)\r\n")
        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"devices\"\r\n\r\n")
        append("\(devicesJSON)\r\n")
        for (index, device) in devices.enumerated() {
            for (photoIndex, photo) in device.photos.enumerated() {
                append("--\(boundary)\r\n")
                append("Content-Disposition: form-data; name=\"photos_\(index)\"; filename=\"\(photoIndex).jpg\"\r\n")
                append("Content-Type: image/jpeg\r\n\r\n")
                body.append(photo)
                append("\r\n")
            }
        }
        append("--\(boundary)--\r\n")
        let _: StatusResponse = try await sendRaw(
            method: "POST",
            path: "/api/trade-in/submit",
            body: body,
            contentType: "multipart/form-data; boundary=\(boundary)",
            authorize: true
        )
    }

    static func adopt(_ response: AuthResponse) async throws {
        guard response.ok else {
            throw Failure(message: response.error ?? "Não foi possível entrar.")
        }
        guard let access = response.accessToken, let refresh = response.refreshToken, !access.isEmpty, !refresh.isEmpty else {
            return
        }
        _ = try await SupabaseService.client.auth.setSession(accessToken: access, refreshToken: refresh)
    }

    enum SimulationResult: Sendable { case ok, disabled }

    /// Teste: pede ao servidor que simule o pagamento do Pix
    /// (`POST /api/dev/simulate-payment`, protegido por flag de ambiente e checagem admin/teste no web).
    /// O app nunca grava pagamento direto; 403/404 = simulação desativada neste servidor.
    static func simulatePayment(contributionId: UUID) async throws -> SimulationResult {
        struct Body: Encodable { var contributionId: UUID }
        var request = URLRequest(url: AppConfig.web("/api/dev/simulate-payment"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let session = try await SupabaseService.client.auth.session
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try AppCoding.encoder.encode(Body(contributionId: contributionId))
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 403 || status == 404 { return .disabled }
        let reply = try? AppCoding.decoder.decode(StatusResponse.self, from: data)
        guard (200..<300).contains(status), reply?.ok != false else {
            throw Failure(message: reply?.error ?? "Não foi possível simular o pagamento (HTTP \(status)).")
        }
        return .ok
    }

    /// `GET /api/dev/simulate-payment/status` → `{enabled: true}` só quando o servidor tem
    /// ALLOW_PAYMENT_SIMULATION ligado (o guard real). 403/404 ou erro = desativado.
    static func paymentSimulationEnabled() async -> Bool {
        struct Reply: Decodable { var enabled: Bool? }
        var request = URLRequest(url: AppConfig.web("/api/dev/simulate-payment/status"))
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let session = try? await SupabaseService.client.auth.session {
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        }
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let reply = try? AppCoding.decoder.decode(Reply.self, from: data) else { return false }
        return reply.enabled == true
    }

    private struct EmptyBody: Encodable, Sendable {}

    private static func post<Body: Encodable, Response: Decodable & APIReply>(
        path: String,
        body: Body,
        authorize: Bool
    ) async throws -> Response {
        try await send(method: "POST", path: path, body: body, authorize: authorize)
    }

    private static func send<Body: Encodable, Response: Decodable & APIReply>(
        method: String,
        path: String,
        body: Body,
        authorize: Bool
    ) async throws -> Response {
        let data = try AppCoding.encoder.encode(body)
        return try await sendRaw(
            method: method,
            path: path,
            body: data,
            contentType: "application/json",
            authorize: authorize
        )
    }

    private static func sendRaw<Response: Decodable & APIReply>(
        method: String,
        path: String,
        body: Data?,
        contentType: String,
        authorize: Bool
    ) async throws -> Response {
        var request = URLRequest(url: AppConfig.web(path))
        request.httpMethod = method
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if authorize {
            let session = try await SupabaseService.client.auth.session
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = body
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard let decoded = try? AppCoding.decoder.decode(Response.self, from: data) else {
            throw Failure(message: "Resposta inválida do servidor (HTTP \(status)).")
        }
        if !decoded.ok {
            throw Failure(message: decoded.error ?? "Não foi possível concluir agora.")
        }
        return decoded
    }
}
