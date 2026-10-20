import AuthenticationServices
import GoogleSignIn
import Supabase
import SwiftUI
import UIKit

struct AuthView: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppRouter.self) private var router
    @State private var mode: Mode = .login
    @State private var email = ""
    @State private var password = ""
    @State private var fullName = ""
    @State private var phone = ""
    @State private var cpf = ""
    @State private var city = ""
    @State private var state = "SP"
    @State private var address = ""
    @State private var addressNumber = ""
    @State private var birthDate = Date(timeIntervalSince1970: 631_152_000)
    @State private var referralCode = ""
    @State private var acceptTerms = false
    @State private var acceptWithdrawal = false
    @State private var acceptRaffle = false
    @State private var message: String?
    @State private var noticeTone: NoticeTone = .error
    @State private var busy = false
    @State private var showTerms = false
    @State private var appleRawNonce = ""
    @Environment(\.colorScheme) private var colorScheme

    private enum Mode: String, CaseIterable, Identifiable {
        case login = "Entrar"
        case signup = "Criar conta"
        var id: String { rawValue }
    }

    private enum NoticeTone {
        case error
        case info
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Wordmark(height: 34)
                        .frame(maxWidth: .infinity)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Acesso")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Brand.accent)
                        Text(mode == .login ? "Entrar" : "Criar conta")
                            .font(.largeTitle.weight(.bold))
                        Text("Continue sua reserva ou gerencie a loja.")
                            .font(.body)
                            .foregroundStyle(Brand.inkMuted)
                    }
                    Picker("Modo", selection: $mode) {
                        ForEach(Mode.allCases) { item in
                            Text(item.rawValue).tag(item)
                        }
                    }
                    .pickerStyle(.segmented)
                    if let text = message ?? router.authMessage {
                        Text(text)
                            .font(.callout)
                            .foregroundStyle(message != nil && noticeTone == .info ? Brand.success : Brand.danger)
                    }
                    if mode == .signup {
                        signupFields
                    }
                    TextField("E-mail", text: $email)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(14)
                        .background(Brand.background)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    SecureField("Senha", text: $password)
                        .textContentType(mode == .login ? .password : .newPassword)
                        .padding(14)
                        .background(Brand.background)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    Button(busy ? "Aguarde…" : (mode == .login ? "Entrar" : "Criar conta")) {
                        Task { await submit() }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(busy)
                    Button(mode == .login ? "Entrar com Google" : "Continuar com Google") {
                        Task { await google() }
                    }
                    .buttonStyle(SecondaryButtonStyle())
                    .disabled(busy)
                    SignInWithAppleButton(.continue) { request in
                        let raw = AppleNonce.make()
                        appleRawNonce = raw
                        request.requestedScopes = [.fullName, .email]
                        request.nonce = AppleNonce.sha256(raw)
                    } onCompletion: { result in
                        Task { await finishApple(result) }
                    }
                    .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .disabled(busy)
                    if mode == .login {
                        Button("Enviar magic link") {
                            Task { await magicLink() }
                        }
                        .buttonStyle(SecondaryButtonStyle())
                        .disabled(busy)
                        Button("Esqueci minha senha") {
                            Task { await reset() }
                        }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Brand.accent)
                        .frame(minHeight: 44)
                    }
                }
                .padding(20)
            }
            .background(Brand.backgroundSubtle)
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showTerms) {
                NavigationStack {
                    ScrollView {
                        Text(LegalCopy.terms)
                            .font(.body)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(20)
                    }
                    .navigationTitle("Termos")
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Fechar") { showTerms = false }
                        }
                    }
                }
            }
        }
    }

    private var signupFields: some View {
        VStack(alignment: .leading, spacing: 12) {
            field("Nome completo", text: $fullName)
            field("Telefone com DDD", text: $phone)
            field("CPF", text: $cpf)
            field("Cidade", text: $city)
            Picker("Estado", selection: $state) {
                ForEach(BrazilID.states, id: \.self) { Text($0).tag($0) }
            }
            field("Endereço", text: $address)
            field("Número", text: $addressNumber)
            DatePicker("Nascimento", selection: $birthDate, displayedComponents: .date)
            field("Código de indicação (opcional)", text: $referralCode)
            Toggle("Li os termos de uso", isOn: $acceptTerms)
            Toggle("Aceito a política de saque", isOn: $acceptWithdrawal)
            Toggle("Aceito retirada, indicação e sorteio", isOn: $acceptRaffle)
            Button("Ler termos") { showTerms = true }
                .font(.subheadline.weight(.semibold))
        }
    }

    private func field(_ title: String, text: Binding<String>) -> some View {
        TextField(title, text: text)
            .padding(14)
            .background(Brand.background)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func submit() async {
        message = nil
        busy = true
        defer { busy = false }
        let cleaned = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard cleaned.contains("@"), password.count >= 6 else {
            show("Informe e-mail e senha com pelo menos 6 caracteres.")
            return
        }
        do {
            if mode == .login {
                let response = try await WebAPI.login(email: cleaned, password: password)
                try await WebAPI.adopt(response)
                if let warning = response.warning, !warning.isEmpty {
                    show(warning, tone: .info)
                }
            } else {
                try await signUp(email: cleaned)
            }
        } catch {
            show(describeError(error))
        }
    }

    private func magicLink() async {
        message = nil
        let cleaned = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard cleaned.contains("@") else {
            show("Informe o e-mail para enviar o link mágico.")
            return
        }
        busy = true
        defer { busy = false }
        do {
            try await SupabaseService.client.auth.signInWithOTP(
                email: cleaned,
                redirectTo: AppConfig.authRedirectURL,
                shouldCreateUser: true
            )
            show("Link mágico enviado. Verifique seu e-mail.", tone: .info)
        } catch {
            show(describeError(error))
        }
    }

    private func signUp(email: String) async throws {
        guard acceptTerms, acceptWithdrawal, acceptRaffle else {
            show("Marque todos os aceites dos Termos de Uso para criar a conta.")
            return
        }
        let phoneValue = BrazilPhone.normalize(phone)
        let missing = identityMessage(
            cpf: cpf,
            phone: phoneValue,
            city: city,
            state: state,
            address: address,
            number: addressNumber,
            birth: CivilDay.string(from: birthDate)
        )
        if let missing {
            show(missing)
            return
        }
        let acceptedAt = ISO8601DateFormatter().string(from: Date())
        let pending = PendingEmailSignup(
            email: email,
            fullName: fullName.trimmingCharacters(in: .whitespacesAndNewlines),
            phone: phoneValue ?? "",
            cpf: BrazilID.normalizeCPF(cpf) ?? "",
            city: city.trimmingCharacters(in: .whitespacesAndNewlines),
            state: state,
            address: address.trimmingCharacters(in: .whitespacesAndNewlines),
            addressNumber: addressNumber.trimmingCharacters(in: .whitespacesAndNewlines),
            birthDate: CivilDay.string(from: birthDate),
            referralCode: referralCode.trimmingCharacters(in: .whitespacesAndNewlines),
            termsAcceptedAt: acceptedAt,
            termsVersion: LegalCopy.termsVersion
        )
        let response = try await WebAPI.signup(
            WebAPI.SignupBody(
                fullName: pending.fullName,
                email: email,
                password: password,
                phone: pending.phone,
                cpf: pending.cpf,
                city: pending.city,
                state: pending.state,
                address: pending.address,
                addressNumber: pending.addressNumber,
                birthDate: pending.birthDate,
                termsAccepted: true,
                termsVersion: pending.termsVersion,
                referralCode: pending.referralCode.isEmpty ? nil : pending.referralCode,
                client: "native"
            )
        )
        guard response.accessToken != nil, response.refreshToken != nil else {
            PendingEmailSignupStore.save(pending)
            show(
                "Conta criada. Enviamos um e-mail de confirmação. Abra o link nesse e-mail para entrar — ele abre o app em iplanetpay://auth-callback. CPF, endereço e termos ficam salvos neste aparelho e entram no perfil quando você confirmar.",
                tone: .info
            )
            mode = .login
            return
        }
        try await WebAPI.adopt(response)
        PendingEmailSignupStore.clear()
        await session.refreshProfile()
    }

    private func google() async {
        busy = true
        defer { busy = false }
        do {
            if let clientID = AppConfig.googleIOSClientID {
                try await googleNative(clientID: clientID)
            } else {
                try await SupabaseService.client.auth.signInWithOAuth(
                    provider: .google,
                    redirectTo: AppConfig.authRedirectURL,
                    scopes: "openid email profile",
                    queryParams: [(name: "prompt", value: "consent select_account")]
                )
            }
        } catch {
            if isCancellation(error) { return }
            show(describeError(error))
        }
    }

    private func googleNative(clientID: String) async throws {
        guard let presenter = topViewController() else {
            show("Não foi possível abrir o login do Google.")
            return
        }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            GIDSignIn.sharedInstance.configure { _ in
                continuation.resume()
            }
        }
        let rawNonce = AppleNonce.make()
        let result = try await GIDSignIn.sharedInstance.signIn(
            withPresenting: presenter,
            hint: nil,
            additionalScopes: nil,
            nonce: AppleNonce.sha256(rawNonce)
        )
        guard let idToken = result.user.idToken?.tokenString else {
            show("O Google não devolveu um token de identidade.")
            return
        }
        session.pendingProviderName = result.user.profile?.name ?? ""
        _ = try await SupabaseService.client.auth.signInWithIdToken(
            credentials: OpenIDConnectCredentials(
                provider: .google,
                idToken: idToken,
                accessToken: result.user.accessToken.tokenString,
                nonce: rawNonce
            )
        )
    }

    private func finishApple(_ result: Result<ASAuthorization, Error>) async {
        busy = true
        defer { busy = false }
        switch result {
        case .failure(let error):
            if isCancellation(error) { return }
            show(appleSignInMessage(error))
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let idToken = String(data: tokenData, encoding: .utf8) else {
                show("A Apple não devolveu um token de identidade.")
                return
            }
            let rawNonce = appleRawNonce
            guard !rawNonce.isEmpty else {
                show("Não foi possível validar o login com a Apple. Tente de novo.")
                return
            }
            session.pendingProviderName = appleDisplayName(credential.fullName)
            do {
                _ = try await SupabaseService.client.auth.signInWithIdToken(
                    credentials: OpenIDConnectCredentials(
                        provider: .apple,
                        idToken: idToken,
                        nonce: rawNonce
                    )
                )
            } catch {
                if isCancellation(error) { return }
                show(appleSignInMessage(error))
            }
        }
    }

    private func appleDisplayName(_ name: PersonNameComponents?) -> String {
        guard let name else { return "" }
        return PersonNameComponentsFormatter().string(from: name)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let window = scenes.flatMap(\.windows).first { $0.isKeyWindow } ?? scenes.first?.windows.first
        var controller = window?.rootViewController
        while let presented = controller?.presentedViewController {
            controller = presented
        }
        return controller
    }

    private func reset() async {
        let cleaned = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard cleaned.contains("@") else {
            show("Informe o e-mail para recuperar a senha.")
            return
        }
        do {
            try await SupabaseService.client.auth.resetPasswordForEmail(
                cleaned,
                redirectTo: AppConfig.authRedirectURL
            )
            show(
                "Enviamos o link de recuperação. Ele abre o app em iplanetpay://auth-callback.",
                tone: .info
            )
        } catch {
            show(describeError(error))
        }
    }

    private func show(_ text: String, tone: NoticeTone = .error) {
        message = text
        noticeTone = tone
    }
}

