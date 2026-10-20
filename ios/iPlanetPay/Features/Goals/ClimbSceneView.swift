import IPlanetCore
import SwiftUI

struct ClimbSceneView: View {
    let schedule: GoalSchedule
    let productName: String
    var onAporte: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var forecast = Forecast.saoPaulo
    @State private var close = false
    @State private var zoom: Double = 1
    @State private var selected: Int?
    @State private var started = Date()

    var body: some View {
        let status = climbStatus
        let deposits = climbDeposits
        let effective = WeatherAdjust.effective(forecast, status: status)
        let sky = SkyMath.compute(
            hour: forecast.localHour,
            sunrise: forecast.sunrise,
            sunset: forecast.sunset,
            kind: effective.kind
        )
        VStack(alignment: .leading, spacing: 16) {
            scene(status: status, deposits: deposits, weather: effective, sky: sky)
            stats(status: status, deposits: deposits)
            if status != .done {
                Button(status == .late ? "Aportar agora" : "Fazer aporte") {
                    Haptics.tap()
                    onAporte()
                }
                .buttonStyle(PrimaryButtonStyle(fill: status == .late ? Brand.danger : Brand.accent))
            }
        }
        .task {
            forecast = await ForecastClient.current()
        }
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

    private func scene(
        status: ClimbStatus,
        deposits: [ClimbDeposit],
        weather: EffectiveWeather,
        sky: SkySample
    ) -> some View {
        let trail = ClimbSceneMath.portraitTrail()
        let outline = ClimbSceneMath.portraitOutline()
        let dots = milestoneDots(trail: trail, deposits: deposits)
        let nextIndex = deposits.firstIndex { $0.status == .pending || $0.status == .missed }
        TimelineView(.animation(minimumInterval: reduceMotion ? 60 : 1.0 / 30.0, paused: false)) { timeline in
            let motion = motionSample(at: timeline.date, status: status)
            let climber = trail.point(at: motion.progress)
            GeometryReader { geo in
                let frame = ClimbFrame(
                    progress: motion.progress,
                    gait: motion.gait,
                    speed: motion.speed,
                    zoom: reduceMotion ? (close ? 2.5 : 1) : zoom,
                    sky: sky,
                    weather: weather,
                    status: status,
                    dots: dots,
                    selected: selected,
                    reduce: reduceMotion,
                    celebrate: status == .done && motion.progress > 0.98,
                    time: timeline.date.timeIntervalSinceReferenceDate,
                    climberX: climber.x,
                    climberY: climber.y,
                    climberTX: climber.tx,
                    climberTY: climber.ty,
                    outline: outline,
                    pulseIndex: nextIndex
                )
                Canvas { context, size in
                    drawClimb(context: &context, size: size, trail: trail, frame: frame)
                }
                .gesture(drag())
                .simultaneousGesture(
                    SpatialTapGesture().onEnded { event in
                        handleTap(event.location, size: geo.size, frame: frame)
                    }
                )
            }
        }
        .frame(height: 460)
        .clipShape(RoundedRectangle(cornerRadius: Brand.cardRadius, style: .continuous))
        .overlay(alignment: .topLeading) {
            hudPill(status: status).padding(12)
        }
        .overlay(alignment: .topTrailing) {
            viewSwitch.padding(12)
        }
        .overlay(alignment: .bottom) {
            hudFooter(status: status, weather: weather, night: sky.isNight)
                .padding(12)
                .allowsHitTesting(false)
        }
        .overlay(alignment: .top) {
            if status == .done {
                Text("Meta conquistada")
                    .font(.subheadline.weight(.bold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(.ultraThinMaterial)
                    .clipShape(Capsule())
                    .padding(.top, 56)
                    .allowsHitTesting(false)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Cena da meta, \(schedule.progressPercent) por cento, \(status.label)")
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
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
        .allowsHitTesting(false)
    }

    private func hudFooter(status: ClimbStatus, weather: EffectiveWeather, night: Bool) -> some View {
        VStack(spacing: 8) {
            if let selected, selected < schedule.slots.count {
                Text(selectionLine(selected))
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.ultraThinMaterial)
                    .clipShape(Capsule())
            }
            HStack {
                Text("\(WeatherAdjust.label(weather.kind)) · \(Int(weather.temperatureC.rounded()))°C")
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
        .foregroundStyle(night ? Color.white : Brand.ink)
    }

    private var viewSwitch: some View {
        HStack(spacing: 0) {
            viewButton("Visão geral", selected: !close) { setClose(false) }
            viewButton("De perto", selected: close) { setClose(true) }
        }
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
        .allowsHitTesting(true)
    }

    private func viewButton(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(title, action: action)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 10)
            .frame(minHeight: 32)
            .background(selected ? Brand.accent : Color.clear)
            .foregroundStyle(selected ? Color.white : Brand.ink)
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

    private var amountCents: Int {
        schedule.plan.remainingCents
    }

    private var remainingCents: Int {
        max(0, amountCents - schedule.savedCents)
    }

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

    private func milestoneDots(trail: SceneTrail, deposits: [ClimbDeposit]) -> [ClimbDot] {
        let count = deposits.count
        guard count > 1 else { return [] }
        return (0..<(count - 1)).map { index in
            let pose = trail.point(at: Double(index + 1) / Double(count))
            return ClimbDot(index: index, x: pose.x, y: pose.y, kind: deposits[index].status)
        }
    }

    private func motionSample(at date: Date, status: ClimbStatus) -> (progress: Double, gait: Double, speed: Double) {
        let target = Double(schedule.progressPercent) / 100
        if reduceMotion || target <= 0 {
            return (target, 0, 0)
        }
        let pace: Double
        switch status {
        case .onTrack: pace = 1
        case .nearLate: pace = 0.72
        case .late: pace = 0.48
        case .done: pace = 0.9
        }
        let cruiseTime = 2.4 / pace
        let easeTime = 0.85 / pace
        let elapsed = date.timeIntervalSince(started)
        if elapsed >= cruiseTime + easeTime {
            return (target, elapsed * 0.2, 0)
        }
        if elapsed < cruiseTime {
            let speed = target * 0.82 / cruiseTime
            return (speed * elapsed, elapsed * max(1.2, speed * 14), speed)
        }
        let u = (elapsed - cruiseTime) / easeTime
        let ease = 1 - pow(1 - u, 3)
        let speed = target * 0.18 * 3 * pow(1 - u, 2) / easeTime
        let progress = target * (0.82 + 0.18 * ease)
        return (progress, elapsed * max(0.4, speed * 14), speed)
    }

    private func setClose(_ value: Bool) {
        close = value
        Haptics.tap()
        if reduceMotion {
            zoom = value ? 2.5 : 1
            return
        }
        withAnimation(.spring(response: 0.55, dampingFraction: 0.84)) {
            zoom = value ? 2.5 : 1
        }
    }

    private func drag() -> some Gesture {
        DragGesture(minimumDistance: 28).onEnded { value in
            guard abs(value.translation.width) > abs(value.translation.height), abs(value.translation.width) > 36 else { return }
            setClose(value.translation.width < 0)
        }
    }

    private func handleTap(_ location: CGPoint, size: CGSize, frame: ClimbFrame) {
        let scene = scenePoint(location, size: size, frame: frame)
        if let dot = frame.dots.min(by: { hypot($0.x - scene.x, $0.y - scene.y) < hypot($1.x - scene.x, $1.y - scene.y) }),
           hypot(dot.x - scene.x, dot.y - scene.y) < 28 {
            selected = selected == dot.index ? nil : dot.index
            Haptics.tap()
            return
        }
        let climber = CGPoint(x: frame.climberX, y: frame.climberY)
        if hypot(climber.x - scene.x, climber.y - scene.y) < 36 {
            setClose(!close)
        }
    }

    private func scenePoint(_ location: CGPoint, size: CGSize, frame: ClimbFrame) -> CGPoint {
        let climber = viewPoint(frame.climberX, frame.climberY, size: size)
        let focus = cameraFocus(climber: climber, size: size, zoom: frame.zoom)
        let pivot = CGPoint(x: size.width / 2, y: size.height / 2)
        let zoom = max(frame.zoom, 0.01)
        let viewX = (location.x - pivot.x) / zoom + focus.x
        let viewY = (location.y - pivot.y) / zoom + focus.y
        return CGPoint(x: viewX / size.width * 520, y: viewY / size.height * 700)
    }

    private func viewPoint(_ x: Double, _ y: Double, size: CGSize) -> CGPoint {
        CGPoint(x: x / 520 * size.width, y: y / 700 * size.height)
    }
}

private struct ClimbDot: Sendable {
    var index: Int
    var x: Double
    var y: Double
    var kind: DepositStatus
}

private struct ClimbFrame: Sendable {
    var progress: Double
    var gait: Double
    var speed: Double
    var zoom: Double
    var sky: SkySample
    var weather: EffectiveWeather
    var status: ClimbStatus
    var dots: [ClimbDot]
    var selected: Int?
    var reduce: Bool
    var celebrate: Bool
    var time: Double
    var climberX: Double
    var climberY: Double
    var climberTX: Double
    var climberTY: Double
    var outline: [TrailPoint]
    var pulseIndex: Int?
}

private func drawClimb(context: inout GraphicsContext, size: CGSize, trail: SceneTrail, frame: ClimbFrame) {
    let climberView = CGPoint(x: frame.climberX / 520 * size.width, y: frame.climberY / 700 * size.height)
    applyCamera(context: &context, size: size, climber: climberView, zoom: frame.zoom)

    let rect = CGRect(x: -size.width, y: -size.height, width: size.width * 3, height: size.height * 3)
    context.fill(
        Path(rect),
        with: .linearGradient(
            Gradient(colors: [rgb(frame.sky.top), rgb(frame.sky.bottom)]),
            startPoint: CGPoint(x: size.width / 2, y: 0),
            endPoint: CGPoint(x: size.width / 2, y: size.height)
        )
    )
    if frame.sky.starsOpacity > 0.05 {
        for index in 0..<18 {
            let sx = CGFloat((index * 47) % 100) / 100 * size.width
            let sy = CGFloat((index * 29) % 55) / 100 * size.height
            let star = Path(ellipseIn: CGRect(x: sx, y: sy, width: 2, height: 2))
            context.fill(star, with: .color(Color.white.opacity(frame.sky.starsOpacity)))
        }
    }
    let body = CGPoint(x: frame.sky.bodyX / 100 * size.width, y: frame.sky.bodyY / 100 * size.height)
    let bodyOpacity = frame.sky.isNight ? frame.sky.moonOpacity : frame.sky.sunOpacity
    if bodyOpacity > 0.05 {
        let glow = Path(ellipseIn: CGRect(x: body.x - 18, y: body.y - 18, width: 36, height: 36))
        context.fill(glow, with: .color((frame.sky.isNight ? Color.white : Color.yellow).opacity(bodyOpacity)))
    }
    drawWeather(context: &context, size: size, frame: frame)
    var mountain = Path()
    if let first = frame.outline.first {
        mountain.move(to: viewPoint(first, size: size))
        for point in frame.outline.dropFirst() {
            mountain.addLine(to: viewPoint(point, size: size))
        }
        mountain.closeSubpath()
        context.fill(mountain, with: .color(rgb(frame.sky.mountainFill)))
        context.stroke(mountain, with: .color(.black), lineWidth: 2.5)
    }
    let steps = 72
    var traveled = Path()
    var rest = Path()
    for step in 0...steps {
        let u = Double(step) / Double(steps)
        let pose = trail.point(at: u)
        let point = viewPoint(pose.x, pose.y, size: size)
        if u <= frame.progress {
            if traveled.isEmpty { traveled.move(to: point) } else { traveled.addLine(to: point) }
        } else {
            if rest.isEmpty { rest.move(to: point) } else { rest.addLine(to: point) }
        }
    }
    context.stroke(traveled, with: .color(Color(red: 0, green: 113 / 255, blue: 227 / 255)), lineWidth: 4)
    context.stroke(
        rest,
        with: .color(Color(red: 0, green: 113 / 255, blue: 227 / 255).opacity(0.85)),
        style: StrokeStyle(lineWidth: 2.5, lineCap: .round, dash: [7, 6])
    )
    let start = trail.point(at: 0)
    let startLabel = context.resolve(Text("Início").font(.caption2.weight(.semibold)).foregroundStyle(.black))
    context.draw(startLabel, at: viewPoint(start.x, start.y + 18, size: size), anchor: .top)
    for dot in frame.dots {
        let pulse = !frame.reduce && frame.pulseIndex == dot.index
        let scale = pulse ? 1 + 0.16 * sin(frame.time * 4) : 1
        drawDot(context: &context, at: viewPoint(dot.x, dot.y, size: size), kind: dot.kind, scale: scale)
    }
    if frame.celebrate {
        let peak = trail.point(at: 1)
        let glow = Path(ellipseIn: CGRect(x: peak.x / 520 * size.width - 22, y: peak.y / 700 * size.height - 22, width: 44, height: 44))
        context.fill(glow, with: .color(Color.yellow.opacity(0.55)))
        if !frame.reduce {
            drawConfetti(context: &context, size: size, time: frame.time)
        }
    }
    var climberContext = context
    drawClimber(context: &climberContext, size: size, frame: frame)
    if !frame.closeEnoughToHidePercent {
        let percent = context.resolve(
            Text("\(Int((frame.progress * 100).rounded()))%")
                .font(.caption.weight(.bold))
                .foregroundStyle(.black)
        )
        context.draw(percent, at: CGPoint(x: climberView.x, y: climberView.y - 36), anchor: .bottom)
    }
}

private extension ClimbFrame {
    var closeEnoughToHidePercent: Bool { zoom > 1.4 }
}

private func drawDot(context: inout GraphicsContext, at point: CGPoint, kind: DepositStatus, scale: Double) {
    let radius = 7 * scale
    let rect = CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)
    switch kind {
    case .paidOnTime:
        context.fill(Path(ellipseIn: rect), with: .color(Color(red: 48 / 255, green: 209 / 255, blue: 88 / 255)))
    case .paidLate:
        context.fill(Path(ellipseIn: rect), with: .color(Color(red: 1, green: 204 / 255, blue: 0)))
    case .missed:
        context.stroke(Path(ellipseIn: rect), with: .color(Color(red: 1, green: 69 / 255, blue: 58 / 255)), lineWidth: 2)
        var cross = Path()
        cross.move(to: CGPoint(x: point.x - 4, y: point.y - 4))
        cross.addLine(to: CGPoint(x: point.x + 4, y: point.y + 4))
        cross.move(to: CGPoint(x: point.x + 4, y: point.y - 4))
        cross.addLine(to: CGPoint(x: point.x - 4, y: point.y + 4))
        context.stroke(cross, with: .color(Color(red: 1, green: 69 / 255, blue: 58 / 255)), lineWidth: 1.6)
    case .pending:
        context.fill(Path(ellipseIn: rect), with: .color(.white))
        context.stroke(Path(ellipseIn: rect), with: .color(Color(red: 0, green: 113 / 255, blue: 227 / 255)), lineWidth: 2)
    }
}

private func drawClimber(context: inout GraphicsContext, size: CGSize, frame: ClimbFrame) {
    let point = CGPoint(x: frame.climberX / 520 * size.width, y: frame.climberY / 700 * size.height)
    let slope = atan2(frame.climberTY, frame.climberTX)
    var foothold = Path(roundedRect: CGRect(x: -10, y: -3, width: 20, height: 6), cornerRadius: 3)
    let placed = CGAffineTransform(rotationAngle: slope)
        .concatenating(CGAffineTransform(translationX: point.x, y: point.y + 10))
    foothold = foothold.applying(placed)
    context.fill(foothold, with: .color(Color.black.opacity(0.55)))
    let lean: Double
    switch frame.status {
    case .late: lean = 0.38
    case .nearLate: lean = 0.16
    case .onTrack, .done: lean = 0
    }
    let swing = sin(frame.gait) * min(10, 4 + frame.speed * 40)
    context.translateBy(x: point.x, y: point.y)
    context.rotate(by: .radians(lean))
    let head = Path(ellipseIn: CGRect(x: -5, y: -28, width: 10, height: 10))
    context.fill(head, with: .color(.black))
    var body = Path()
    body.move(to: CGPoint(x: 0, y: -18))
    body.addLine(to: CGPoint(x: 0, y: -2))
    context.stroke(body, with: .color(.black), lineWidth: 2.4)
    let armsUp = frame.celebrate
    var limbs = Path()
    if armsUp {
        limbs.move(to: CGPoint(x: 0, y: -14))
        limbs.addLine(to: CGPoint(x: -8, y: -26))
        limbs.move(to: CGPoint(x: 0, y: -14))
        limbs.addLine(to: CGPoint(x: 8, y: -26))
    } else {
        limbs.move(to: CGPoint(x: 0, y: -14))
        limbs.addLine(to: CGPoint(x: -7, y: -8 + swing * 0.3))
        limbs.move(to: CGPoint(x: 0, y: -14))
        limbs.addLine(to: CGPoint(x: 7, y: -8 - swing * 0.3))
    }
    limbs.move(to: CGPoint(x: 0, y: -2))
    limbs.addLine(to: CGPoint(x: -6, y: 10 + swing))
    limbs.move(to: CGPoint(x: 0, y: -2))
    limbs.addLine(to: CGPoint(x: 6, y: 10 - swing))
    context.stroke(limbs, with: .color(.black), style: StrokeStyle(lineWidth: 2.2, lineCap: .round))
}

private func drawWeather(context: inout GraphicsContext, size: CGSize, frame: ClimbFrame) {
    let kind = frame.weather.kind
    let count = kind == .storm || kind == .blizzard ? 28 : 16
    guard kind == .rain || kind == .storm || kind == .snow || kind == .blizzard else { return }
    let wind = frame.weather.wind * 18
    for index in 0..<count {
        let baseX = CGFloat((index * 37) % 110) / 100 * size.width
        let shift = CGFloat(frame.time * (8 + wind) + Double(index * 20)).truncatingRemainder(dividingBy: size.height + 40)
        let x = baseX + CGFloat(wind) * 0.4
        let y = shift - 20
        if kind == .snow || kind == .blizzard {
            let flake = Path(ellipseIn: CGRect(x: x, y: y, width: 4, height: 4))
            context.fill(flake, with: .color(Color.white.opacity(0.85)))
        } else {
            var drop = Path()
            drop.move(to: CGPoint(x: x, y: y))
            drop.addLine(to: CGPoint(x: x - CGFloat(wind) * 0.15, y: y + 12))
            context.stroke(drop, with: .color(Color.white.opacity(kind == .storm ? 0.45 : 0.7)), lineWidth: 1.4)
        }
    }
}

private func drawConfetti(context: inout GraphicsContext, size: CGSize, time: Double) {
    let colors: [Color] = [.red, .yellow, .green, .blue, .orange, .pink]
    for index in 0..<24 {
        let x = CGFloat((sin(time * 0.7 + Double(index)) * 0.5 + 0.5)) * size.width
        let y = CGFloat((time * 40 + Double(index * 28)).truncatingRemainder(dividingBy: Double(size.height)))
        let rect = CGRect(x: x, y: y, width: 6, height: 8)
        context.fill(Path(rect), with: .color(colors[index % colors.count]))
    }
}

private func applyCamera(context: inout GraphicsContext, size: CGSize, climber: CGPoint, zoom: Double) {
    let focus = cameraFocus(climber: climber, size: size, zoom: zoom)
    let pivot = CGPoint(x: size.width / 2, y: size.height / 2)
    context.translateBy(x: pivot.x, y: pivot.y)
    context.scaleBy(x: zoom, y: zoom)
    context.translateBy(x: -focus.x, y: -focus.y)
}

private func cameraFocus(climber: CGPoint, size: CGSize, zoom: Double) -> CGPoint {
    let blend = min(1, max(0, (zoom - 1) / 1.5))
    return CGPoint(
        x: size.width / 2 + (climber.x - size.width / 2) * blend,
        y: size.height / 2 + (climber.y - size.height / 2) * blend
    )
}

private func viewPoint(_ point: TrailPoint, size: CGSize) -> CGPoint {
    viewPoint(point.x, point.y, size: size)
}

private func viewPoint(_ x: Double, _ y: Double, size: CGSize) -> CGPoint {
    CGPoint(x: x / 520 * size.width, y: y / 700 * size.height)
}

private func rgb(_ color: RGBColor) -> Color {
    Color(red: color.red / 255, green: color.green / 255, blue: color.blue / 255)
}
