import IPlanetCore
import SwiftUI

/// "Viagem até o planeta": o foguete sai da Terra e voa até o planeta iPlanet (com anéis), uma estação por aporte.
struct RocketSceneView: View {
    let schedule: GoalSchedule
    let productName: String
    var onAporte: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var close = false
    @State private var zoom: Double = 1
    @State private var selected: Int?
    @State private var started = Date()

    private static let route = RocketRoute()

    var body: some View {
        let status = climbStatus
        let deposits = climbDeposits
        let condition = SpaceCondition.from(status)
        VStack(alignment: .leading, spacing: 16) {
            scene(status: status, deposits: deposits, condition: condition)
            stats(status: status, deposits: deposits)
            if status != .done {
                Button(status == .late ? "Aportar agora" : "Fazer aporte") {
                    Haptics.tap()
                    onAporte()
                }
                .buttonStyle(PrimaryButtonStyle(fill: status == .late ? Brand.danger : Brand.accent))
            }
        }
        .onAppear { started = Date() }
    }

    private var climbStatus: ClimbStatus {
        ClimbLogic.deriveStatus(
            deposits: climbDeposits,
            percent: Double(schedule.progressPercent),
            today: CivilDate.calendarToday()
        )
    }

    private var climbDeposits: [ClimbDeposit] {
        schedule.slots.map { slot in
            let status: DepositStatus
            switch slot.status {
            case .onTime: status = .paidOnTime
            case .latePayment: status = .paidLate
            case .missed: status = .missed
            case .upcoming: status = .pending
            }
            return ClimbDeposit(status: status, dueDate: slot.dueDate)
        }
    }

    private func scene(status: ClimbStatus, deposits: [ClimbDeposit], condition: SpaceCondition) -> some View {
        let stations = Self.route.stations(count: deposits.count).enumerated().map { index, pose in
            Station(index: index, x: pose.x, y: pose.y, kind: deposits[index].status)
        }
        let nextIndex = deposits.firstIndex { $0.status == .pending || $0.status == .missed }
        let profile = RocketMotionProfile.from(status)
        let target = Double(schedule.progressPercent) / 100
        let hour = Double(Calendar.current.component(.hour, from: Date()))
            + Double(Calendar.current.component(.minute, from: Date())) / 60
        let nebula = NebulaTint.colors(hour: hour)
        return TimelineView(.animation(minimumInterval: reduceMotion ? 60 : 1.0 / 60.0, paused: false)) { timeline in
            let elapsed = reduceMotion ? 1_000 : timeline.date.timeIntervalSince(started)
            let motion = profile.sample(target: target, elapsed: elapsed)
            let pose = Self.route.point(at: motion.progress)
            GeometryReader { geo in
                let frame = RocketFrame(
                    progress: motion.progress,
                    flame: motion.flame,
                    zoom: reduceMotion ? (close ? 2.4 : 1) : zoom,
                    nebulaTop: rgb(nebula.top),
                    nebulaBottom: rgb(nebula.bottom),
                    nebulaGlow: rgb(nebula.glow),
                    condition: condition,
                    profile: profile,
                    stations: stations,
                    selected: selected,
                    reduce: reduceMotion,
                    celebrate: status == .done && motion.progress > 0.98,
                    landedFor: max(0, elapsed - (2.4 + 0.85) / profile.pace),
                    time: reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate,
                    rocket: pose,
                    pulseIndex: nextIndex
                )
                Canvas { context, size in
                    drawSpace(context: &context, size: size, frame: frame)
                }
                .contentShape(Rectangle())
                .gesture(drag())
                .simultaneousGesture(
                    SpatialTapGesture().onEnded { event in
                        handleTap(event.location, size: geo.size, frame: frame)
                    }
                )
            }
        }
        .frame(height: 460)
        .background(Color(red: 0.02, green: 0.03, blue: 0.1))
        .clipShape(RoundedRectangle(cornerRadius: Brand.cardRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Brand.cardRadius, style: .continuous)
                .strokeBorder(LinearGradient(colors: [.white.opacity(0.25), .white.opacity(0.03)], startPoint: .top, endPoint: .bottom), lineWidth: 1)
        )
        .overlay(alignment: .topLeading) { hudPill(status: status).padding(12) }
        .overlay(alignment: .topTrailing) { viewSwitch.padding(12) }
        .overlay(alignment: .bottom) {
            hudFooter(status: status, condition: condition)
                .padding(12)
                .allowsHitTesting(false)
        }
        .overlay(alignment: .top) {
            if status == .done {
                Text("Meta conquistada")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(.ultraThinMaterial.opacity(0.9))
                    .environment(\.colorScheme, .dark)
                    .clipShape(Capsule())
                    .padding(.top, 60)
                    .transition(.scale.combined(with: .opacity))
                    .allowsHitTesting(false)
            }
        }
        .environment(\.colorScheme, .dark)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Viagem até o planeta, \(schedule.progressPercent) por cento, \(status.label)")
    }

