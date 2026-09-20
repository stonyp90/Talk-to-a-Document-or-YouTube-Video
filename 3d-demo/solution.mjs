import { rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const runtimeSpecifier = process.env.QODER_GLTF_RUNTIME
  ? pathToFileURL(path.resolve(process.env.QODER_GLTF_RUNTIME)).href
  : '@phodal/modeling-glb';
const { createModelBundle, modelCreate } = await import(runtimeSpecifier);

const source = defineModel();

function defineModel() {
  return modelCreate('ursly brand: logo is the audio equalizer, source flows in, understanding radiates out')

    // Ursly brand palette
    .appearance('paper', { baseColor: '#f8f5ef', metallic: 0, roughness: 0.9 })
    .appearance('ink', { baseColor: '#292735', metallic: 0.1, roughness: 0.5 })
    .appearance('coral', { baseColor: '#F27561', metallic: 0.3, roughness: 0.3, emissive: '#662010' })
    .appearance('coral.bright', { baseColor: '#F27561', metallic: 0.5, roughness: 0.2, emissive: '#993020' })
    .appearance('muted', { baseColor: '#716c78', metallic: 0.1, roughness: 0.6 })

    // Ground — warm paper disc with subtle ripple rings
    .part('ground', {
      geometry: { type: 'primitive.cylinder', radius: 0.16, height: 0.003, radialSegments: 32, axis: 'y' },
      appearance: 'paper',
      name: 'Ground',
    })
    .part('ground.ring.0', {
      geometry: { type: 'primitive.hollow-cylinder', outerRadius: 0.06, innerRadius: 0.058, height: 0.001, radialSegments: 32, axis: 'y' },
      appearance: 'muted',
      name: 'GroundRing0',
      translation: [0, 0.002, 0],
    })
    .part('ground.ring.1', {
      geometry: { type: 'primitive.hollow-cylinder', outerRadius: 0.1, innerRadius: 0.098, height: 0.001, radialSegments: 32, axis: 'y' },
      appearance: 'muted',
      name: 'GroundRing1',
      translation: [0, 0.002, 0],
    })
    .part('ground.ring.2', {
      geometry: { type: 'primitive.hollow-cylinder', outerRadius: 0.14, innerRadius: 0.138, height: 0.001, radialSegments: 32, axis: 'y' },
      appearance: 'muted',
      name: 'GroundRing2',
      translation: [0, 0.002, 0],
    })

    // Logo base — large coral rounded square (center stage, the hero)
    .part('logo.base', {
      geometry: { type: 'primitive.cylinder', radius: 0.045, height: 0.008, radialSegments: 4, axis: 'y' },
      appearance: 'coral',
      name: 'LogoBase',
      translation: [0, 0.006, 0],
      rotationRad: [0, 0.785, 0],
    })

    // 5 logo bars — THE audio equalizer. Tall and prominent, the brand mark IS the sound.
    .part('logo.bar.0', {
      geometry: { type: 'primitive.box', size: [0.008, 0.035, 0.008] },
      appearance: 'ink',
      name: 'LogoBar0',
      parent: 'logo.base',
      translation: [-0.025, 0.0215, 0],
    })
    .part('logo.bar.1', {
      geometry: { type: 'primitive.box', size: [0.008, 0.065, 0.008] },
      appearance: 'ink',
      name: 'LogoBar1',
      parent: 'logo.base',
      translation: [-0.0125, 0.0365, 0],
    })
    .part('logo.bar.2', {
      geometry: { type: 'primitive.box', size: [0.008, 0.05, 0.008] },
      appearance: 'ink',
      name: 'LogoBar2',
      parent: 'logo.base',
      translation: [0, 0.029, 0],
    })
    .part('logo.bar.3', {
      geometry: { type: 'primitive.box', size: [0.008, 0.065, 0.008] },
      appearance: 'ink',
      name: 'LogoBar3',
      parent: 'logo.base',
      translation: [0.0125, 0.0365, 0],
    })
    .part('logo.bar.4', {
      geometry: { type: 'primitive.box', size: [0.008, 0.04, 0.008] },
      appearance: 'ink',
      name: 'LogoBar4',
      parent: 'logo.base',
      translation: [0.025, 0.024, 0],
    })

    // Source document — small card, far left, not competing with the logo
    .part('document', {
      geometry: { type: 'primitive.beveled-box', size: [0.05, 0.065, 0.003], bevelRadius: 0.001, bevelSegments: 2 },
      appearance: 'paper',
      name: 'Document',
      translation: [-0.13, 0.09, 0.02],
      rotationRad: [0.1, 0.3, -0.05],
    })
    .part('doc.line.0', {
      geometry: { type: 'primitive.box', size: [0.035, 0.002, 0.001] },
      appearance: 'ink',
      name: 'DocLine0',
      parent: 'document',
      translation: [0, 0.022, 0.002],
    })
    .part('doc.line.1', {
      geometry: { type: 'primitive.box', size: [0.03, 0.002, 0.001] },
      appearance: 'ink',
      name: 'DocLine1',
      parent: 'document',
      translation: [0, 0.011, 0.002],
    })
    .part('doc.line.2', {
      geometry: { type: 'primitive.box', size: [0.033, 0.002, 0.001] },
      appearance: 'ink',
      name: 'DocLine2',
      parent: 'document',
      translation: [0, 0, 0.002],
    })
    .part('doc.line.3', {
      geometry: { type: 'primitive.box', size: [0.028, 0.002, 0.001] },
      appearance: 'ink',
      name: 'DocLine3',
      parent: 'document',
      translation: [0, -0.011, 0.002],
    })
    .part('doc.line.4', {
      geometry: { type: 'primitive.box', size: [0.025, 0.002, 0.001] },
      appearance: 'ink',
      name: 'DocLine4',
      parent: 'document',
      translation: [0, -0.022, 0.002],
    })

    // Understanding particles — coral spheres rising from the logo bars (answers emerging)
    .part('answer.0', {
      geometry: { type: 'primitive.sphere', radius: 0.008, widthSegments: 12, heightSegments: 8 },
      appearance: 'coral.bright',
      name: 'Answer0',
      translation: [-0.025, 0.14, 0],
    })
    .part('answer.1', {
      geometry: { type: 'primitive.sphere', radius: 0.006, widthSegments: 12, heightSegments: 8 },
      appearance: 'coral.bright',
      name: 'Answer1',
      translation: [0, 0.16, 0.01],
    })
    .part('answer.2', {
      geometry: { type: 'primitive.sphere', radius: 0.007, widthSegments: 12, heightSegments: 8 },
      appearance: 'coral.bright',
      name: 'Answer2',
      translation: [0.025, 0.15, -0.01],
    })

    // Sound wave rings — coral rings emanating outward from the logo (understanding radiating)
    .part('wave.ring.0', {
      geometry: { type: 'primitive.hollow-cylinder', outerRadius: 0.08, innerRadius: 0.077, height: 0.003, radialSegments: 32, axis: 'y' },
      appearance: 'coral',
      name: 'WaveRing0',
      translation: [0, 0.05, 0],
    })
    .part('wave.ring.1', {
      geometry: { type: 'primitive.hollow-cylinder', outerRadius: 0.11, innerRadius: 0.107, height: 0.003, radialSegments: 32, axis: 'y' },
      appearance: 'coral',
      name: 'WaveRing1',
      translation: [0, 0.05, 0],
    })

    // --- Animations ---

    // Logo bars pulse like an audio equalizer — the brand IS the sound
    .motionClip('anim.eq.pulse', { name: 'LogoEqualizer' })
    .motionTrack('anim.eq.pulse.bar0', {
      clip: 'anim.eq.pulse',
      target: 'logo.bar.0',
      path: 'scale',
      interpolation: 'linear',
      keyframes: [
        { time: 0, value: [1, 1, 1] },
        { time: 0.3, value: [1, 1.4, 1] },
        { time: 0.6, value: [1, 0.8, 1] },
        { time: 0.9, value: [1, 1.2, 1] },
        { time: 1.2, value: [1, 1, 1] },
      ],
    })
    .motionTrack('anim.eq.pulse.bar1', {
      clip: 'anim.eq.pulse',
      target: 'logo.bar.1',
      path: 'scale',
      interpolation: 'linear',
      keyframes: [
        { time: 0, value: [1, 1, 1] },
        { time: 0.15, value: [1, 1, 1] },
        { time: 0.45, value: [1, 1.5, 1] },
        { time: 0.75, value: [1, 0.7, 1] },
        { time: 1.05, value: [1, 1.3, 1] },
        { time: 1.35, value: [1, 1, 1] },
      ],
    })
    .motionTrack('anim.eq.pulse.bar2', {
      clip: 'anim.eq.pulse',
      target: 'logo.bar.2',
      path: 'scale',
      interpolation: 'linear',
      keyframes: [
        { time: 0, value: [1, 1, 1] },
        { time: 0.2, value: [1, 1, 1] },
        { time: 0.5, value: [1, 1.6, 1] },
        { time: 0.8, value: [1, 0.75, 1] },
        { time: 1.1, value: [1, 1.25, 1] },
        { time: 1.4, value: [1, 1, 1] },
      ],
    })
    .motionTrack('anim.eq.pulse.bar3', {
      clip: 'anim.eq.pulse',
      target: 'logo.bar.3',
      path: 'scale',
      interpolation: 'linear',
      keyframes: [
        { time: 0, value: [1, 1, 1] },
        { time: 0.25, value: [1, 1, 1] },
        { time: 0.55, value: [1, 1.45, 1] },
        { time: 0.85, value: [1, 0.8, 1] },
        { time: 1.15, value: [1, 1.35, 1] },
        { time: 1.45, value: [1, 1, 1] },
      ],
    })
    .motionTrack('anim.eq.pulse.bar4', {
      clip: 'anim.eq.pulse',
      target: 'logo.bar.4',
      path: 'scale',
      interpolation: 'linear',
      keyframes: [
        { time: 0, value: [1, 1, 1] },
        { time: 0.35, value: [1, 1, 1] },
        { time: 0.65, value: [1, 1.3, 1] },
        { time: 0.95, value: [1, 0.85, 1] },
        { time: 1.25, value: [1, 1.15, 1] },
        { time: 1.55, value: [1, 1, 1] },
      ],
    })

    // Document flows toward the logo — source being read
    .motionClip('anim.doc.flow', { name: 'DocumentFlow' })
    .motionTrack('anim.doc.flow.translate', {
      clip: 'anim.doc.flow',
      target: 'document',
      path: 'translation',
      interpolation: 'linear',
      keyframes: [
        { time: 0, value: [-0.13, 0.09, 0.02] },
        { time: 2, value: [-0.11, 0.09, 0.02] },
        { time: 4, value: [-0.13, 0.09, 0.02] },
      ],
    })

    // Answer particles rise — understanding emerges from the logo
    .motionClip('anim.answer.rise', { name: 'UnderstandingRises' })
    .motionTrack('anim.answer.rise.a0', {
      clip: 'anim.answer.rise',
      target: 'answer.0',
      path: 'translation',
      interpolation: 'linear',
      keyframes: [
        { time: 0, value: [-0.025, 0.14, 0] },
        { time: 1.5, value: [-0.025, 0.2, 0] },
        { time: 3, value: [-0.025, 0.14, 0] },
      ],
    })
    .motionTrack('anim.answer.rise.a1', {
      clip: 'anim.answer.rise',
      target: 'answer.1',
      path: 'translation',
      interpolation: 'linear',
      keyframes: [
        { time: 0, value: [0, 0.16, 0.01] },
        { time: 0.5, value: [0, 0.16, 0.01] },
        { time: 2, value: [0, 0.22, 0.01] },
        { time: 3.5, value: [0, 0.16, 0.01] },
      ],
    })
    .motionTrack('anim.answer.rise.a2', {
      clip: 'anim.answer.rise',
      target: 'answer.2',
      path: 'translation',
      interpolation: 'linear',
      keyframes: [
        { time: 0, value: [0.025, 0.15, -0.01] },
        { time: 1, value: [0.025, 0.15, -0.01] },
        { time: 2.5, value: [0.025, 0.21, -0.01] },
        { time: 4, value: [0.025, 0.15, -0.01] },
      ],
    })

    // Sound wave rings expand outward — understanding radiating
    .motionClip('anim.wave.radiate', { name: 'SoundWaveRadiate' })
    .motionTrack('anim.wave.radiate.r0', {
      clip: 'anim.wave.radiate',
      target: 'wave.ring.0',
      path: 'scale',
      interpolation: 'linear',
      keyframes: [
        { time: 0, value: [1, 1, 1] },
        { time: 1, value: [1.3, 1, 1.3] },
        { time: 2, value: [1, 1, 1] },
      ],
    })
    .motionTrack('anim.wave.radiate.r1', {
      clip: 'anim.wave.radiate',
      target: 'wave.ring.1',
      path: 'scale',
      interpolation: 'linear',
      keyframes: [
        { time: 0, value: [1, 1, 1] },
        { time: 0.5, value: [1, 1, 1] },
        { time: 1.5, value: [1.25, 1, 1.25] },
        { time: 2.5, value: [1, 1, 1] },
      ],
    })

    // Ground rings pulse — sound rippling across the surface
    .motionClip('anim.ground.ripple', { name: 'GroundRipple' })
    .motionTrack('anim.ground.ripple.r0', {
      clip: 'anim.ground.ripple',
      target: 'ground.ring.0',
      path: 'scale',
      interpolation: 'linear',
      keyframes: [
        { time: 0, value: [1, 1, 1] },
        { time: 0.8, value: [1.15, 1, 1.15] },
        { time: 1.6, value: [1, 1, 1] },
      ],
    })
    .motionTrack('anim.ground.ripple.r1', {
      clip: 'anim.ground.ripple',
      target: 'ground.ring.1',
      path: 'scale',
      interpolation: 'linear',
      keyframes: [
        { time: 0, value: [1, 1, 1] },
        { time: 0.4, value: [1, 1, 1] },
        { time: 1.2, value: [1.12, 1, 1.12] },
        { time: 2, value: [1, 1, 1] },
      ],
    })
    .motionTrack('anim.ground.ripple.r2', {
      clip: 'anim.ground.ripple',
      target: 'ground.ring.2',
      path: 'scale',
      interpolation: 'linear',
      keyframes: [
        { time: 0, value: [1, 1, 1] },
        { time: 0.8, value: [1, 1, 1] },
        { time: 1.6, value: [1.1, 1, 1.1] },
        { time: 2.4, value: [1, 1, 1] },
      ],
    })

    .expectBounds({
      min: [-0.16, -0.01, -0.16],
      max: [0.16, 0.17, 0.16],
      tolerance: 0.02,
    })
    .budget({
      maxOperations: 128,
      maxGeneratedInstances: 32,
      maxNodes: 40,
      maxVertices: 12000,
      maxTriangles: 12000,
      maxBytes: 2 * 1024 * 1024,
      maxAnimations: 8,
      maxAnimationTracks: 16,
      maxKeyframes: 80,
      maxAnimationDurationSeconds: 6,
    });
}

const bundle = await createModelBundle(source.program());
await Promise.all([
  writeAtomic('program.gltf.json', JSON.stringify(bundle.program, null, 2) + '\n'),
  writeAtomic('artifact.glb', bundle.artifact),
  writeAtomic('artifact.gltf-project.json', bundle.projectSidecar),
  writeAtomic('capability-report.json', JSON.stringify(bundle.capabilityReport, null, 2) + '\n'),
]);

process.stdout.write(JSON.stringify({
  status: 'committed',
  revision: bundle.inspection.revision,
  bounds: bundle.inspection.bounds,
  counts: bundle.validation.counts,
}) + '\n');

async function writeAtomic(filePath, data) {
  const absolute = path.resolve(filePath);
  const temporary = path.join(path.dirname(absolute), '.' + path.basename(absolute) + '.' + process.pid + '.tmp');
  await writeFile(temporary, data);
  await rename(temporary, absolute);
}
