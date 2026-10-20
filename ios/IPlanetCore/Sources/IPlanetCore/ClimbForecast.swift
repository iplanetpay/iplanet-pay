import Foundation

public enum ForecastKind: String, Sendable, CaseIterable {
    case clear
    case partlyCloudy
    case cloudy
    case fog
    case rain
    case storm
    case snow
    case blizzard
}

public struct Forecast: Equatable, Sendable {
    public var kind: ForecastKind
    public var temperatureC: Double
    public var windKmh: Double
    public var localHour: Double
    public var sunrise: Double
    public var sunset: Double

    public init(
        kind: ForecastKind,
        temperatureC: Double,
        windKmh: Double,
        localHour: Double,
        sunrise: Double,
        sunset: Double
    ) {
        self.kind = kind
        self.temperatureC = temperatureC
        self.windKmh = windKmh
        self.localHour = localHour
        self.sunrise = sunrise
        self.sunset = sunset
    }

    public static let saoPaulo = Forecast(
        kind: .partlyCloudy,
        temperatureC: 22,
        windKmh: 12,
        localHour: 14,
        sunrise: 5.9,
        sunset: 17.9
    )
}

public struct EffectiveWeather: Equatable, Sendable {
    public var kind: ForecastKind
    public var intensity: Double
    public var wind: Double
    public var temperatureC: Double
}

public struct RGBColor: Equatable, Sendable {
    public var red: Double
    public var green: Double
    public var blue: Double
}

public struct SkySample: Equatable, Sendable {
    public var top: RGBColor
    public var bottom: RGBColor
    public var light: Double
    public var isNight: Bool
    public var starsOpacity: Double
    public var sunOpacity: Double
    public var moonOpacity: Double
    public var bodyX: Double
    public var bodyY: Double
    public var mountainFill: RGBColor
    public var overcast: Double
}

public struct TrailPose: Equatable, Sendable {
    public var x: Double
    public var y: Double
    public var tx: Double
    public var ty: Double
}

public struct SceneTrail: Sendable {
    public var samples: [(x: Double, y: Double, len: Double)]
    public var length: Double

    public func point(at progress: Double) -> TrailPose {
        let target = max(0, min(1, progress)) * length
        guard samples.count >= 2 else {
            let only = samples.first
            return TrailPose(x: only?.x ?? 0, y: only?.y ?? 0, tx: 0, ty: -1)
        }
        var lo = 0
        var hi = samples.count - 1
        while hi - lo > 1 {
            let mid = (lo + hi) >> 1
            if samples[mid].len < target { lo = mid } else { hi = mid }
        }
        let a = samples[lo]
        let b = samples[hi]
        let span = b.len - a.len
        let u = span == 0 ? 0 : (target - a.len) / span
        let a2 = samples[max(0, lo - 2)]
        let b2 = samples[min(samples.count - 1, hi + 2)]
        let dx = b2.x - a2.x
        let dy = b2.y - a2.y
        let dl = max(1, hypot(dx, dy))
        return TrailPose(
            x: a.x + (b.x - a.x) * u,
            y: a.y + (b.y - a.y) * u,
            tx: dx / dl,
            ty: dy / dl
        )
    }
}

public enum WeatherAdjust {
    public static func wmoKind(_ code: Int) -> ForecastKind {
        if code == 0 { return .clear }
        if code <= 2 { return .partlyCloudy }
        if code == 3 { return .cloudy }
        if code == 45 || code == 48 { return .fog }
        if code >= 51 && code <= 67 { return .rain }
        if code >= 71 && code <= 77 { return .snow }
        if code >= 80 && code <= 82 { return .rain }
        if code == 85 { return .snow }
        if code == 86 { return .blizzard }
        if code >= 95 { return .storm }
        return .cloudy
    }

    public static func label(_ kind: ForecastKind) -> String {
        switch kind {
        case .clear: "Ensolarado"
        case .partlyCloudy: "Parcialmente nublado"
        case .cloudy: "Nublado"
        case .fog: "Neblina"
        case .rain: "Chuva"
        case .storm: "Tempestade"
        case .snow: "Neve"
        case .blizzard: "Nevasca"
        }
    }