    private func hudPill(status: ClimbStatus) -> some View {
        HStack(spacing: 8) {
            ProgressRing(
                percent: Double(schedule.progressPercent),
                caption: "",
                tint: status == .late ? Brand.danger : Brand.accent,
                size: 36
            )
            VStack(alignment: .leading, spacing: 0) {
                Text(status.label).font(.caption.weight(.semibold))
                Text("\(schedule.progressPercent)%")
                    .font(.caption2.weight(.bold))
                    .contentTransition(.numericText())
            }
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
        .allowsHitTesting(false)
    }

    private func hudFooter(status: ClimbStatus, condition: SpaceCondition) -> some View {
        VStack(spacing: 8) {
            if let selected, selected < schedule.slots.count {
                Text(selectionLine(selected))
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.ultraThinMaterial)
                    .clipShape(Capsule())
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            HStack {
                Label(condition.label, systemImage: conditionIcon(condition))
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.ultraThinMaterial)
                    .clipShape(Capsule())
                Spacer()
                Text(status == .done ? "Prêmio conquistado" : "Faltam \(MoneyFormat.reais(remainingCents))")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.ultraThinMaterial)
                    .clipShape(Capsule())
            }
        }
        .foregroundStyle(.white)
        .animation(.spring(response: 0.4, dampingFraction: 0.85), value: selected)
    }

    private func conditionIcon(_ condition: SpaceCondition) -> String {
        switch condition {
        case .calm: "sparkles"
        case .asteroidField: "circle.hexagongrid.fill"
        case .meteorStorm: "flame.fill"
        }
    }

    private var viewSwitch: some View {
        HStack(spacing: 0) {
            viewButton("Visão geral", selected: !close) { setClose(false) }
            viewButton("De perto", selected: close) { setClose(true) }
        }
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
    }

    private func viewButton(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 10)
            .frame(minHeight: 32)
            .background(selected ? Brand.accent : Color.clear)
            .foregroundStyle(.white)
            .clipShape(Capsule())
    }

    private func stats(status: ClimbStatus, deposits: [ClimbDeposit]) -> some View {
        let paid = deposits.filter { $0.status == .paidOnTime || $0.status == .paidLate }.count
        let streak = ClimbLogic.climbStreak(deposits.map(\.status))
        let next = schedule.applied.first { !$0.paid }
        return VStack(alignment: .leading, spacing: 12) {
            BrandCard {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(status.label)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(status == .late ? Brand.danger : Brand.accent)
                            Text(schedule.calendar.goalName)
                                .font(.title3.weight(.bold))
                            Text(productName)
                                .foregroundStyle(Brand.inkMuted)
                        }
                        Spacer()
                        ProgressRing(
                            percent: Double(schedule.progressPercent),
                            caption: "",
                            tint: status == .late ? Brand.danger : Brand.accent,
                            size: 88
                        )
                    }
                    Text(status.message)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(MoneyFormat.reais(schedule.savedCents))
                            .font(.title3.weight(.bold))
                            .contentTransition(.numericText())
                        Text("de \(MoneyFormat.reais(amountCents))")
                            .foregroundStyle(Brand.inkMuted)
                    }
                }
            }
            BrandCard {
                VStack(alignment: .leading, spacing: 10) {
                    statRow("Falta para concluir", status == .done ? "R$ 0" : MoneyFormat.reais(remainingCents))
                    if let next, status != .done {
                        statRow(
                            status == .late ? "Aporte em atraso" : "Próximo aporte",
                            "\(PlanCopy.dayMonth(next.dueDate)) · \(MoneyFormat.reais(next.dueCents))"
                        )
                        Text(ClimbLogic.relativeDue(next.dueDate, today: CivilDate.calendarToday()))
                            .font(.caption)
                            .foregroundStyle(Brand.inkMuted)
                    } else {
                        statRow(status == .late ? "Aporte em atraso" : "Próximo aporte", "—")
                    }
                    statRow("Aportes feitos", "\(paid) de \(deposits.count)")
                    statRow("Sequência em dia", "\(streak)")
                }
            }
        }
    }

    private func statRow(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title).foregroundStyle(Brand.inkMuted)
            Spacer()
            Text(value).fontWeight(.semibold)
        }
    }

    private var amountCents: Int { schedule.plan.remainingCents }

    private var remainingCents: Int { max(0, amountCents - schedule.savedCents) }

    private func selectionLine(_ index: Int) -> String {
        let slot = schedule.slots[index]
        let cents: Int
        if index < schedule.applied.count {
            let row = schedule.applied[index]
            cents = row.paid ? row.baseCents : row.dueCents
        } else {
            cents = schedule.plan.amountPerInstallmentCents
        }
        let phrase: String
        switch slot.status {
        case .onTime: phrase = PlanCopy.depositPhrase(.paidOnTime)
        case .latePayment: phrase = PlanCopy.depositPhrase(.paidLate)
        case .missed: phrase = PlanCopy.depositPhrase(.missed)
        case .upcoming: phrase = PlanCopy.depositPhrase(.pending)
        }
        return "Aporte \(index + 1) · \(PlanCopy.dayMonth(slot.dueDate)) · \(MoneyFormat.reais(cents)) · \(phrase)"
    }

    private func setClose(_ value: Bool) {
        close = value
        Haptics.tap()
        if reduceMotion {
            zoom = value ? 2.4 : 1
            return
        }
        withAnimation(.spring(response: 0.6, dampingFraction: 0.86)) {
            zoom = value ? 2.4 : 1
        }
    }

    private func drag() -> some Gesture {
        DragGesture(minimumDistance: 28).onEnded { value in
            guard abs(value.translation.width) > abs(value.translation.height), abs(value.translation.width) > 36 else { return }
            setClose(value.translation.width < 0)
        }
    }

    private func handleTap(_ location: CGPoint, size: CGSize, frame: RocketFrame) {
        let scene = scenePoint(location, size: size, frame: frame)
        if let dot = frame.stations.min(by: { hypot($0.x - scene.x, $0.y - scene.y) < hypot($1.x - scene.x, $1.y - scene.y) }),
           hypot(dot.x - scene.x, dot.y - scene.y) < 28 {
            selected = selected == dot.index ? nil : dot.index
            Haptics.tap()
            return
        }
        if hypot(frame.rocket.x - scene.x, frame.rocket.y - scene.y) < 40 {
            setClose(!close)
        }
    }

    private func scenePoint(_ location: CGPoint, size: CGSize, frame: RocketFrame) -> CGPoint {
        let rocket = viewPoint(frame.rocket.x, frame.rocket.y, size: size)
        let focus = cameraFocus(rocket: rocket, size: size, zoom: frame.zoom)
        let zoom = max(frame.zoom, 0.01)
        let viewX = (location.x - size.width / 2) / zoom + focus.x
        let viewY = (location.y - size.height / 2) / zoom + focus.y
        return CGPoint(x: viewX / size.width * 520, y: viewY / size.height * 700)
    }
}

