// Posts mouse events to the frontmost window so the iOS Simulator can be
// driven from a script: a click is a tap, a drag is a swipe. Coordinates are
// macOS screen points. Build with `swiftc -O sim-input.swift -o sim-input`.
//
//   sim-input click X Y
//   sim-input drag X1 Y1 X2 Y2 [milliseconds]
//   sim-input scroll X Y PIXELS      (positive scrolls the content up)
//   sim-input type TEXT             (keystrokes to the focused field)
import Foundation
import CoreGraphics

func post(_ event: CGEvent?) {
  event?.post(tap: .cghidEventTap)
  usleep(20_000)
}
func mouse(_ type: CGEventType, _ point: CGPoint) -> CGEvent? {
  CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: point, mouseButton: .left)
}

let args = CommandLine.arguments
// The Simulator reads the virtual key, not the attached string, so text is
// typed through the US layout: letters, digits and the punctuation a question
// needs. Anything else is skipped rather than mistyped.
let keys: [Character: (CGKeyCode, Bool)] = {
  var map: [Character: (CGKeyCode, Bool)] = [:]
  let plain: [(String, CGKeyCode)] = [
    ("a", 0), ("s", 1), ("d", 2), ("f", 3), ("h", 4), ("g", 5), ("z", 6), ("x", 7), ("c", 8), ("v", 9),
    ("b", 11), ("q", 12), ("w", 13), ("e", 14), ("r", 15), ("y", 16), ("t", 17), ("1", 18), ("2", 19),
    ("3", 20), ("4", 21), ("6", 22), ("5", 23), ("=", 24), ("9", 25), ("7", 26), ("-", 27), ("8", 28),
    ("0", 29), ("]", 30), ("o", 31), ("u", 32), ("[", 33), ("i", 34), ("p", 35), ("l", 37), ("j", 38),
    ("'", 39), ("k", 40), (";", 41), ("\\", 42), (",", 43), ("/", 44), ("n", 45), ("m", 46), (".", 47),
    (" ", 49),
  ]
  for (char, code) in plain {
    map[Character(char)] = (code, false)
    if char.first!.isLetter { map[Character(char.uppercased())] = (code, true) }
  }
  let shifted: [(String, CGKeyCode)] = [
    ("?", 44), ("!", 18), ("@", 19), ("#", 20), ("$", 21), ("%", 23), ("^", 22), ("&", 26), ("*", 28),
    ("(", 25), (")", 29), ("_", 27), ("+", 24), (":", 41), ("\"", 39), ("<", 43), (">", 47),
  ]
  for (char, code) in shifted { map[Character(char)] = (code, true) }
  return map
}()
if args.count >= 3, args[1] == "type" {
  // Start from a clean modifier state whatever the previous run left behind.
  post(CGEvent(keyboardEventSource: nil, virtualKey: 56, keyDown: false))
  for character in args[2] {
    guard let (code, shift) = keys[character] else { continue }
    // Shift is pressed as its own key: the Simulator ignores a bare flag.
    if shift { post(CGEvent(keyboardEventSource: nil, virtualKey: 56, keyDown: true)) }
    for down in [true, false] {
      let event = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: down)
      if shift { event?.flags = .maskShift }
      post(event)
      if down { usleep(20_000) }
    }
    if shift { post(CGEvent(keyboardEventSource: nil, virtualKey: 56, keyDown: false)) }
    usleep(40_000)
  }
  exit(0)
}
guard args.count >= 4, let x = Double(args[2]), let y = Double(args[3]) else {
  FileHandle.standardError.write("usage: sim-input click X Y | drag X1 Y1 X2 Y2 [ms]\n".data(using: .utf8)!)
  exit(2)
}
let from = CGPoint(x: x, y: y)
switch args[1] {
case "click":
  post(mouse(.mouseMoved, from))
  post(mouse(.leftMouseDown, from))
  usleep(70_000)
  post(mouse(.leftMouseUp, from))
case "drag":
  guard args.count >= 6, let x2 = Double(args[4]), let y2 = Double(args[5]) else { exit(2) }
  let to = CGPoint(x: x2, y: y2)
  let duration = args.count >= 7 ? Double(args[6]) ?? 300 : 300
  let steps = max(8, Int(duration / 16))
  post(mouse(.mouseMoved, from))
  post(mouse(.leftMouseDown, from))
  for i in 1...steps {
    let t = Double(i) / Double(steps)
    let eased = t < 0.5 ? 2 * t * t : 1 - pow(-2 * t + 2, 2) / 2
    post(mouse(.leftMouseDragged, CGPoint(x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased)))
  }
  usleep(80_000)
  post(mouse(.leftMouseUp, to))
case "scroll":
  guard args.count >= 5, let pixels = Double(args[4]) else { exit(2) }
  post(mouse(.mouseMoved, from))
  let steps = 24
  for _ in 0..<steps {
    let event = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 1,
                        wheel1: Int32(-pixels / Double(steps)), wheel2: 0, wheel3: 0)
    event?.location = from
    post(event)
  }
default:
  exit(2)
}
