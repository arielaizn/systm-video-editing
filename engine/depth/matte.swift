// SYSTM Depth: mattes with Apple Vision, on this Mac, no cloud.
//   matte person <framesDir> <outDir> [accurate|balanced]   grayscale person mattes, one PNG per input frame (same name)
//   matte lift <in.png> <out.png>                           cut the main subject of a still out to a transparent PNG
// Build: swiftc -O matte.swift -o matte
import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let ctx = CIContext(options: [.workingColorSpace: NSNull()])

func fail(_ m: String) -> Never { FileHandle.standardError.write((m + "\n").data(using: .utf8)!); exit(1) }

func writePNG(_ img: CIImage, _ url: URL, gray: Bool) {
  let cs = gray ? CGColorSpaceCreateDeviceGray() : CGColorSpace(name: CGColorSpace.sRGB)!
  let fmt: CIFormat = gray ? .L8 : .RGBA8
  guard let cg = ctx.createCGImage(img, from: img.extent, format: fmt, colorSpace: cs) else { fail("render failed \(url.path)") }
  guard let dst = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else { fail("cannot write \(url.path)") }
  CGImageDestinationAddImage(dst, cg, nil)
  if !CGImageDestinationFinalize(dst) { fail("cannot write \(url.path)") }
}

func person(_ inDir: String, _ outDir: String, _ quality: String) {
  let fm = FileManager.default
  try? fm.createDirectory(atPath: outDir, withIntermediateDirectories: true)
  let files = (try? fm.contentsOfDirectory(atPath: inDir))?.filter { $0.hasSuffix(".jpg") || $0.hasSuffix(".png") }.sorted() ?? []
  if files.isEmpty { fail("no frames in \(inDir)") }
  let req = VNGeneratePersonSegmentationRequest()
  req.qualityLevel = quality == "balanced" ? .balanced : .accurate
  req.outputPixelFormat = kCVPixelFormatType_OneComponent8
  var prev: CIImage? = nil
  for (i, f) in files.enumerated() {
    let out = URL(fileURLWithPath: outDir).appendingPathComponent((f as NSString).deletingPathExtension + ".png")
    if fm.fileExists(atPath: out.path) { prev = nil; continue }
    guard let src = CIImage(contentsOf: URL(fileURLWithPath: inDir).appendingPathComponent(f)) else { fail("cannot read \(f)") }
    let h = VNImageRequestHandler(ciImage: src, options: [:])
    do { try h.perform([req]) } catch { fail("vision: \(error)") }
    guard let buf = req.results?.first?.pixelBuffer else { fail("no mask for \(f)") }
    var m = CIImage(cvPixelBuffer: buf)
    m = m.transformed(by: CGAffineTransform(scaleX: src.extent.width / m.extent.width, y: src.extent.height / m.extent.height))
    // soft temporal smoothing against flicker: 70% this frame, 30% the previous one
    if let p = prev, let blend = CIFilter(name: "CIDissolveTransition") {
      blend.setValue(p, forKey: kCIInputImageKey); blend.setValue(m, forKey: kCIInputTargetImageKey); blend.setValue(0.7, forKey: kCIInputTimeKey)
      if let o = blend.outputImage { m = o.cropped(to: src.extent) }
    }
    prev = m
    writePNG(m.cropped(to: src.extent), out, gray: true)
    if i % 30 == 0 { print("matte \(i + 1)/\(files.count)"); fflush(stdout) }
  }
  print("matte done \(files.count)")
}

func lift(_ inPath: String, _ outPath: String) {
  guard let src = CIImage(contentsOf: URL(fileURLWithPath: inPath)) else { fail("cannot read \(inPath)") }
  let req = VNGenerateForegroundInstanceMaskRequest()
  let h = VNImageRequestHandler(ciImage: src, options: [:])
  do { try h.perform([req]) } catch { fail("vision: \(error)") }
  guard let r = req.results?.first, !r.allInstances.isEmpty else { fail("no subject found") }
  do {
    let buf = try r.generateMaskedImage(ofInstances: r.allInstances, from: h, croppedToInstancesExtent: false)
    writePNG(CIImage(cvPixelBuffer: buf), URL(fileURLWithPath: outPath), gray: false)
    print("lift done")
  } catch { fail("mask: \(error)") }
}

let a = CommandLine.arguments
if a.count >= 4 && a[1] == "person" { person(a[2], a[3], a.count > 4 ? a[4] : "accurate") }
else if a.count >= 4 && a[1] == "lift" { lift(a[2], a[3]) }
else { fail("usage: matte person <framesDir> <outDir> [accurate|balanced] | matte lift <in> <out>") }
