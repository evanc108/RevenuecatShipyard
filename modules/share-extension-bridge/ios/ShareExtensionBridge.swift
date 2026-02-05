import Foundation
import React

@objc(ShareExtensionBridge)
class ShareExtensionBridge: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool {
    return true
  }

  /// Posts a "close" notification so the Swift VC dismisses the extension.
  @objc func close() {
    DispatchQueue.main.async {
      NotificationCenter.default.post(name: NSNotification.Name("close"), object: nil)
    }
  }

  /// Posts an "openHostApp" notification with an optional deep-link path.
  @objc func openHostApp(_ path: String) {
    DispatchQueue.main.async {
      NotificationCenter.default.post(
        name: NSNotification.Name("openHostApp"),
        object: nil,
        userInfo: ["path": path]
      )
    }
  }

  // MARK: - App Groups UserDefaults

  private var sharedDefaults: UserDefaults? {
    UserDefaults(suiteName: "group.com.evanchang.revenuecatshipyard")
  }

  @objc func getItem(_ key: String,
                      resolver resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let defaults = sharedDefaults else {
      reject("ERR_NO_DEFAULTS", "Could not access App Group UserDefaults", nil)
      return
    }
    let value = defaults.string(forKey: key)
    resolve(value)
  }

  @objc func setItem(_ key: String,
                      value: String,
                      resolver resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let defaults = sharedDefaults else {
      reject("ERR_NO_DEFAULTS", "Could not access App Group UserDefaults", nil)
      return
    }
    defaults.set(value, forKey: key)
    defaults.synchronize()
    resolve(nil)
  }

  @objc func removeItem(_ key: String,
                         resolver resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let defaults = sharedDefaults else {
      reject("ERR_NO_DEFAULTS", "Could not access App Group UserDefaults", nil)
      return
    }
    defaults.removeObject(forKey: key)
    defaults.synchronize()
    resolve(nil)
  }
}
