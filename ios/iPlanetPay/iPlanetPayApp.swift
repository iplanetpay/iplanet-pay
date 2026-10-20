import SwiftUI

@main
struct iPlanetPayApp: App {
    @State private var session = SessionStore()
    @State private var router = AppRouter()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(router)
                .tint(Brand.accent)
                .onOpenURL { url in
                    router.open(url)
                }
        }
    }
}
