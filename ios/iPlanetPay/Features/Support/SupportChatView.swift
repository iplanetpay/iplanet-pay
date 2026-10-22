import IPlanetCore
import SwiftUI

/// Conversa da sessão (fica em memória enquanto o app está aberto).
@MainActor
@Observable
final class SupportChatStore {
    static let shared = SupportChatStore()

    struct Bubble: Identifiable, Equatable {
        let id = UUID()
        var role: String
        var text: String
    }

    var bubbles: [Bubble] = [Bubble(role: "assistant", text: "Olá! Posso ajudar com Pix, lojas, reserva e retirada. Em que posso ajudar?")]
    var sending = false
    var waiting = false
    var whatsapp: URL?
    var error: String?
    private var task: Task<Void, Never>?

    func send(_ text: String) {
        let question = String(text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(SupportHistory.maxChars))
        guard !question.isEmpty, !sending else { return }
        error = nil
        bubbles.append(Bubble(role: "user", text: question))
        // A saudação local não vai para o servidor.
        let history = SupportHistory.prepare(bubbles.dropFirst().map { SupportMessage(role: $0.role, content: $0.text) })
        sending = true
        waiting = true
        task = Task { await stream(history) }
    }

    func cancel() { task?.cancel() }

    private struct Body: Encodable { var messages: [SupportMessage]; var stream: Bool }
    private struct ErrorBody: Decodable { var error: String?; var handoff: Bool?; var whatsapp: String? }

    private func stream(_ history: [SupportMessage]) async {
        defer { sending = false; waiting = false }
        do {
            var request = URLRequest(url: AppConfig.web("/api/support/chat"))
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
            let session = try await SupabaseService.client.auth.session
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            request.httpBody = try JSONEncoder().encode(Body(messages: history, stream: true))
            request.timeoutInterval = 60
            let (bytes, response) = try await URLSession.shared.bytes(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard status == 200 else {
                var raw = Data()
                for try await byte in bytes { raw.append(byte) }
                let body = try? JSONDecoder().decode(ErrorBody.self, from: raw)
                fail(status: status, body: body)
                return
            }
            var index: Int?
            for try await line in bytes.lines {
                if Task.isCancelled { break }
                guard let event = SupportSSE.parse(line: line) else { continue }
                switch event {
                case .delta(let piece):
                    if index == nil {
                        waiting = false
                        bubbles.append(Bubble(role: "assistant", text: ""))
                        index = bubbles.count - 1
                        Haptics.tap()
                    }
                    if let index { bubbles[index].text += piece }
                case .done:
                    return
                case .error(let message):
                    error = message
                    return
                }
            }
        } catch is CancellationError {
        } catch {
            self.error = "Erro de rede. Tente novamente."
        }
    }

    private func fail(status: Int, body: ErrorBody?) {
        switch status {
        case 503:
            whatsapp = SupportHistory.whatsappURL(body?.whatsapp)
            bubbles.append(Bubble(role: "assistant", text: "Posso te conectar com um atendente no WhatsApp."))
        case 429:
            error = body?.error ?? "Muitas perguntas seguidas. Aguarde alguns minutos."
        case 401:
            error = body?.error ?? "Entre de novo para falar com o suporte."
        default:
            error = body?.error ?? "Não foi possível responder agora."
        }
    }
}

struct SupportChatView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var store = SupportChatStore.shared
    @State private var draft = ""
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(store.bubbles) { bubble in
                            BubbleView(bubble: bubble)
                                .id(bubble.id)
                                .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
                        }
                        if store.waiting {
                            TypingIndicator()
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .id("typing")
                                .transition(.opacity)
                        }
                        if let error = store.error {
                            Text(error)
                                .font(.footnote)
                                .foregroundStyle(Brand.danger)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        if let url = store.whatsapp {
                            Link(destination: url) {
                                Label("Falar no WhatsApp", systemImage: "bubble.left.and.text.bubble.right.fill")
                                    .font(.subheadline.weight(.semibold))
                                    .padding(.horizontal, 16)
                                    .frame(minHeight: 44)
                                    .background(Brand.whatsapp, in: Capsule())
                                    .foregroundStyle(.white)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        Color.clear.frame(height: 1).id("bottom")
                    }
                    .padding(16)
                    .animation(reduceMotion ? nil : .spring(response: 0.4, dampingFraction: 0.85), value: store.bubbles)
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: store.waiting)
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: store.bubbles) { _, _ in scrollDown(proxy) }
                .onChange(of: store.waiting) { _, _ in scrollDown(proxy) }
                .onAppear { proxy.scrollTo("bottom", anchor: .bottom) }
            }
            .background(Brand.backgroundSubtle)
            composer
        }
        .background(Brand.background)
    }

    private func scrollDown(_ proxy: ScrollViewProxy) {
        if reduceMotion { proxy.scrollTo("bottom", anchor: .bottom) } else {
            withAnimation(.easeOut(duration: 0.25)) { proxy.scrollTo("bottom", anchor: .bottom) }
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Brand.accent).frame(width: 38, height: 38)
                Image(systemName: "sparkles").foregroundStyle(.white).font(.subheadline.weight(.bold))
            }
            VStack(alignment: .leading, spacing: 1) {
                Text("Ajuda iPlanet").font(.subheadline.weight(.semibold))
                Text("FAQ · WhatsApp se precisar").font(.caption).foregroundStyle(.white.opacity(0.7))
            }
            Spacer()
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark").font(.footnote.weight(.bold))
                    .frame(width: 36, height: 36)
                    .background(.white.opacity(0.12), in: Circle())
            }
            .accessibilityLabel("Fechar")
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(
            LinearGradient(colors: [Color(red: 0.07, green: 0.08, blue: 0.16), Color(red: 0.11, green: 0.14, blue: 0.31)], startPoint: .leading, endPoint: .trailing)
        )
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 10) {
            TextField("Digite sua dúvida…", text: $draft, axis: .vertical)
                .lineLimit(1...5)
                .focused($focused)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Brand.backgroundSubtle, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                .onChange(of: draft) { _, value in
                    if value.count > SupportHistory.maxChars { draft = String(value.prefix(SupportHistory.maxChars)) }
                }
                .submitLabel(.send)
                .onSubmit(send)
            Button(action: send) {
                Image(systemName: store.sending ? "ellipsis" : "arrow.up")
                    .font(.headline)
                    .foregroundStyle(.white)
                    .frame(width: 42, height: 42)
                    .background(canSend ? Brand.accent : Brand.line, in: Circle())
                    .symbolEffect(.pulse, isActive: store.sending && !reduceMotion)
            }
            .disabled(!canSend)
            .accessibilityLabel("Enviar")
            .sensoryFeedback(.impact(weight: .light), trigger: store.bubbles.count)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(.bar)
    }

    private var canSend: Bool {
        !store.sending && !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func send() {
        guard canSend else { return }
        store.send(draft)
        draft = ""
    }
}

