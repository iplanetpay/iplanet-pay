import Foundation
import IPlanetCore

enum ForecastClient {
    private static let latitude = -23.5505
    private static let longitude = -46.6333

    static func current() async -> Forecast {
        var fallback = Forecast.saoPaulo
        fallback.localHour = saoPauloHour()
        guard let url = URL(string: endpoint) else { return fallback }
        var request = URLRequest(url: url)
        request.timeoutInterval = 6
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                return fallback
            }
            let decoded = try JSONDecoder().decode(Payload.self, from: data)
            return Forecast(
                kind: WeatherAdjust.wmoKind(decoded.current.weatherCode),
                temperatureC: decoded.current.temperature2m,
                windKmh: decoded.current.windSpeed10m,
                localHour: hour(decoded.current.time, fallback: fallback.localHour),
                sunrise: hour(decoded.daily.sunrise.first, fallback: 6),
                sunset: hour(decoded.daily.sunset.first, fallback: 18)
            )
        } catch {
            return fallback
        }
    }

    private static var endpoint: String {
        "https://api.open-meteo.com/v1/forecast?latitude=\(latitude)&longitude=\(longitude)"
            + "&current=temperature_2m,weather_code,wind_speed_10m,is_day"
            + "&daily=sunrise,sunset&forecast_days=1&timezone=auto"
    }

    private static func hour(_ iso: String?, fallback: Double) -> Double {
        guard let iso, let match = iso.range(of: #"T(\d{2}):(\d{2})"#, options: .regularExpression) else {
            return fallback
        }
        let stamp = String(iso[match])
        let parts = stamp.dropFirst().split(separator: ":")
        guard parts.count == 2, let hour = Double(parts[0]), let minute = Double(parts[1]) else {
            return fallback
        }
        return hour + minute / 60
    }

    private static func saoPauloHour() -> Double {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Sao_Paulo") ?? TimeZone(secondsFromGMT: 0)!
        let now = Date()
        return Double(calendar.component(.hour, from: now)) + Double(calendar.component(.minute, from: now)) / 60
    }
}

private struct Payload: Decodable {
    var current: Current
    var daily: Daily

    struct Current: Decodable {
        var temperature2m: Double
        var weatherCode: Int
        var windSpeed10m: Double
        var time: String

        enum CodingKeys: String, CodingKey {
            case temperature2m = "temperature_2m"
            case weatherCode = "weather_code"
            case windSpeed10m = "wind_speed_10m"
            case time
        }
    }

    struct Daily: Decodable {
        var sunrise: [String]
        var sunset: [String]
    }
}