private struct Station: Sendable {
    var index: Int
    var x: Double
    var y: Double
    var kind: DepositStatus
}

private struct RocketFrame: Sendable {
    var progress: Double
    var flame: Double
    var zoom: Double
    var nebulaTop: Color
    var nebulaBottom: Color
    var nebulaGlow: Color
    var condition: SpaceCondition
    var profile: RocketMotionProfile
    var stations: [Station]
    var selected: Int?
    var reduce: Bool
    var celebrate: Bool
    var landedFor: Double
    var time: Double
    var rocket: RocketPose
    var pulseIndex: Int?
}

// MARK: - Drawing

private func viewPoint(_ x: Double, _ y: Double, size: CGSize) -> CGPoint {
    CGPoint(x: x / 520 * size.width, y: y / 700 * size.height)
}

private func cameraFocus(rocket: CGPoint, size: CGSize, zoom: Double) -> CGPoint {
    let blend = max(0, min(1, (zoom - 1) / 1.4))
    return CGPoint(
        x: size.width / 2 + (rocket.x - size.width / 2) * blend,
        y: size.height / 2 + (rocket.y - size.height / 2) * blend
    )
}

private func rgb(_ color: RGBColor) -> Color {
    Color(red: color.red / 255, green: color.green / 255, blue: color.blue / 255)
}

/// Pseudo-aleatório determinístico para estrelas/asteroides.
private func hash(_ n: Int) -> Double {
    var x = UInt64(truncatingIfNeeded: n &* 2_654_435_761 &+ 0x9E37_79B9)
    x ^= x >> 33
    x = x &* 0xff51_afd7_ed55_8ccd
    x ^= x >> 33
    return Double(x % 10_000) / 10_000
}