private struct BubbleView: View {
    let bubble: SupportChatStore.Bubble

    var body: some View {
        let mine = bubble.role == "user"
        HStack {
            if mine { Spacer(minLength: 48) }
            Text(rendered)
                .font(.subheadline)
                .textSelection(.enabled)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .foregroundStyle(mine ? Color.white : Brand.ink)
                .background(
                    mine ? AnyShapeStyle(Brand.accent) : AnyShapeStyle(Brand.background),
                    in: UnevenRoundedRectangle(
                        topLeadingRadius: 18, bottomLeadingRadius: mine ? 18 : 6,
                        bottomTrailingRadius: mine ? 6 : 18, topTrailingRadius: 18, style: .continuous
                    )
                )
                .shadow(color: .black.opacity(mine ? 0 : 0.05), radius: 6, y: 2)
            if !mine { Spacer(minLength: 48) }
        }
    }

    /// Markdown simples: negrito, listas "-" e títulos "#".
    private var rendered: AttributedString {
        let lines = bubble.text.components(separatedBy: "\n").map { line -> String in
            var l = line
            if let range = l.range(of: #"^\s*#{1,6}\s+"#, options: .regularExpression) {
                l = "**" + l[range.upperBound...] + "**"
            }
            if let range = l.range(of: #"^\s*[-*]\s+"#, options: .regularExpression) {
                l = "•  " + l[range.upperBound...]
            }
            return l
        }.joined(separator: "\n")
        let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        return (try? AttributedString(markdown: lines, options: options)) ?? AttributedString(bubble.text)
    }
}

private struct TypingIndicator: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30, paused: reduceMotion)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            HStack(spacing: 5) {
                ForEach(0..<3, id: \.self) { i in
                    Circle()
                        .fill(Brand.inkMuted)
                        .frame(width: 7, height: 7)
                        .offset(y: reduceMotion ? 0 : -3 * max(0, sin(t * 6 - Double(i) * 0.7)))
                        .opacity(reduceMotion ? 0.7 : 0.45 + 0.55 * max(0, sin(t * 6 - Double(i) * 0.7)))
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Brand.background, in: Capsule())
        }
        .accessibilityLabel("Digitando")
    }
}
