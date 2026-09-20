import { rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const runtimeSpecifier = process.env.QODER_GLTF_RUNTIME
  ? pathToFileURL(path.resolve(process.env.QODER_GLTF_RUNTIME)).href
  : '@phodal/modeling-glb';
const { createModelBundle, modelCreate } = await import(runtimeSpecifier);

const source = defineModel();

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function defineModel() {
  const R = 0.18;
  const angles = [0, 40, 80, 120, 160, 200, 240, 280, 320].map(d => d * Math.PI / 180);
  const stageNames = ['plan', 'design', 'build', 'integrate', 'validate', 'release', 'operate', 'measure', 'listen'];

  const faceGeometries = [
    { type: 'primitive.sphere', radius: 0.007, widthSegments: 8, heightSegments: 6 },
    { type: 'primitive.box', size: [0.012, 0.004, 0.012] },
    { type: 'primitive.box', size: [0.014, 0.003, 0.01] },
    { type: 'primitive.sphere', radius: 0.007, widthSegments: 8, heightSegments: 6 },
    { type: 'primitive.box', size: [0.01, 0.012, 0.003] },
    { type: 'primitive.hollow-cylinder', outerRadius: 0.008, innerRadius: 0.005, height: 0.004, radialSegments: 12, axis: 'y' },
    { type: 'primitive.box', size: [0.004, 0.012, 0.004] },
    { type: 'primitive.box', size: [0.012, 0.008, 0.006] },
    { type: 'primitive.box', size: [0.01, 0.01, 0.004] },
  ];

  const faceAppearances = ['ink', 'ink', 'ink', 'ink', 'ink', 'ink', 'ink', 'paper', 'ink'];

  const ringParams = [
    { inner: 0.018, outer: 0.025, tilt: 0.3, color: 'coral', rotation: Math.PI / 2 },
    { inner: 0.019, outer: 0.028, tilt: 0.5, color: 'ink', rotation: Math.PI },
    { inner: 0.018, outer: 0.030, tilt: 0, color: 'hairline', rotation: Math.PI / 4 },
    { inner: 0.020, outer: 0.027, tilt: 0.8, color: 'coral', rotation: 3 * Math.PI / 4 },
    { inner: 0.018, outer: 0.024, tilt: 0.2, color: 'ink', rotation: Math.PI / 2 },
    { inner: 0.019, outer: 0.032, tilt: 1.0, color: 'hairline', rotation: Math.PI },
    { inner: 0.018, outer: 0.026, tilt: 0.4, color: 'coral', rotation: Math.PI / 4 },
    { inner: 0.020, outer: 0.035, tilt: 0.6, color: 'ink', rotation: 3 * Math.PI / 4 },
    { inner: 0.019, outer: 0.029, tilt: 1.2, color: 'hairline', rotation: Math.PI / 2 },
  ];

  let model = modelCreate('ursly sdlc galaxy: 9 planets with rings orbiting a central sun')
    .appearance('paper', { baseColor: '#f8f5ef', metallic: 0, roughness: 0.9 })
    .appearance('ink', { baseColor: '#292735', metallic: 0.1, roughness: 0.5 })
    .appearance('coral', { baseColor: '#F27561', metallic: 0.3, roughness: 0.3, emissive: '#662010' })
    .appearance('coral.bright', { baseColor: '#F27561', metallic: 0.5, roughness: 0.2, emissive: '#993020' })
    .appearance('hairline', { baseColor: '#e5e0d8', metallic: 0, roughness: 0.8 })
    .part('ground', {
      geometry: { type: 'primitive.cylinder', radius: 0.22, height: 0.002, radialSegments: 32, axis: 'y' },
      appearance: 'paper',
      name: 'Ground',
    })
    .part('sun', {
      geometry: { type: 'primitive.sphere', radius: 0.04, widthSegments: 16, heightSegments: 12 },
      appearance: 'coral.bright',
      name: 'Sun',
      translation: [0, 0.05, 0],
    })
    .part('corona.0', {
      geometry: { type: 'primitive.hollow-cylinder', outerRadius: 0.05, innerRadius: 0.046, height: 0.002, radialSegments: 32, axis: 'y' },
      appearance: 'coral',
      name: 'Corona0',
      translation: [0, 0.05, 0],
    })
    .part('corona.1', {
      geometry: { type: 'primitive.hollow-cylinder', outerRadius: 0.058, innerRadius: 0.055, height: 0.001, radialSegments: 32, axis: 'y' },
      appearance: 'coral',
      name: 'Corona1',
      translation: [0, 0.05, 0],
    })
    .part('orbit.ring', {
      geometry: { type: 'primitive.hollow-cylinder', outerRadius: R, innerRadius: R - 0.002, height: 0.001, radialSegments: 64, axis: 'y' },
      appearance: 'hairline',
      name: 'OrbitRing',
      translation: [0, 0.003, 0],
    });

  for (let i = 0; i < 9; i++) {
    const name = stageNames[i];
    const x = R * Math.sin(angles[i]);
    const z = -R * Math.cos(angles[i]);
    const rp = ringParams[i];
    const planetAppearance = name === 'measure' ? 'coral' : 'paper';

    model = model
      .part(`planet.${name}`, {
        geometry: { type: 'primitive.sphere', radius: 0.015, widthSegments: 12, heightSegments: 8 },
        appearance: planetAppearance,
        name: `Planet${capitalize(name)}`,
        translation: [x, 0.05, z],
      })
      .part(`planet.${name}.face`, {
        geometry: faceGeometries[i],
        appearance: faceAppearances[i],
        name: `${capitalize(name)}Face`,
        parent: `planet.${name}`,
        translation: [0, 0.01, 0],
      })
      .part(`planet.${name}.ring`, {
        geometry: { type: 'primitive.hollow-cylinder', outerRadius: rp.outer, innerRadius: rp.inner, height: 0.001, radialSegments: 32, axis: 'y' },
        appearance: rp.color,
        name: `${capitalize(name)}Ring`,
        parent: `planet.${name}`,
        translation: [0, 0, 0],
        rotationRad: [rp.tilt, 0, 0],
      });
  }

  model = model.part('highlight', {
    geometry: { type: 'primitive.sphere', radius: 0.02, widthSegments: 12, heightSegments: 8 },
    appearance: 'coral.bright',
    name: 'Highlight',
    translation: [0, 0.07, -R],
  });

  // Animation: orbit sweep (18s cycle, 2s per stage)
  model = model.motionClip('anim.orbit', { name: 'OrbitSweep' });

  const highlightKeyframes = [{ time: 0, value: [0, 0.07, -R] }];
  for (let i = 1; i <= 9; i++) {
    const idx = i % 9;
    const x = R * Math.sin(angles[idx]);
    const z = -R * Math.cos(angles[idx]);
    highlightKeyframes.push({ time: i * 2, value: [x, 0.07, z] });
  }

  model = model.motionTrack('anim.orbit.highlight', {
    clip: 'anim.orbit',
    target: 'highlight',
    path: 'translation',
    interpolation: 'linear',
    keyframes: highlightKeyframes,
  });

  for (let i = 0; i < 9; i++) {
    const name = stageNames[i];
    const t = i * 2;
    const zoomKeyframes = [{ time: 0, value: [1, 1, 1] }];
    if (t > 0) zoomKeyframes.push({ time: t, value: [1, 1, 1] });

    if (i < 8) {
      zoomKeyframes.push(
        { time: t + 2, value: [1.5, 1.5, 1.5] },
        { time: t + 3, value: [1.5, 1.5, 1.5] },
        { time: t + 4, value: [1, 1, 1] },
      );
      if (t + 4 < 18) zoomKeyframes.push({ time: 18, value: [1, 1, 1] });
    } else {
      zoomKeyframes.push(
        { time: t + 1, value: [1.5, 1.5, 1.5] },
        { time: 18, value: [1, 1, 1] },
      );
    }

    model = model.motionTrack(`anim.orbit.${name}`, {
      clip: 'anim.orbit',
      target: `planet.${name}`,
      path: 'scale',
      interpolation: 'linear',
      keyframes: zoomKeyframes,
    });
  }

  // Animation: ring spin (4s cycle, represents sub-cycles)
  model = model.motionClip('anim.ring.spin', { name: 'RingSpin' });

  for (let i = 0; i < 9; i++) {
    const name = stageNames[i];
    const rp = ringParams[i];
    model = model.motionTrack(`anim.ring.spin.${name}`, {
      clip: 'anim.ring.spin',
      target: `planet.${name}.ring`,
      path: 'rotation',
      interpolation: 'linear',
      keyframes: [
        { time: 0, value: [rp.tilt, 0, 0] },
        { time: 4, value: [rp.tilt, rp.rotation, 0] },
      ],
    });
  }

  // Animation: sun pulse (6s cycle)
  model = model.motionClip('anim.sun.pulse', { name: 'SunPulse' });
  model = model.motionTrack('anim.sun.pulse.sun', {
    clip: 'anim.sun.pulse',
    target: 'sun',
    path: 'scale',
    interpolation: 'linear',
    keyframes: [
      { time: 0, value: [1, 1, 1] },
      { time: 3, value: [1.08, 1.08, 1.08] },
      { time: 6, value: [1, 1, 1] },
    ],
  });
  model = model.motionTrack('anim.sun.pulse.corona0', {
    clip: 'anim.sun.pulse',
    target: 'corona.0',
    path: 'scale',
    interpolation: 'linear',
    keyframes: [
      { time: 0, value: [1, 1, 1] },
      { time: 3, value: [1.12, 1, 1.12] },
      { time: 6, value: [1, 1, 1] },
    ],
  });
  model = model.motionTrack('anim.sun.pulse.corona1', {
    clip: 'anim.sun.pulse',
    target: 'corona.1',
    path: 'scale',
    interpolation: 'linear',
    keyframes: [
      { time: 0, value: [1, 1, 1] },
      { time: 3, value: [1.15, 1, 1.15] },
      { time: 6, value: [1, 1, 1] },
    ],
  });

  return model
    .expectBounds({
      min: [-0.22, -0.01, -0.22],
      max: [0.22, 0.1, 0.22],
      tolerance: 0.02,
    })
    .budget({
      maxOperations: 136,
      maxGeneratedInstances: 64,
      maxNodes: 80,
      maxVertices: 15000,
      maxTriangles: 15000,
      maxBytes: 2 * 1024 * 1024,
      maxAnimations: 8,
      maxAnimationTracks: 24,
      maxKeyframes: 120,
      maxAnimationDurationSeconds: 20,
    });
}

try {
  const bundle = await createModelBundle(source.program());
  await Promise.all([
    writeAtomic('sdlc-program.gltf.json', JSON.stringify(bundle.program, null, 2) + '\n'),
    writeAtomic('sdlc-artifact.glb', bundle.artifact),
    writeAtomic('sdlc-artifact.gltf-project.json', JSON.stringify(bundle.projectSidecar, null, 2) + '\n'),
    writeAtomic('sdlc-capability-report.json', JSON.stringify(bundle.capabilityReport, null, 2) + '\n'),
  ]);
  process.stdout.write(JSON.stringify({
    status: 'committed',
    revision: bundle.inspection.revision,
    bounds: bundle.inspection.bounds,
    counts: bundle.validation.counts,
  }) + '\n');
} catch (err) {
  process.stderr.write('BUILD_ERROR: ' + (err.message || err) + '\n');
  if (err.stack) process.stderr.write(err.stack + '\n');
  process.exit(1);
}

async function writeAtomic(filePath, data) {
  const absolute = path.resolve(filePath);
  const temporary = path.join(path.dirname(absolute), '.' + path.basename(absolute) + '.' + process.pid + '.tmp');
  await writeFile(temporary, data);
  await rename(temporary, absolute);
}
