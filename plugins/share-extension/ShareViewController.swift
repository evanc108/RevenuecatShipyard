import UIKit
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

  private let appGroupID = "group.com.evanchang.revenuecatshipyard"
  private let pendingImportsKey = "pendingImports"
  private let urlScheme = "cookwithnom"

  override func viewDidLoad() {
    super.viewDidLoad()
    handleIncomingShare()
  }

  private func handleIncomingShare() {
    guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
      close()
      return
    }

    for item in extensionItems {
      guard let attachments = item.attachments else { continue }

      for provider in attachments {
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
          provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] item, _ in
            if let url = item as? URL {
              self?.saveAndOpen(url: url.absoluteString)
            } else if let data = item as? Data, let url = URL(dataRepresentation: data, relativeTo: nil) {
              self?.saveAndOpen(url: url.absoluteString)
            } else {
              self?.close()
            }
          }
          return
        }

        if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
          provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] item, _ in
            if let text = item as? String, let url = self?.extractURL(from: text) {
              self?.saveAndOpen(url: url)
            } else {
              self?.close()
            }
          }
          return
        }
      }
    }

    close()
  }

  private func extractURL(from text: String) -> String? {
    let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
    let range = NSRange(text.startIndex..., in: text)
    if let match = detector?.firstMatch(in: text, options: [], range: range),
       let url = match.url {
      return url.absoluteString
    }
    return nil
  }

  private func saveAndOpen(url: String) {
    savePendingImport(url: url)
    openMainApp()
    close()
  }

  // MARK: - App Groups Storage

  private func savePendingImport(url: String) {
    guard let defaults = UserDefaults(suiteName: appGroupID) else { return }

    var pending: [[String: Any]] = []
    if let data = defaults.string(forKey: pendingImportsKey),
       let jsonData = data.data(using: .utf8),
       let existing = try? JSONSerialization.jsonObject(with: jsonData) as? [[String: Any]] {
      pending = existing
    }

    let id = "share_\(Int(Date().timeIntervalSince1970 * 1000))_\(String(Int.random(in: 0..<1_000_000), radix: 36))"
    let entry: [String: Any] = [
      "id": id,
      "url": url,
      "createdAt": Int(Date().timeIntervalSince1970 * 1000)
    ]
    pending.append(entry)

    if let jsonData = try? JSONSerialization.data(withJSONObject: pending),
       let jsonString = String(data: jsonData, encoding: .utf8) {
      defaults.set(jsonString, forKey: pendingImportsKey)
      defaults.synchronize()
    }
  }

  // MARK: - Open Main App

  private func openMainApp() {
    guard let url = URL(string: "\(urlScheme)://") else { return }
    var responder: UIResponder? = self
    while let r = responder {
      if let application = r as? UIApplication {
        application.open(url, options: [:], completionHandler: nil)
        return
      }
      responder = r.next
    }
    // Fallback: use selector-based approach for share extensions
    let selector = sel_registerName("openURL:")
    responder = self
    while let r = responder {
      if r.responds(to: selector) {
        r.perform(selector, with: url)
        return
      }
      responder = r.next
    }
  }

  // MARK: - Dismiss

  private func close() {
    DispatchQueue.main.async { [weak self] in
      self?.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
  }
}
