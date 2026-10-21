import Foundation

public struct RGBColor: Equatable, Sendable {
    public var red: Double
    public var green: Double
    public var blue: Double

    public init(red: Double, green: Double, blue: Double) {
        self.red = red
        self.green = green
        self.blue = blue
    }
}

/// Ritmo do foguete por saúde: em dia rápido e firme, quase atrasada mais lento com balanço, atrasada com turbulência.
public struct RocketMotionProfile: Equatable, Sendable {
    public var pace: Double
    public var wobble: Double
    public var turbulence: Double

    public static func from(_ status: ClimbStatus) -> RocketMotionProfile {
        switch status {
        case .onTrack: RocketMotionProfile(pace: 1, wobble: 0, turbulence: 0)
        case .nearLate: RocketMotionProfile(pace: 0.72, wobble: 0.5, turbulence: 0.15)
        case .late: RocketMotionProfile(pace: 0.48, wobble: 0.8, turbulence: 1)
        case .done: RocketMotionProfile(pace: 0.9, wobble: 0, turbulence: 0)
        }
    }

    public static let cruiseSeconds = 2.4
    /// Parada cúbica que começa na mesma velocidade do cruzeiro (sem tranco), como no site.
    public static let easeSeconds = cruiseSeconds * 0.18 * 3 / 0.82

    /// Tempo total da viagem até parar.
    public var duration: Double { (RocketMotionProfile.cruiseSeconds + RocketMotionProfile.easeSeconds) / pace }

    /// Progresso, velocidade e intensidade da chama em `elapsed` segundos: cruzeiro constante e parada suave.
    public func sample(target: Double, elapsed: Double) -> (progress: Double, speed: Double, flame: Double) {
        let target = max(0, min(1, target))
        guard target > 0, elapsed > 0 else { return (elapsed > 0 ? target : 0, 0, 0) }
        let cruise = RocketMotionProfile.cruiseSeconds / pace
        let ease = RocketMotionProfile.easeSeconds / pace
        if elapsed >= cruise + ease { return (target, 0, 0) }
        let cruiseSpeed = target * 0.82 / cruise
        let maxSpeed = 0.82 / cruise
        if elapsed < cruise {
            return (cruiseSpeed * elapsed, cruiseSpeed, min(1, cruiseSpeed / max(maxSpeed, 0.0001)))
        }
        let u = (elapsed - cruise) / ease
        let speed = target * 0.18 * 3 * pow(1 - u, 2) / ease
        return (target * (0.82 + 0.18 * (1 - pow(1 - u, 3))), speed, min(1, speed / max(maxSpeed, 0.0001)))
    }
}

public struct RocketPose: Equatable, Sendable {
    public var x: Double
    public var y: Double
    /// Ângulo da tangente em radianos (0 = para a direita).
    public var angle: Double
}

/// Rota curva da Terra (embaixo, à esquerda) até o planeta anelado (em cima, à direita), no espaço 520×700.
public struct RocketRoute: Sendable {
    public static let earth = (x: 110.0, y: 610.0)
    public static let planet = (x: 395.0, y: 135.0)
    private let samples: [(x: Double, y: Double, len: Double)]
    public let length: Double

    public init(steps: Int = 240) {
        let p0 = RocketRoute.earth, p3 = RocketRoute.planet
        let p1 = (x: 470.0, y: 520.0), p2 = (x: 40.0, y: 250.0)
        var out: [(x: Double, y: Double, len: Double)] = []
        var total = 0.0
        for i in 0...steps {
            let t = Double(i) / Double(steps), m = 1 - t
            let x = m * m * m * p0.x + 3 * m * m * t * p1.x + 3 * m * t * t * p2.x + t * t * t * p3.x
            let y = m * m * m * p0.y + 3 * m * m * t * p1.y + 3 * m * t * t * p2.y + t * t * t * p3.y
            if let last = out.last { total += hypot(x - last.x, y - last.y) }
            out.append((x, y, total))
        }
        samples = out
        length = total
    }

    public func point(at progress: Double) -> RocketPose {
        let target = max(0, min(1, progress)) * length
        var lo = 0, hi = samples.count - 1
        while hi - lo > 1 {
            let mid = (lo + hi) >> 1
            if samples[mid].len < target { lo = mid } else { hi = mid }
        }
        let a = samples[lo], b = samples[hi]
        let span = b.len - a.len
        let u = span == 0 ? 0 : (target - a.len) / span
        let a2 = samples[max(0, lo - 1)], b2 = samples[min(samples.count - 1, hi + 1)]
        return RocketPose(x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, angle: atan2(b2.y - a2.y, b2.x - a2.x))
    }

    /// Uma estação por aporte, exceto o último (que é o próprio planeta).
    public func stations(count: Int) -> [RocketPose] {
        guard count > 1 else { return [] }
        return (1..<count).map { point(at: Double($0) / Double(count)) }
    }

    public func polyline(to progress: Double = 1) -> [(x: Double, y: Double)] {
        let limit = max(0, min(1, progress)) * length
        var pts = samples.filter { $0.len <= limit }.map { (x: $0.x, y: $0.y) }
        let end = point(at: progress)
        pts.append((end.x, end.y))
        return pts
    }
}

/// Tom de nebulosa conforme a hora local (madrugada roxa, dia azul profundo, entardecer magenta).
public enum NebulaTint {
    public static func colors(hour: Double) -> (top: RGBColor, bottom: RGBColor, glow: RGBColor) {
        let h = hour.truncatingRemainder(dividingBy: 24)
        switch h {
        case 6..<17:
            return (RGBColor(red: 8, green: 18, blue: 52), RGBColor(red: 22, green: 54, blue: 128), RGBColor(red: 64, green: 140, blue: 255))
        case 17..<20:
            return (RGBColor(red: 24, green: 10, blue: 48), RGBColor(red: 92, green: 30, blue: 96), RGBColor(red: 255, green: 110, blue: 160))
        default:
            return (RGBColor(red: 4, green: 4, blue: 18), RGBColor(red: 28, green: 16, blue: 70), RGBColor(red: 140, green: 90, blue: 255))
        }
    }
}
