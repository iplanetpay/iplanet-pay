import IPlanetCore
import SwiftUI

struct ContributionCalendarView: View {
    let data: GoalCalendarData
    var today: String = CivilDate.calendarToday()
    @State private var monthIndex = 0
    @State private var showAll = false

    var body: some View {
        let dates = data.dues.map(\.date)
        let months = GoalCalendarMath.planMonthKeys(dates)
        let index = months.isEmpty ? 0 : min(monthIndex, months.count - 1)
        let visible = showAll || months.count <= 1 ? months : [months[index]]
        let marks = Dictionary(uniqueKeysWithValues: data.marks.map { ($0.date, $0.marks) })
        BrandCard {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Meta")
                            .font(.caption.weight(.semibold))
                            .tracking(1.2)
                            .foregroundStyle(Brand.accent)
                            .textCase(.uppercase)
                        Text(data.goalName)
                            .font(.title2.weight(.bold))
                        Text(summary)
                            .font(.subheadline)
                            .foregroundStyle(Brand.inkMuted)
                    }
                    Spacer(minLength: 8)
                    StatusPill(text: data.health.label, tone: tone(data.health))
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text(data.heroLabel ?? "Valor por aporte · \(PlanCopy.periodLabel(data.frequency))")
                        .font(.caption.weight(.semibold))
                        .tracking(1.1)
                        .foregroundStyle(Brand.accent)
                        .textCase(.uppercase)
                    Text(Money.format(cents: data.heroCents))
                        .font(.largeTitle.weight(.bold))
                        .contentTransition(.numericText())
                    Text(PlanCopy.calendarPayoff(health: data.health, dues: data.dues))
                        .font(.headline)
                        .foregroundStyle(Brand.accent)
                    if data.lastCents != data.heroCents {
                        Text("O último aporte fica em \(Money.format(cents: data.lastCents)).")
                            .font(.subheadline)
                            .foregroundStyle(Brand.inkMuted)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Brand.backgroundSubtle)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                legend
                if months.count > 1 {
                    HStack {
                        if !showAll {
                            pageButton("Mês anterior", delta: -1, index: index, count: months.count)
                            pageButton("Próximo mês", delta: 1, index: index, count: months.count)
                        }
                        Spacer()
                        Button(showAll ? "Mostrar um mês" : "Mostrar todos") {
                            withAnimation(.spring(response: 0.45, dampingFraction: 0.86)) {
                                showAll.toggle()
                            }
                        }
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 14)
                        .frame(minHeight: 40)
                        .background(Brand.accent)
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                    }
                }
                ForEach(visible, id: \.self) { month in
                    monthGrid(month, marks: marks)
                }
                VStack(spacing: 8) {
                    ForEach(data.dues, id: \.date) { due in
                        HStack {
                            Text(PlanCopy.longDate(due.date))
                                .font(.subheadline.weight(.semibold))
                            Spacer()
                            VStack(alignment: .trailing, spacing: 2) {
                                Text(Money.format(cents: due.amountCents))
                                    .font(.subheadline)
                                    .foregroundStyle(Brand.inkMuted)
                                Text(statusLine(due))
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(statusColor(due.status))
                            }
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Brand.background)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(Brand.line, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                }
            }
        }
        .onAppear { align(months) }
        .onChange(of: months) { _, months in align(months) }
    }

    private var summary: String {
        let noun = data.installmentCount == 1 ? "aporte" : "aportes"
        return "\(data.installmentCount) \(noun) \(PlanCopy.rhythmLabel(data.frequency, count: data.installmentCount)) até \(PlanCopy.longDate(data.deadline))"
    }

    private var legend: some View {
        VStack(alignment: .leading, spacing: 8) {
            legendRow(mark: .ring, title: "Data do aporte")
            legendRow(mark: .check, title: "No prazo")
            legendRow(mark: .cross, title: "Pago atrasado")
            legendRow(mark: .yellow, title: "Dia do pagamento")
            legendRow(mark: .late, title: "Dia em atraso")
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(Brand.inkMuted)
    }

    private enum LegendMark {
        case ring, check, cross, yellow, late
    }

    private func legendRow(mark: LegendMark, title: String) -> some View {
        HStack(spacing: 8) {
            legendGlyph(mark)
            Text(title)
        }
    }

    @ViewBuilder
    private func legendGlyph(_ mark: LegendMark) -> some View {
        switch mark {
        case .ring:
            Circle().stroke(Brand.accent, lineWidth: 2).frame(width: 14, height: 14)
        case .check:
            Image(systemName: "checkmark").font(.caption.weight(.bold)).foregroundStyle(Brand.success)
        case .cross:
            Image(systemName: "xmark").font(.caption.weight(.bold)).foregroundStyle(Brand.danger)
        case .yellow:
            Circle().fill(Color(red: 224 / 255, green: 161 / 255, blue: 0)).frame(width: 8, height: 8)
        case .late:
            Circle().fill(Brand.danger).frame(width: 8, height: 8)
        }
    }

    private func pageButton(_ title: String, delta: Int, index: Int, count: Int) -> some View {
        let disabled = delta < 0 ? index <= 0 : index >= count - 1
        return Button(title) {
            monthIndex = GoalCalendarMath.stepMonthIndex(index, delta: delta, count: count)
        }
        .font(.subheadline.weight(.semibold))
        .padding(.horizontal, 14)
        .frame(minHeight: 40)
        .background(Brand.background)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(Brand.line, lineWidth: 1))
        .disabled(disabled)
        .opacity(disabled ? 0.4 : 1)
    }

    private func monthGrid(_ key: String, marks: [String: [CalendarMark]]) -> some View {
        let parts = key.split(separator: "-")
        let year = Int(parts.first ?? "") ?? 0
        let month = Int(parts.dropFirst().first ?? "") ?? 1
        let cells = GoalScheduleMath.monthCells(year: year, month: month)
        return VStack(alignment: .leading, spacing: 8) {
            Text(PlanCopy.monthTitle(year: year, month: month))
                .font(.subheadline.weight(.semibold))
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 4) {
                ForEach(PlanCopy.weekdays, id: \.self) { day in
                    Text(day)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Brand.inkMuted)
                        .textCase(.uppercase)
                        .frame(maxWidth: .infinity)
                }
                ForEach(Array(cells.enumerated()), id: \.offset) { _, iso in
                    dayCell(iso, marks: iso.flatMap { marks[$0] } ?? [])
                }
            }
        }
    }

    private func dayCell(_ iso: String?, marks: [CalendarMark]) -> some View {
        let day = iso.flatMap { Int($0.suffix(2)) }
        return ZStack {
            if marks.isEmpty {
                Text(day.map { String($0) } ?? "")
                    .font(.caption)
                    .foregroundStyle(Brand.inkMuted)
            } else {
                cellFace(day: day, marks: marks)
                if marks.contains(.missed) {
                    Circle()
                        .fill(Brand.danger)
                        .frame(width: 5, height: 5)
                        .offset(y: 12)
                }
                if marks.contains(.latePaid) {
                    Circle()
                        .fill(Color(red: 224 / 255, green: 161 / 255, blue: 0))
                        .frame(width: 5, height: 5)
                        .offset(x: 12, y: -12)
                }
            }
        }
        .frame(height: 36)
        .accessibilityLabel(iso.map { accessibility($0, marks: marks) } ?? "")
    }

    @ViewBuilder
    private func cellFace(day: Int?, marks: [CalendarMark]) -> some View {
        let ring = marks.contains(.due) || marks.contains(.upcoming)
        let missed = marks.contains(.missed)
        let paidLateDay = marks.contains(.latePaid)
        ZStack {
            if ring {
                Circle().stroke(Brand.accent, lineWidth: 2)
            } else if missed {
                Circle().fill(Brand.danger.opacity(0.12))
            } else if paidLateDay {
                Circle().fill(Color(red: 1, green: 246 / 255, blue: 224 / 255))
            }
            if marks.contains(.onTime) {
                Image(systemName: "checkmark")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Brand.success)
            } else if marks.contains(.lateDue) {
                Image(systemName: "xmark")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Brand.danger)
            } else {
                Text(day.map { String($0) } ?? "")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(missed && !ring ? Brand.danger : Brand.ink)
            }
        }
    }

    private func accessibility(_ iso: String, marks: [CalendarMark]) -> String {
        let names = marks.map { mark -> String in
            switch mark {
            case .due: "data do aporte"
            case .upcoming: "a aportar"
            case .onTime: "no prazo"
            case .lateDue: "pago atrasado"
            case .latePaid: "dia do pagamento"
            case .missed: "dia em atraso"
            }
        }
        return "\(PlanCopy.longDate(iso)), \(names.joined(separator: ", "))"
    }

    private func statusLine(_ due: GoalCalendarDue) -> String {
        if let note = due.note, !note.isEmpty {
            return "\(note) · \(due.status.label)"
        }
        return due.status.label
    }

    private func statusColor(_ status: InstallmentStatus) -> Color {
        switch status {
        case .onTime: Brand.success
        case .latePayment: Color(red: 138 / 255, green: 90 / 255, blue: 0)
        case .missed: Brand.danger
        case .upcoming: Brand.accent
        }
    }

    private func tone(_ health: GoalHealth) -> StatusPill.PillTone {
        switch health {
        case .onTrack: .accent
        case .nearLate: .neutral
        case .late: .danger
        case .complete: .success
        }
    }

    private func align(_ months: [String]) {
        let upcoming = data.dues.first { $0.status == .upcoming }?.date
        monthIndex = GoalCalendarMath.defaultMonthIndex(months: months, today: today, upcomingDate: upcoming)
    }
}
