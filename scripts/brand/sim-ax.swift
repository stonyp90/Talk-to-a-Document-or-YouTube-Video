// Drives the app running in the iOS Simulator through the accessibility tree
// the Simulator exposes to macOS: an element is found by its accessibility
// label and pressed, or given a value, with no pointer or keyboard events.
// That works whatever Space or display the Simulator window is on, and while
// someone keeps using the Mac. Build with `swiftc -O sim-ax.swift -o sim-ax`.
//
//   sim-ax press LABEL            press the first element whose label contains LABEL
//   sim-ax set LABEL TEXT         set the value of the text field labelled LABEL
//   sim-ax wait LABEL [SECONDS]   wait until LABEL is on screen (default 10 s)
//   sim-ax list                   print the labels of every element, for scripting
import AppKit
import ApplicationServices

let args = CommandLine.arguments
guard args.count >= 2 else { exit(2) }

func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
  var value: CFTypeRef?
  return AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success ? value : nil
}
func children(_ element: AXUIElement) -> [AXUIElement] {
  attribute(element, kAXChildrenAttribute) as? [AXUIElement] ?? []
}
func label(_ element: AXUIElement) -> String {
  for name in [kAXDescriptionAttribute, kAXTitleAttribute, kAXValueAttribute] {
    if let text = attribute(element, name) as? String, !text.isEmpty { return text }
  }
  return ""
}
func walk(_ element: AXUIElement, _ visit: (AXUIElement) -> Bool) -> AXUIElement? {
  if visit(element) { return element }
  for child in children(element) {
    if let found = walk(child, visit) { return found }
  }
  return nil
}
func simulator() -> AXUIElement {
  guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.iphonesimulator").first else {
    FileHandle.standardError.write("Simulator is not running\n".data(using: .utf8)!)
    exit(1)
  }
  return AXUIElementCreateApplication(app.processIdentifier)
}
func find(_ needle: String, role: String? = nil, timeout: Double) -> AXUIElement? {
  let deadline = Date().addingTimeInterval(timeout)
  repeat {
    if let found = walk(simulator(), { element in
      if let role, (attribute(element, kAXRoleAttribute) as? String) != role { return false }
      return label(element).localizedCaseInsensitiveContains(needle)
    }) { return found }
    usleep(150_000)
  } while Date() < deadline
  return nil
}

switch args[1] {
case "list":
  _ = walk(simulator()) { element in
    let text = label(element)
    if !text.isEmpty, let role = attribute(element, kAXRoleAttribute) as? String {
      print("\(role)\t\(text)")
    }
    return false
  }
case "wait":
  let seconds = args.count >= 4 ? Double(args[3]) ?? 10 : 10
  exit(find(args[2], timeout: seconds) == nil ? 1 : 0)
case "press":
  guard args.count >= 3, let element = find(args[2], timeout: 10) else { exit(1) }
  exit(AXUIElementPerformAction(element, kAXPressAction as CFString) == .success ? 0 : 1)
case "set":
  guard args.count >= 4, let element = find(args[2], role: kAXTextFieldRole, timeout: 10) ?? find(args[2], timeout: 10) else { exit(1) }
  AXUIElementPerformAction(element, kAXPressAction as CFString)
  usleep(300_000)
  exit(AXUIElementSetAttributeValue(element, kAXValueAttribute as CFString, args[3] as CFTypeRef) == .success ? 0 : 1)
default:
  exit(2)
}