private func drawSpace(context: inout GraphicsContext, size: CGSize, frame: RocketFrame) {
    let w = size.width, h = size.height
    let rocketView = viewPoint(frame.rocket.x, frame.rocket.y, size: size)
    let focus = cameraFocus(rocket: rocketView, size: size, zoom: frame.zoom)
    let full = CGRect(origin: .zero, size: size)

    // Fundo de nebulosa (fixo)
    context.fill(Path(full), with: .linearGradient(
        Gradient(colors: [frame.nebulaTop, frame.nebulaBottom]),
        startPoint: CGPoint(x: w / 2, y: 0), endPoint: CGPoint(x: w / 2, y: h)
    ))
    context.fill(Path(ellipseIn: CGRect(x: w * 0.1, y: h * 0.15, width: w * 0.9, height: h * 0.6)),
                 with: .radialGradient(Gradient(colors: [frame.nebulaGlow.opacity(0.28), .clear]),
                                       center: CGPoint(x: w * 0.55, y: h * 0.45), startRadius: 0, endRadius: w * 0.55))

    // Estrelas em três camadas com parallax
    let shiftX = focus.x - w / 2, shiftY = focus.y - h / 2
    for layer in 0..<3 {
        let depth = [0.08, 0.2, 0.4][layer]
        let count = [70, 40, 18][layer]
        for i in 0..<count {
            let seed = layer * 1000 + i
            var x = hash(seed) * w - shiftX * depth * frame.zoom
            var y = hash(seed + 7) * h - shiftY * depth * frame.zoom
            x = x.truncatingRemainder(dividingBy: w); if x < 0 { x += w }
            y = y.truncatingRemainder(dividingBy: h); if y < 0 { y += h }
            let r = 0.5 + Double(layer) * 0.5 + hash(seed + 3) * 0.6
            let twinkle = frame.reduce ? 0.8 : 0.55 + 0.45 * sin(frame.time * (1 + hash(seed + 5) * 2) + Double(i))
            context.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)),
                         with: .color(.white.opacity(0.35 + 0.5 * twinkle * Double(layer + 1) / 3)))
        }
    }

    // Câmera
    var world = context
    world.translateBy(x: w / 2, y: h / 2)
    world.scaleBy(x: frame.zoom, y: frame.zoom)
    world.translateBy(x: -focus.x, y: -focus.y)
    let s = min(w / 520, h / 700)

    drawConditions(context: &world, size: size, frame: frame, scale: s)

    // Terra
    let earth = viewPoint(RocketRoute.earth.x, RocketRoute.earth.y + 40, size: size)
    let er = 62 * s
    world.fill(Path(ellipseIn: CGRect(x: earth.x - er * 1.35, y: earth.y - er * 1.35, width: er * 2.7, height: er * 2.7)),
               with: .radialGradient(Gradient(colors: [Color(red: 0.3, green: 0.7, blue: 1).opacity(0.35), .clear]), center: earth, startRadius: er * 0.9, endRadius: er * 1.35))
    world.fill(Path(ellipseIn: CGRect(x: earth.x - er, y: earth.y - er, width: er * 2, height: er * 2)),
               with: .linearGradient(Gradient(colors: [Color(red: 0.2, green: 0.55, blue: 1), Color(red: 0.05, green: 0.2, blue: 0.55)]),
                                     startPoint: CGPoint(x: earth.x - er, y: earth.y - er), endPoint: CGPoint(x: earth.x + er, y: earth.y + er)))
    var land = Path()
    land.addEllipse(in: CGRect(x: earth.x - er * 0.6, y: earth.y - er * 0.55, width: er * 0.7, height: er * 0.45))
    land.addEllipse(in: CGRect(x: earth.x + er * 0.05, y: earth.y - er * 0.05, width: er * 0.6, height: er * 0.5))
    land.addEllipse(in: CGRect(x: earth.x - er * 0.4, y: earth.y + er * 0.35, width: er * 0.4, height: er * 0.3))
    world.drawLayer { layer in
        layer.clip(to: Path(ellipseIn: CGRect(x: earth.x - er, y: earth.y - er, width: er * 2, height: er * 2)))
        layer.fill(land, with: .color(Color(red: 0.25, green: 0.8, blue: 0.55).opacity(0.85)))
    }
    world.draw(Text("Início").font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.8)),
               at: CGPoint(x: earth.x, y: earth.y - er - 10 * s))

    drawPlanet(context: &world, size: size, frame: frame, scale: s, front: false)

    // Rota: percorrida azul, restante tracejada
    let all = RocketRoute()
    func path(_ pts: [(x: Double, y: Double)]) -> Path {
        var p = Path()
        for (i, pt) in pts.enumerated() {
            let v = viewPoint(pt.x, pt.y, size: size)
            if i == 0 { p.move(to: v) } else { p.addLine(to: v) }
        }
        return p
    }
    world.stroke(path(all.polyline()), with: .color(.white.opacity(0.35)),
                 style: StrokeStyle(lineWidth: 2 * s, lineCap: .round, dash: [5 * s, 7 * s]))
    let traveled = path(all.polyline(to: frame.progress))
    world.stroke(traveled, with: .color(Color(red: 0.25, green: 0.55, blue: 1).opacity(0.35)), style: StrokeStyle(lineWidth: 9 * s, lineCap: .round))
    world.stroke(traveled, with: .linearGradient(Gradient(colors: [Color(red: 0.3, green: 0.6, blue: 1), Color(red: 0.55, green: 0.85, blue: 1)]),
                                                  startPoint: earth, endPoint: rocketView),
                 style: StrokeStyle(lineWidth: 3.5 * s, lineCap: .round))

    // Estações
    for station in frame.stations {
        let p = viewPoint(station.x, station.y, size: size)
        let r = 8 * s
        if station.index == frame.pulseIndex && !frame.reduce {
            let phase = (frame.time * 1.2).truncatingRemainder(dividingBy: 1)
            let pr = r * (1 + phase * 1.6)
            world.stroke(Path(ellipseIn: CGRect(x: p.x - pr, y: p.y - pr, width: pr * 2, height: pr * 2)),
                         with: .color(Color(red: 0.35, green: 0.65, blue: 1).opacity(1 - phase)), lineWidth: 2)
        }
        let rect = CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2)
        switch station.kind {
        case .paidOnTime:
            world.fill(Path(ellipseIn: rect), with: .color(Color(red: 0.2, green: 0.8, blue: 0.45)))
        case .paidLate:
            world.fill(Path(ellipseIn: rect), with: .color(Color(red: 1, green: 0.8, blue: 0.2)))
        case .missed:
            world.fill(Path(ellipseIn: rect), with: .color(Color(red: 0.95, green: 0.25, blue: 0.3)))
            var x = Path()
            x.move(to: CGPoint(x: p.x - r * 0.45, y: p.y - r * 0.45)); x.addLine(to: CGPoint(x: p.x + r * 0.45, y: p.y + r * 0.45))
            x.move(to: CGPoint(x: p.x + r * 0.45, y: p.y - r * 0.45)); x.addLine(to: CGPoint(x: p.x - r * 0.45, y: p.y + r * 0.45))
            world.stroke(x, with: .color(.white), style: StrokeStyle(lineWidth: 2, lineCap: .round))
        case .pending:
            world.fill(Path(ellipseIn: rect), with: .color(.white))
            world.stroke(Path(ellipseIn: rect), with: .color(Color(red: 0.2, green: 0.45, blue: 1)), lineWidth: 2.5)
        }
        if station.index == frame.selected {
            world.stroke(Path(ellipseIn: rect.insetBy(dx: -4, dy: -4)), with: .color(.white), lineWidth: 1.5)
        }
    }

    drawRocket(context: &world, at: rocketView, frame: frame, scale: s)
    drawPlanet(context: &world, size: size, frame: frame, scale: s, front: true)

    if frame.celebrate {
        drawPrize(context: &world, size: size, frame: frame, scale: s)
        if !frame.reduce { drawConfetti(context: &context, size: size, frame: frame) }
    }
}