    /// On track and done stay pleasant. Near late steps one notch worse. Late becomes a storm, or a blizzard when it is already wet or cold.
    public static func effective(_ real: Forecast, status: ClimbStatus) -> EffectiveWeather {
        let wind = min(1, real.windKmh / 60)
        switch status {
        case .onTrack, .done:
            let kind: ForecastKind = real.kind == .clear ? .clear : .partlyCloudy
            return EffectiveWeather(
                kind: status == .done ? .clear : kind,
                intensity: 0,
                wind: min(0.25, wind),
                temperatureC: real.temperatureC
            )
        case .nearLate:
            let stepped = stepDown(real.kind)
            return EffectiveWeather(
                kind: stepped.kind,
                intensity: stepped.intensity,
                wind: max(0.45, wind),
                temperatureC: real.temperatureC
            )
        case .late:
            let wet = real.kind == .rain || real.kind == .snow || real.kind == .blizzard || real.temperatureC <= 1
            return EffectiveWeather(
                kind: wet ? .blizzard : .storm,
                intensity: 1,
                wind: max(0.9, wind),
                temperatureC: min(real.temperatureC, 6)
            )
        }
    }

    private static func stepDown(_ kind: ForecastKind) -> (kind: ForecastKind, intensity: Double) {
        switch kind {
        case .clear: (.partlyCloudy, 0)
        case .partlyCloudy: (.cloudy, 0)
        case .cloudy: (.rain, 0.35)
        case .fog: (.rain, 0.35)
        case .rain: (.rain, 0.75)
        case .storm: (.storm, 0.7)
        case .snow: (.snow, 0.7)
        case .blizzard: (.blizzard, 0.7)
        }
    }
}

public enum SkyMath {
    public static func compute(hour: Double, sunrise: Double, sunset: Double, kind: ForecastKind) -> SkySample {
        let light = smooth(sunrise - 0.6, sunrise + 0.6, hour) * (1 - smooth(sunset - 0.6, sunset + 0.6, hour))
        let dusk = max(bump(hour, sunrise), bump(hour, sunset))
        let overcast = overcastAmount(kind)
        var top = mix(hex(0x10, 0x16, 0x2e), hex(0xbc, 0xd9, 0xfb), light)
        var bottom = mix(hex(0x22, 0x2c, 0x52), hex(0xf4, 0xf9, 0xff), light)
        top = mix(top, hex(0xb8, 0xc4, 0xee), dusk * 0.5)
        bottom = mix(bottom, hex(0xff, 0xe0, 0xcc), dusk * 0.75)
        let stormy = kind == .storm
        let snowy = kind == .blizzard || kind == .snow
        let grayTop = mix(
            hex(0x18, 0x1d, 0x30),
            stormy ? hex(0x7d, 0x85, 0x94) : snowy ? hex(0xb9, 0xc1, 0xcd) : hex(0xb4, 0xbc, 0xc8),
            light
        )
        let grayBottom = mix(
            hex(0x26, 0x2d, 0x46),
            stormy ? hex(0xb5, 0xbb, 0xc6) : snowy ? hex(0xe3, 0xe7, 0xee) : hex(0xe0, 0xe4, 0xea),
            light
        )
        top = mix(top, grayTop, overcast)
        bottom = mix(bottom, grayBottom, overcast)
        let isDay = hour >= sunrise && hour <= sunset
        var u: Double
        if isDay {
            u = (hour - sunrise) / (sunset - sunrise)
        } else {
            let nightLength = 24 - (sunset - sunrise)
            let since = hour >= sunset ? hour - sunset : hour + 24 - sunset
            u = since / nightLength
        }
        u = max(0, min(1, u))
        var fill = mix(hex(0xe6, 0xea, 0xf4), hex(0xff, 0xff, 0xff), light)
        fill = mix(fill, hex(stormy ? 0xcd : 0xe3, stormy ? 0xd2 : 0xe7, stormy ? 0xdb : 0xee), overcast * 0.7)
        return SkySample(
            top: top,
            bottom: bottom,
            light: light,
            isNight: light < 0.35,
            starsOpacity: max(0, min(1, pow(1 - light, 1.5) * (1 - overcast * 1.15))),
            sunOpacity: max(0, min(1, light * (1 - overcast * 1.25))),
            moonOpacity: max(0, min(1, (1 - light) * (1 - overcast * 1.1))),
            bodyX: 12 + 76 * u,
            bodyY: 62 - 46 * sin(Double.pi * u),
            mountainFill: fill,
            overcast: overcast
        )
    }

    private static func overcastAmount(_ kind: ForecastKind) -> Double {
        switch kind {
        case .clear: 0
        case .partlyCloudy: 0.18
        case .cloudy: 0.55
        case .fog: 0.5
        case .rain: 0.72
        case .storm: 0.92
        case .snow: 0.62
        case .blizzard: 0.82
        }
    }

    private static func bump(_ hour: Double, _ center: Double) -> Double {
        let delta = (hour - center) / 0.9
        return exp(-(delta * delta))
    }

    private static func smooth(_ a: Double, _ b: Double, _ x: Double) -> Double {
        guard b != a else { return x >= b ? 1 : 0 }
        let t = max(0, min(1, (x - a) / (b - a)))
        return t * t * (3 - 2 * t)
    }