private func appleSignInMessage(_ error: Error) -> String {
    let described = describeError(error)
    let blob = (described + "\n" + String(describing: error)).lowercased()
    let providerDisabled = blob.contains("not enabled")
        || blob.contains("provider is disabled")
        || blob.contains("unsupported provider")
        || blob.contains("appleid.apple.com")
    if providerDisabled {
        return "O login com a Apple ainda não está disponível. Use e-mail ou Google por enquanto. Quando a conta Apple Developer estiver pronta, ative o provedor Apple no Supabase e tente de novo."
    }
    return described
}

private func isCancellation(_ error: Error) -> Bool {
    if let auth = error as? ASAuthorizationError, auth.code == .canceled { return true }
    let nsError = error as NSError
    if nsError.domain == kGIDSignInErrorDomain, nsError.code == GIDSignInError.canceled.rawValue {
        return true
    }
    if nsError.domain == ASWebAuthenticationSessionError.errorDomain,
       nsError.code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
        return true
    }
    return nsError.localizedDescription.localizedCaseInsensitiveContains("cancel")
}

func identityMessage(
    cpf: String?,
    phone: String?,
    city: String,
    state: String,
    address: String,
    number: String,
    birth: String
) -> String? {
    if BrazilID.normalizeCPF(cpf) == nil { return "Informe um CPF válido com 11 dígitos." }
    let digits = phone?.filter(\.isNumber) ?? ""
    if digits.count < 10 || digits.count > 13 { return "Informe um telefone válido com DDD." }
    if city.trimmingCharacters(in: .whitespaces).isEmpty { return "Informe a cidade." }
    if !BrazilID.states.contains(state.uppercased()) { return "Informe o estado (UF)." }
    if address.trimmingCharacters(in: .whitespaces).isEmpty { return "Informe o endereço." }
    if number.trimmingCharacters(in: .whitespaces).isEmpty { return "Informe o número." }
    if !BrazilID.validBirthDate(birth) { return "Informe uma data de nascimento válida." }
    return nil
}