private func planetCenter(_ size: CGSize) -> CGPoint {
    viewPoint(RocketRoute.planet.x, RocketRoute.planet.y - 20, size: size)
}

/// Planeta = logo iPlanet: globo branco em grade navy, anel navy inclinado (atrás/na frente) e a barra "I" diagonal.
private func drawPlanet(context: inout GraphicsContext, size: CGSize, frame: RocketFrame, scale s: Double, front: Bool) {
    let c = planetCenter(size)
    let r = 58 * s
    let navy = Color(red: 0x1B / 255, green: 0x23 / 255, blue: 0x50 / 255)
    var ctx = context
    ctx.translateBy(x: c.x, y: c.y)
    ctx.rotate(by: .degrees(-14))
    let outer = CGRect(x: -r * 1.75, y: -r * 0.5, width: r * 3.5, height: r * 1.0)
    let inner = CGRect(x: -r * 1.55, y: -r * 0.36, width: r * 3.1, height: r * 0.72)
    var band = Path(ellipseIn: outer)
    band.addPath(Path(ellipseIn: inner))
    if !front {
        let glow = frame.celebrate ? 0.7 : 0.35
        ctx.fill(Path(ellipseIn: CGRect(x: -r * 1.7, y: -r * 1.7, width: r * 3.4, height: r * 3.4)),
                 with: .radialGradient(Gradient(colors: [Color(red: 0.55, green: 0.7, blue: 1).opacity(glow), .clear]), center: .zero, startRadius: r * 0.9, endRadius: r * 1.7))
        // Metade de trás do anel
        var back = ctx
        back.clip(to: Path(CGRect(x: -r * 3, y: -r * 3, width: r * 6, height: r * 3)))
        back.fill(band, with: .color(navy), style: FillStyle(eoFill: true))
        // Globo branco
        let body = Path(ellipseIn: CGRect(x: -r, y: -r, width: r * 2, height: r * 2))
        ctx.fill(body, with: .radialGradient(Gradient(colors: [.white, Color(white: 0.86)]), center: CGPoint(x: -r * 0.3, y: -r * 0.35), startRadius: 0, endRadius: r * 1.4))
        ctx.drawLayer { g in
            g.clip(to: body)
            let line = max(0.7, 1.1 * s)
            // Latitudes
            for i in 1..<10 {
                let lat = -Double.pi / 2 + Double(i) * Double.pi / 10
                let y = r * sin(lat), half = r * cos(lat)
                g.stroke(Path(ellipseIn: CGRect(x: -half, y: y - half * 0.06, width: half * 2, height: half * 0.12)), with: .color(navy), lineWidth: line)
            }
            // Longitudes girando devagar
            let spin = frame.reduce ? 0 : (frame.time * 0.12).truncatingRemainder(dividingBy: Double.pi / 9)
            for i in 0..<18 {
                let lon = Double(i) * Double.pi / 9 + spin
                let x = r * sin(lon)
                guard cos(lon) > 0 else { continue }
                var m = Path()
                m.move(to: CGPoint(x: 0, y: -r))
                m.addQuadCurve(to: CGPoint(x: 0, y: r), control: CGPoint(x: x * 2, y: 0))
                g.stroke(m, with: .color(navy), lineWidth: line)
            }
            g.fill(Path(ellipseIn: CGRect(x: -r * 0.18, y: -r * 1.02, width: r * 0.36, height: r * 0.16)), with: .color(navy))
            g.stroke(body, with: .color(navy), lineWidth: line * 2)
        }
        ctx.stroke(body, with: .color(navy), lineWidth: max(1.2, 2 * s))
        // Barra "I" diagonal
        var bar = ctx
        bar.rotate(by: .degrees(28))
        bar.fill(Path(roundedRect: CGRect(x: -r * 0.13, y: -r * 0.62, width: r * 0.26, height: r * 1.24), cornerRadius: r * 0.03), with: .color(navy))
    } else {
        var fr = ctx
        fr.clip(to: Path(CGRect(x: -r * 3, y: 0, width: r * 6, height: r * 3)))
        fr.fill(band, with: .color(navy), style: FillStyle(eoFill: true))
        fr.stroke(Path(ellipseIn: outer), with: .color(.white.opacity(0.35)), lineWidth: 0.8)
        context.draw(Text("iPlanet").font(.caption2.weight(.heavy)).foregroundStyle(.white.opacity(0.85)),
                     at: CGPoint(x: c.x, y: c.y + r * 1.3))
    }
}

