import AuthenticationServices
import Supabase
import SwiftUI

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
    @State private var busy = false
    @State private var showTerms = false

    private enum Mode: String, CaseIterable, Identifiable {
        case login = "Entrar"
        case signup = "Criar conta"
        var id: String { rawValue }
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
                            .foregroundStyle(Brand.danger)
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
                    Button("Continuar com Google") {
                        Task { await google() }
                    }
                    .buttonStyle(SecondaryButtonStyle())
                    .disabled(busy)
                    if mode == .login {
                        Button("Esqueci minha senha") {
                            Task { await reset() }
                        }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Brand.accent)
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
            message = "Informe e-mail e senha com pelo menos 6 caracteres."
            return
        }
        do {
            if mode == .login {
                try await SupabaseService.client.auth.signIn(email: cleaned, password: password)
            } else {
                try await signUp(email: cleaned)
            }
        } catch {
            message = describeError(error)
        }
    }

    private func signUp(email: String) async throws {
        guard acceptTerms, acceptWithdrawal, acceptRaffle else {
            message = "Marque todos os aceites dos Termos de Uso para criar a conta."
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
            birth: DatesPT.isoDay(birthDate)
        )
        if let missing {
            message = missing
            return
        }
        let response = try await SupabaseService.client.auth.signUp(
            email: email,
            password: password,
            data: [
                "full_name": .string(fullName.trimmingCharacters(in: .whitespacesAndNewlines)),
                "phone": .string(phoneValue ?? ""),
            ],
            redirectTo: AppConfig.authRedirectURL
        )
        guard response.session != nil else {
            message = "Conta criada. Confirme o e-mail para entrar. O link abre este app se o redirect iplanetpay://auth-callback estiver liberado no Supabase."
            mode = .login
            return
        }
        let userId = response.user.id
        try await Repository.updateProfile(
            id: userId,
            fields: [
                "full_name": fullName.trimmingCharacters(in: .whitespacesAndNewlines),
                "phone": phoneValue,
                "cpf": BrazilID.normalizeCPF(cpf),
                "city": city.trimmingCharacters(in: .whitespacesAndNewlines),
                "state": state,
                "address": address.trimmingCharacters(in: .whitespacesAndNewlines),
                "address_number": addressNumber.trimmingCharacters(in: .whitespacesAndNewlines),
                "birth_date": DatesPT.isoDay(birthDate),
                "terms_version": LegalCopy.termsVersion,
                "terms_accepted_at": ISO8601DateFormatter().string(from: Date()),
            ]
        )
        let code = referralCode.trimmingCharacters(in: .whitespacesAndNewlines)
        if !code.isEmpty {
            try? await Repository.applyReferral(code: code)
        }
        await session.refreshProfile()
    }

    private func google() async {
        busy = true
        defer { busy = false }
        do {
            try await SupabaseService.client.auth.signInWithOAuth(
                provider: .google,
                redirectTo: AppConfig.authRedirectURL
            )
        } catch {
            let text = describeError(error)
            if text.localizedCaseInsensitiveContains("cancel") { return }
            message = text
        }
    }

    private func reset() async {
        let cleaned = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard cleaned.contains("@") else {
            message = "Informe o e-mail para recuperar a senha."
            return
        }
        do {
            try await SupabaseService.client.auth.resetPasswordForEmail(
                cleaned,
                redirectTo: AppConfig.authRedirectURL
            )
            message = "Enviamos o link de recuperação. Ele abre o app se o redirect estiver liberado no Supabase."
        } catch {
            message = describeError(error)
        }
    }
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
