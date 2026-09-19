package expo.modules.arscene

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.google.ar.core.ArCoreApk
import com.google.ar.core.Session
import com.google.ar.core.Config
import com.google.ar.core.Anchor

class ARSceneModule : Module() {
  private var session: Session? = null

  override fun definition() = ModuleDefinition {
    Name("ARScene")

    Constants(
      mapOf(
        "isSupported" to (ArCoreApk.getInstance().checkAvailability(appContext.reactContext ?: return@Constants false) == ArCoreApk.Availability.SUPPORTED_INSTALLED)
      )
    )

    Function("startSession") {
      val ctx = appContext.reactContext ?: return@Function
      val arSession = Session(ctx)
      val config = Config(arSession)
      config.planeFindingMode = Config.PlaneFindingMode.HORIZONTAL
      config.lightEstimationMode = Config.LightEstimationMode.ENVIRONMENTAL_HDR
      arSession.configure(config)
      arSession.resume()
      session = arSession
    }

    Function("stopSession") {
      session?.pause()
      session = null
    }

    Function("placeAnchor") { x: Double, y: Double, z: Double ->
      val s = session ?: return@Function
      val pose = com.google.ar.core.Pose(floatArrayOf(x.toFloat(), y.toFloat(), z.toFloat(), 0f, 0f, 0f, 1f))
      s.addAnchor(pose)
    }
  }
}