private func drawConditions(context: inout GraphicsContext, size: CGSize, frame: RocketFrame, scale s: Double) {
    switch frame.condition {
    case .calm:
        // Cometa ocasional
        guard !frame.reduce else { return }
        let t = (frame.time / 7).truncatingRemainder(dividingBy: 1)
        let p = CGPoint(x: size.width * (1.1 - t * 1.3), y: size.height * (0.08 + t * 0.25))
        var tail = Path(); tail.move(to: p); tail.addLine(to: CGPoint(x: p.x + 40 * s, y: p.y - 10 * s))
        context.stroke(tail, with: .linearGradient(Gradient(colors: [.white.opacity(0.7), .clear]), startPoint: p, endPoint: CGPoint(x: p.x + 40 * s, y: p.y - 10 * s)), lineWidth: 1.5)
    case .asteroidField:
        for i in 0..<9 {
            let drift = frame.reduce ? 0 : frame.time * (6 + hash(i) * 10)
            var x = hash(i + 50) * size.width + drift
            x = x.truncatingRemainder(dividingBy: size.width + 40) - 20
            let y = size.height * (0.25 + hash(i + 80) * 0.5)
            let r = (4 + hash(i + 90) * 7) * s
            let rock = Path(roundedRect: CGRect(x: x - r, y: y - r * 0.8, width: r * 2, height: r * 1.6), cornerRadius: r * 0.7)
            context.fill(rock, with: .linearGradient(Gradient(colors: [Color(white: 0.6), Color(white: 0.25)]), startPoint: CGPoint(x: x - r, y: y - r), endPoint: CGPoint(x: x + r, y: y + r)))
        }
    case .meteorStorm:
        for i in 0..<14 {
            let speed = 0.5 + hash(i) * 0.7
            let t = frame.reduce ? hash(i + 3) : (frame.time * speed + hash(i + 3)).truncatingRemainder(dividingBy: 1)
            let start = CGPoint(x: size.width * (hash(i + 20) * 1.4), y: -20)
            let p = CGPoint(x: start.x - t * size.width * 0.6, y: start.y + t * size.height * 1.1)
            let tailEnd = CGPoint(x: p.x + 26 * s, y: p.y - 46 * s)
            var tail = Path(); tail.move(to: p); tail.addLine(to: tailEnd)
            context.stroke(tail, with: .linearGradient(Gradient(colors: [Color(red: 1, green: 0.6, blue: 0.3), .clear]), startPoint: p, endPoint: tailEnd), style: StrokeStyle(lineWidth: 2.2, lineCap: .round))
            context.fill(Path(ellipseIn: CGRect(x: p.x - 2.5, y: p.y - 2.5, width: 5, height: 5)), with: .color(Color(red: 1, green: 0.85, blue: 0.6)))
        }
        context.fill(Path(CGRect(x: -size.width, y: -size.height, width: size.width * 3, height: size.height * 3)), with: .color(Color.red.opacity(0.06)))
    }
}

