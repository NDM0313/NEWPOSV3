import Foundation
import UIKit
import UniformTypeIdentifiers
import Capacitor

/**
 * Reads image bytes from UIPasteboard — Photos/Files "Copy" often stores
 * public.jpeg / public.png / public.heic data where `.image` alone is nil.
 * WhatsApp PNG may still arrive via WKWebView clipboard.read().
 */
@objc(PasteboardImagePlugin)
public class PasteboardImagePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PasteboardImagePlugin"
    public let jsName = "PasteboardImage"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "readImage", returnType: CAPPluginReturnPromise),
    ]

    private let imageTypeIds: [String] = {
        var ids = [
            UTType.png.identifier,
            UTType.jpeg.identifier,
            "public.jpeg",
            "public.png",
            "public.heic",
            "public.heif",
            "com.compuserve.gif",
        ]
        if #available(iOS 14.0, *) {
            ids.append(UTType.heic.identifier)
            ids.append(UTType.heif.identifier)
            ids.append(UTType.gif.identifier)
        }
        return Array(Set(ids))
    }()

    @objc func readImage(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let resolved = self.resolvePasteboardImage() {
                call.resolve(resolved)
            } else {
                call.resolve(["base64": NSNull(), "format": NSNull()])
            }
        }
    }

    private func resolvePasteboardImage() -> [String: Any]? {
        let pasteboard = UIPasteboard.general

        if let image = pasteboard.image {
            if let encoded = encodeUIImage(image) {
                return encoded
            }
        }

        for typeId in imageTypeIds {
            if let data = pasteboard.data(forPasteboardType: typeId), data.count > 0 {
                if let encoded = encodeImageData(data) {
                    return encoded
                }
            }
        }

        for item in pasteboard.items {
            for (typeId, value) in item {
                let lower = typeId.lowercased()
                guard lower.hasPrefix("public.") || lower.hasPrefix("com.") || lower.contains("image") else {
                    continue
                }
                if let data = value as? Data, data.count > 0 {
                    if let encoded = encodeImageData(data) {
                        return encoded
                    }
                }
                if let image = value as? UIImage {
                    if let encoded = encodeUIImage(image) {
                        return encoded
                    }
                }
            }
        }

        return nil
    }

    private func encodeUIImage(_ image: UIImage) -> [String: Any]? {
        if let png = image.pngData(), png.count > 0 {
            return [
                "base64": png.base64EncodedString(),
                "format": "png",
            ]
        }
        if let jpeg = image.jpegData(compressionQuality: 0.92), jpeg.count > 0 {
            return [
                "base64": jpeg.base64EncodedString(),
                "format": "jpeg",
            ]
        }
        return nil
    }

    private func encodeImageData(_ data: Data) -> [String: Any]? {
        if let image = UIImage(data: data) {
            return encodeUIImage(image)
        }
        // HEIC sometimes fails UIImage(data:) on older simulators — still return raw if JPEG/PNG magic
        if data.count >= 8 {
            let pngMagic: [UInt8] = [0x89, 0x50, 0x4E, 0x47]
            if data.prefix(4).elementsEqual(pngMagic) {
                return [
                    "base64": data.base64EncodedString(),
                    "format": "png",
                ]
            }
            if data[0] == 0xFF && data[1] == 0xD8 {
                return [
                    "base64": data.base64EncodedString(),
                    "format": "jpeg",
                ]
            }
        }
        return nil
    }
}
