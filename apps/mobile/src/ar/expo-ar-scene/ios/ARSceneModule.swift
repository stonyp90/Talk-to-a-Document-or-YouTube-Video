import ExpoModulesCore
import ARKit

public class ARSceneModule: Module {
  private var session: ARSession?
  private var planeAnchor: ARPlaneAnchor?

  public func definition() -> ModuleDefinition {
    Name("ARScene")

    Constants([
      "isSupported": ARWorldTrackingConfiguration.isSupported
    ])

    Function("startSession") {
      let arSession = ARSession()
      let config = ARWorldTrackingConfiguration()
      config.planeDetection = .horizontal
      config.isLightEstimationEnabled = true
      arSession.run(config)
      self.session = arSession
    }

    Function("stopSession") {
      self.session?.pause()
      self.session = nil
    }

    Function("placeAnchor") { (x: Double, y: Double, z: Double) in
      guard let session = self.session else { return }
      let transform = simd_float4x4(
        SIMD4<Float>(1, 0, 0, 0),
        SIMD4<Float>(0, 1, 0, 0),
        SIMD4<Float>(0, 0, 1, 0),
        SIMD4<Float>(Float(x), Float(y), Float(z), 1)
      )
      let anchor = ARAnchor(transform: transform)
      session.add(anchor: anchor)
    }
  }
}