private func drawRocket(context: inout GraphicsContext, at p: CGPoint, frame: RocketFrame, scale s: Double) {
    var ctx = context
    let wobble = frame.reduce ? 0 : sin(frame.time * 3.1) * 0.08 * frame.profile.wobble
    let shake = frame.reduce ? 0 : frame.profile.turbulence
    let jitter = CGPoint(x: sin(frame.time * 23) * 1.6 * shake, y: cos(frame.time * 19) * 1.6 * shake)
    // Ao pousar, o foguete fica em pé sobre o planeta.
    let landing = frame.celebrate ? min(1, frame.landedFor / 0.8) : 0
    let flightAngle = frame.rocket.angle + .pi / 2 + wobble
    let angle = flightAngle * (1 - landing)
    ctx.translateBy(x: p.x + jitter.x, y: p.y + jitter.y - landing * 50 * s)
    ctx.rotate(by: .radians(angle))
    let k = 1.0 * s
    // Chama proporcional à velocidade
    let flame = frame.reduce ? 0 : max(frame.flame, frame.celebrate ? 0 : 0.12)
    if flame > 0.01 {
        let flicker = 0.85 + 0.15 * sin(frame.time * 40)
        let len = (14 + 34 * flame) * k * flicker
        var outer = Path()
        outer.move(to: CGPoint(x: -7 * k, y: 16 * k))
        outer.addQuadCurve(to: CGPoint(x: 0, y: 16 * k + len), control: CGPoint(x: -8 * k, y: 16 * k + len * 0.6))
        outer.addQuadCurve(to: CGPoint(x: 7 * k, y: 16 * k), control: CGPoint(x: 8 * k, y: 16 * k + len * 0.6))
        ctx.fill(outer, with: .linearGradient(Gradient(colors: [Color(red: 1, green: 0.85, blue: 0.4), Color(red: 1, green: 0.35, blue: 0.2).opacity(0)]),
                                              startPoint: CGPoint(x: 0, y: 16 * k), endPoint: CGPoint(x: 0, y: 16 * k + len)))
        ctx.fill(Path(ellipseIn: CGRect(x: -3 * k, y: 16 * k, width: 6 * k, height: len * 0.5)), with: .color(.white.opacity(0.9)))
        // Rastro de partículas
        for i in 0..<6 {
            let t = (frame.time * 2 + Double(i) / 6).truncatingRemainder(dividingBy: 1)
            let r = (1.5 + t * 3) * k
            ctx.fill(Path(ellipseIn: CGRect(x: sin(Double(i) * 2.3) * 4 * k - r, y: 16 * k + len + t * 30 * k * flame - r, width: r * 2, height: r * 2)),
                     with: .color(.white.opacity((1 - t) * 0.35 * flame)))
        }
    }
    // Aletas
    var fins = Path()
    fins.move(to: CGPoint(x: -8 * k, y: 4 * k)); fins.addLine(to: CGPoint(x: -15 * k, y: 18 * k)); fins.addLine(to: CGPoint(x: -7 * k, y: 15 * k)); fins.closeSubpath()
    fins.move(to: CGPoint(x: 8 * k, y: 4 * k)); fins.addLine(to: CGPoint(x: 15 * k, y: 18 * k)); fins.addLine(to: CGPoint(x: 7 * k, y: 15 * k)); fins.closeSubpath()
    ctx.fill(fins, with: .color(Color(red: 0.25, green: 0.45, blue: 1)))
    // Corpo
    var body = Path()
    body.move(to: CGPoint(x: 0, y: -24 * k))
    body.addQuadCurve(to: CGPoint(x: 8 * k, y: 6 * k), control: CGPoint(x: 11 * k, y: -12 * k))
    body.addLine(to: CGPoint(x: 6 * k, y: 16 * k))
    body.addLine(to: CGPoint(x: -6 * k, y: 16 * k))
    body.addLine(to: CGPoint(x: -8 * k, y: 6 * k))
    body.addQuadCurve(to: CGPoint(x: 0, y: -24 * k), control: CGPoint(x: -11 * k, y: -12 * k))
    ctx.fill(body, with: .linearGradient(Gradient(colors: [.white, Color(white: 0.78)]), startPoint: CGPoint(x: -8 * k, y: 0), endPoint: CGPoint(x: 8 * k, y: 0)))
    var nose = Path()
    nose.move(to: CGPoint(x: 0, y: -24 * k))
    nose.addQuadCurve(to: CGPoint(x: 6.5 * k, y: -12 * k), control: CGPoint(x: 5 * k, y: -20 * k))
    nose.addLine(to: CGPoint(x: -6.5 * k, y: -12 * k))
    nose.addQuadCurve(to: CGPoint(x: 0, y: -24 * k), control: CGPoint(x: -5 * k, y: -20 * k))
    ctx.fill(nose, with: .color(Color(red: 0.25, green: 0.45, blue: 1)))
    let window = CGRect(x: -3.6 * k, y: -6 * k, width: 7.2 * k, height: 7.2 * k)
    ctx.fill(Path(ellipseIn: window), with: .linearGradient(Gradient(colors: [Color(red: 0.6, green: 0.85, blue: 1), Color(red: 0.1, green: 0.3, blue: 0.7)]), startPoint: CGPoint(x: 0, y: window.minY), endPoint: CGPoint(x: 0, y: window.maxY)))
    ctx.stroke(Path(ellipseIn: window), with: .color(Color(white: 0.55)), lineWidth: 1.2)
}

