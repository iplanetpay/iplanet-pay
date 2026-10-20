import CryptoKit
import Foundation
import Security

enum AppleNonce {
    static func make(count: Int = 32) -> String {
        let alphabet = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var output = ""
        output.reserveCapacity(count)
        while output.count < count {
            var byte: UInt8 = 0
            let status = SecRandomCopyBytes(kSecRandomDefault, 1, &byte)
            if status != errSecSuccess {
                continue
            }
            if Int(byte) < alphabet.count {
                output.append(alphabet[Int(byte)])
            }
        }
        return output
    }

    /// SHA-256 hex of the raw nonce. Pass this hex to Apple (`ASAuthorizationAppleIDRequest.nonce`)
    /// and, on the native Google path, to `GIDSignIn`. Both copy that string into the ID token
    /// `nonce` claim. Supabase hashes the raw nonce and compares it with the claim, so
    /// `signInWithIdToken` must receive the raw value.
    static func sha256(_ raw: String) -> String {
        SHA256.hash(data: Data(raw.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