    private static func hex(_ r: Double, _ g: Double, _ b: Double) -> RGBColor {
        RGBColor(red: r, green: g, blue: b)
    }

    private static func mix(_ a: RGBColor, _ b: RGBColor, _ t: Double) -> RGBColor {
        RGBColor(
            red: a.red + (b.red - a.red) * t,
            green: a.green + (b.green - a.green) * t,
            blue: a.blue + (b.blue - a.blue) * t
        )
    }
}

public enum ClimbSceneMath {
    public static func portraitTrail() -> SceneTrail {
        trail(width: 520, height: 700, scale: 0.7, portrait: true)
    }

    public static func portraitOutline() -> [TrailPoint] {
        outline(width: 520, height: 700, portrait: true)
    }

    private static func trail(width: Double, height: Double, scale: Double, portrait: Bool) -> SceneTrail {
        let points = scalePoints(trailNormalized, width: width, height: height, portrait: portrait)
        let radius = 26 * scale
        var segments: [Segment] = []
        var current = points[0]
        if points.count >= 3 {
            for index in 1..<(points.count - 1) {
                let a = points[index - 1]
                let b = points[index]
                let c = points[index + 1]
                let lab = max(0.001, hypot(b.x - a.x, b.y - a.y))
                let lbc = max(0.001, hypot(c.x - b.x, c.y - b.y))
                let rr = min(radius, lab * 0.45, lbc * 0.45)
                let p1 = TrailPoint(
                    x: b.x + ((a.x - b.x) / lab) * rr,
                    y: b.y + ((a.y - b.y) / lab) * rr
                )
                let p2 = TrailPoint(
                    x: b.x + ((c.x - b.x) / lbc) * rr,
                    y: b.y + ((c.y - b.y) / lbc) * rr
                )
                segments.append(Segment(x0: current.x, y0: current.y, x1: p1.x, y1: p1.y, cx: nil, cy: nil))
                segments.append(Segment(x0: p1.x, y0: p1.y, x1: p2.x, y1: p2.y, cx: b.x, cy: b.y))
                current = p2
            }
        }
        let last = points[points.count - 1]
        segments.append(Segment(x0: current.x, y0: current.y, x1: last.x, y1: last.y, cx: nil, cy: nil))
        var samples: [(x: Double, y: Double, len: Double)] = []
        var length = 0.0
        var previous: (Double, Double)?
        func push(_ x: Double, _ y: Double) {
            if let previous {
                length += hypot(x - previous.0, y - previous.1)
            }
            samples.append((x, y, length))
            previous = (x, y)
        }
        for segment in segments {
            let steps = segment.cx == nil ? 12 : 10
            if steps == 0 { continue }
            for step in 0...steps {
                let u = Double(step) / Double(steps)
                if let cx = segment.cx, let cy = segment.cy {
                    let v = 1 - u
                    push(
                        v * v * segment.x0 + 2 * v * u * cx + u * u * segment.x1,
                        v * v * segment.y0 + 2 * v * u * cy + u * u * segment.y1
                    )
                } else {
                    push(segment.x0 + (segment.x1 - segment.x0) * u, segment.y0 + (segment.y1 - segment.y0) * u)
                }
            }
        }
        return SceneTrail(samples: samples, length: length)
    }

    private static func outline(width: Double, height: Double, portrait: Bool) -> [TrailPoint] {
        scalePoints(silhouette, width: width, height: height, portrait: portrait)
    }

    private static func scalePoints(
        _ points: [(Double, Double)],
        width: Double,
        height: Double,
        portrait: Bool
    ) -> [TrailPoint] {
        let y0 = portrait ? 0.27 : 0.16
        let ys = portrait ? 0.63 : 0.74
        return points.map { point in
            TrailPoint(x: point.0 * width, y: (y0 + point.1 * ys) * height)
        }
    }

    private struct Segment {
        var x0: Double
        var y0: Double
        var x1: Double
        var y1: Double
        var cx: Double?
        var cy: Double?
    }

    private static let silhouette: [(Double, Double)] = [
        (-0.04, 1.0), (-0.04, 0.8), (0.14, 0.58), (0.26, 0.46), (0.33, 0.5),
        (0.46, 0.27), (0.545, 0.118), (0.61, 0.118), (0.7, 0.26), (0.83, 0.44),
        (0.95, 0.68), (1.04, 0.86), (1.04, 1.0),
    ]

    private static let trailNormalized: [(Double, Double)] = [
        (0.16, 0.925), (0.8, 0.83), (0.3, 0.71), (0.74, 0.585),
        (0.43, 0.465), (0.66, 0.335), (0.585, 0.215), (0.572, 0.118),
    ]
}