private func drawPrize(context: inout GraphicsContext, size: CGSize, frame: RocketFrame, scale s: Double) {
    let c = planetCenter(size)
    let appear = frame.reduce ? 1 : min(1, frame.landedFor / 1.2)
    guard appear > 0 else { return }
    let center = CGPoint(x: c.x - 70 * s, y: c.y + 78 * s - appear * 10 * s)
    let pw = 26 * s * appear, ph = 52 * s * appear
    context.fill(Path(ellipseIn: CGRect(x: center.x - pw * 1.8, y: center.y - ph * 1.1, width: pw * 3.6, height: ph * 2.2)),
                 with: .radialGradient(Gradient(colors: [Color(red: 0.6, green: 0.75, blue: 1).opacity(0.6 * appear), .clear]), center: center, startRadius: 0, endRadius: ph))
    let phone = CGRect(x: center.x - pw / 2, y: center.y - ph / 2, width: pw, height: ph)
    context.fill(Path(roundedRect: phone, cornerRadius: 6 * s * appear), with: .color(Color(white: 0.12)))
    let screen = phone.insetBy(dx: 2 * s * appear, dy: 2 * s * appear)
    context.fill(Path(roundedRect: screen, cornerRadius: 5 * s * appear),
                 with: .linearGradient(Gradient(colors: [Color(red: 0.4, green: 0.55, blue: 1), Color(red: 0.7, green: 0.4, blue: 1)]), startPoint: CGPoint(x: screen.minX, y: screen.minY), endPoint: CGPoint(x: screen.maxX, y: screen.maxY)))
    context.fill(Path(roundedRect: CGRect(x: center.x - pw * 0.18, y: screen.minY + 2 * s, width: pw * 0.36, height: 3 * s * appear), cornerRadius: 2), with: .color(.black))
}

private func drawConfetti(context: inout GraphicsContext, size: CGSize, frame: RocketFrame) {
    let colors: [Color] = [.blue, .pink, .yellow, .green, .orange, .purple, .cyan]
    let t = frame.landedFor
    guard t < 6 else { return }
    for i in 0..<60 {
        let x0 = hash(i) * size.width
        let delay = hash(i + 200) * 0.8
        let u = max(0, t - delay)
        let y = -10 + u * (90 + hash(i + 300) * 80)
        guard y < size.height + 10, u > 0 else { continue }
        let x = x0 + sin(u * 3 + Double(i)) * 14
        var piece = context
        piece.translateBy(x: x, y: y)
        piece.rotate(by: .radians(u * (2 + hash(i + 400) * 4)))
        piece.fill(Path(CGRect(x: -3, y: -1.5, width: 6, height: 3)), with: .color(colors[i % colors.count].opacity(max(0, 1 - t / 6))))
    }
}
