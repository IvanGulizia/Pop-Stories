import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Entity } from '../types';
import {
  clearParticles,
  computeRelativeParticleOrigin,
  createParticlePool,
  getLatestMouseWorldPos,
  hasActiveParticles,
  interpolateHexColor,
  sampleParticleRange,
  setLatestMouseWorldPos,
} from '../utils/particleSystem';
import { executeRuleActions, clearPlayRuntimeState } from '../store/ruleExecutionEngine';
import {
  resetMatterPhysicsRuntime,
  stepMatterPhysics,
} from '../utils/matterPhysicsEngine';
import { useSceneStore } from '../store/useSceneStore';

function makeEntity(overrides: Partial<Entity> & { id: string }): Entity {
  const { id, ...rest } = overrides;
  return {
    id,
    name: `Entity ${id}`,
    type: 'custom',
    position: { x: 100, y: 100 },
    size: { width: 80, height: 60 },
    currentStateId: 'default',
    isDraggable: false,
    states: {
      default: {
        id: 'default',
        name: 'Idle',
        color: '#3b82f6',
        scale: 1,
        rotation: 0,
      },
    },
    ...rest,
  };
}

function createMockCanvas2DContext() {
  const fillStyles: string[] = [];
  const alphas: number[] = [];
  const translations: Array<{ x: number; y: number }> = [];
  const arcs: Array<{ x: number; y: number; r: number }> = [];

  const ctx = {
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn((x: number, y: number) => {
      translations.push({ x, y });
    }),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn((x: number, y: number, r: number) => {
      arcs.push({ x, y, r });
    }),
    fill: vi.fn(),
    fillRect: vi.fn(),
    ellipse: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    drawImage: vi.fn(),
    set fillStyle(val: string) {
      fillStyles.push(val);
    },
    get fillStyle() {
      return fillStyles[fillStyles.length - 1] || '#000000';
    },
    set globalAlpha(val: number) {
      alphas.push(val);
    },
    get globalAlpha() {
      return alphas[alphas.length - 1] ?? 1;
    },
  };

  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    fillStyles,
    alphas,
    translations,
    arcs,
  };
}

describe('Sous-phase C : Studio Particules Avancé, Collection & Spawn Relatif', () => {
  beforeEach(() => {
    clearParticles();
    clearPlayRuntimeState();
    resetMatterPhysicsRuntime();
    setLatestMouseWorldPos(null);
    useSceneStore.setState({
      appMode: 'play',
      entities: {},
      entityOrder: [],
      customArchetypes: {},
      customParticles: [],
      projectParticlePresets: [],
      localParticleCollection: {},
      entityGroups: [],
      selectedEntityId: null,
      selectedLayerId: null,
      layerDrawingActions: null,
    });
  });

  it('sampleParticleRange & interpolateHexColor calculent les plages Min/Max et le dégradé exact', () => {
    expect(sampleParticleRange(10, 50, 0.5, 1.5, 0)).toBe(10);
    expect(sampleParticleRange(10, 50, 0.5, 1.5, 0.5)).toBe(30);
    expect(sampleParticleRange(10, 50, 0.5, 1.5, 1)).toBe(50);
    // Min/Max inversés gérés proprement
    expect(sampleParticleRange(80, 20, 0.5, 1.5, 0.25)).toBe(35);
    // Sans maxVal => rétrocompatibilité facteurs legacy
    expect(sampleParticleRange(100, undefined, 0.7, 1.3, 0)).toBeCloseTo(70, 5);
    expect(sampleParticleRange(100, undefined, 0.7, 1.3, 1)).toBeCloseTo(130, 5);

    expect(interpolateHexColor('#ff0000', '#0000ff', 0)).toBe('rgb(255, 0, 0)');
    expect(interpolateHexColor('#ff0000', '#0000ff', 1)).toBe('rgb(0, 0, 255)');
    expect(interpolateHexColor('#000000', '#ffffff', 0.5)).toBe('rgb(128, 128, 128)');
  });

  it('Pool particules : colorMode single vs gradient_lifetime, drag, endSizeScale, opacité & formes d’émission', () => {
    const pool = createParticlePool(100);

    // 1. Mode single : ignore color2 même si différent
    pool.emitBurst({
      x: 200,
      y: 150,
      count: 4,
      color: '#ff0000',
      color2: '#00ff00',
      colorMode: 'single',
      speed: 0,
      speedMax: 0,
      gravity: 0,
      lifetime: 1,
      lifetimeMax: 1,
      size: 10,
      sizeMax: 10,
      endSizeScale: 2,
      opacityStart: 0.8,
      opacityEnd: 0.2,
    });

    const singleMock = createMockCanvas2DContext();
    pool.stepAndRender(singleMock.ctx, 800, 500, 0.05);
    expect(singleMock.fillStyles).toHaveLength(4);
    expect(singleMock.fillStyles.every((c) => c === '#ff0000')).toBe(true);
    // À t=0.05/1 : opacité ~ 0.8 + (0.2 - 0.8)*0.05 = 0.77, taille > 10
    expect(singleMock.alphas[0]).toBeCloseTo(0.77, 2);
    expect(singleMock.arcs[0].r).toBeGreaterThan(10 * 0.55);

    // 2. Mode gradient_lifetime + drag + circle/box emissionShape
    pool.clear();
    pool.emitBurst({
      x: 300,
      y: 250,
      count: 20,
      color: '#ff0000',
      color2: '#0000ff',
      colorMode: 'gradient_lifetime',
      speed: 200,
      speedMax: 200,
      angle: 0,
      spread: 0,
      gravity: 0,
      drag: 5,
      lifetime: 1,
      lifetimeMax: 1,
      size: 10,
      sizeMax: 10,
      endSizeScale: 0.2,
      opacityStart: 1,
      opacityEnd: 0,
      emissionShape: 'circle',
      emissionRadius: 30,
    });

    const gradMock1 = createMockCanvas2DContext();
    pool.stepAndRender(gradMock1.ctx, 800, 500, 0.05);
    expect(gradMock1.fillStyles[0]).toMatch(/^rgb\(/);
    // Tous les points initiaux restent bornés dans le cercle de rayon 30 (+ déplacement 0.05s)
    for (const tr of gradMock1.translations) {
      expect(Math.hypot(tr.x - 300, tr.y - 250)).toBeLessThanOrEqual(45);
    }

    // Après plusieurs pas de 0.05s (total 0.55s), drag freine nettement et la taille réduit vers endSizeScale=0.2
    let lastMock = gradMock1;
    for (let i = 0; i < 10; i++) {
      lastMock = createMockCanvas2DContext();
      pool.stepAndRender(lastMock.ctx, 800, 500, 0.05);
    }
    expect(lastMock.translations[0].x).toBeLessThan(300 + 30 + 50); // sans drag ce serait ~300 + 200*0.55 = 410+
    expect(lastMock.arcs[0].r).toBeLessThan(10 * 0.55);

    // 3. EmissionShape 'box' reste dans la boîte spécifiée
    pool.clear();
    pool.emitBurst({
      x: 400,
      y: 200,
      count: 25,
      speed: 0,
      speedMax: 0,
      gravity: 0,
      lifetime: 1,
      lifetimeMax: 1,
      emissionShape: 'box',
      emissionWidth: 80,
      emissionHeight: 20,
    });
    const boxMock = createMockCanvas2DContext();
    pool.stepAndRender(boxMock.ctx, 800, 500, 0.01);
    for (const tr of boxMock.translations) {
      expect(Math.abs(tr.x - 400)).toBeLessThanOrEqual(40.01);
      expect(Math.abs(tr.y - 200)).toBeLessThanOrEqual(10.01);
    }
  });

  it('computeRelativeParticleOrigin gère ancres, offsets locaux, flipX, rotation & followRotation=false', () => {
    const hero = makeEntity({
      id: 'hero-1',
      position: { x: 100, y: 100 },
      size: { width: 80, height: 60 }, // centre (140, 130)
      pivot: { x: 0.25, y: 0.5 },
      flipX: false,
      states: {
        default: { id: 'default', name: 'Idle', color: '#000', scale: 1, rotation: 0 },
      },
    });

    expect(computeRelativeParticleOrigin({ entity: hero, anchor: 'center' })).toEqual({
      x: 140,
      y: 130,
      angleDeg: -90,
    });
    expect(computeRelativeParticleOrigin({ entity: hero, anchor: 'top' })).toEqual({
      x: 140,
      y: 100,
      angleDeg: -90,
    });
    expect(computeRelativeParticleOrigin({ entity: hero, anchor: 'bottom' })).toEqual({
      x: 140,
      y: 160,
      angleDeg: -90,
    });
    expect(computeRelativeParticleOrigin({ entity: hero, anchor: 'left' })).toEqual({
      x: 100,
      y: 130,
      angleDeg: -90,
    });
    expect(computeRelativeParticleOrigin({ entity: hero, anchor: 'right', offsetX: 10 })).toEqual({
      x: 190,
      y: 130,
      angleDeg: -90,
    });
    // Pivot x=0.25 -> 100 + 80*0.25 = 120
    expect(computeRelativeParticleOrigin({ entity: hero, anchor: 'pivot' })).toEqual({
      x: 120,
      y: 130,
      angleDeg: -90,
    });

    // flipX miroir de l'ancre right, de l'offsetX et de l'angle baseAngleDeg=0 -> 180
    const flipped = computeRelativeParticleOrigin({
      entity: { ...hero, flipX: true },
      anchor: 'right',
      offsetX: 10,
      baseAngleDeg: 0,
      followRotation: true,
    });
    expect(flipped.x).toBeCloseTo(90, 4);
    expect(flipped.y).toBeCloseTo(130, 4);
    expect(flipped.angleDeg).toBeCloseTo(180, 4);

    // Rotation +90° avec ancre top (localY = -30) -> tourne à droite (+30, 0)
    const rotated = computeRelativeParticleOrigin({
      entity: hero,
      anchor: 'top',
      baseAngleDeg: -90,
      followRotation: true,
      overrideRotationDeg: 90,
    });
    expect(rotated.x).toBeCloseTo(170, 4);
    expect(rotated.y).toBeCloseTo(130, 4);
    expect(rotated.angleDeg).toBeCloseTo(0, 4);

    // followRotation=false conserve l'orientation monde sans miroir
    const fixedWorld = computeRelativeParticleOrigin({
      entity: { ...hero, flipX: true },
      anchor: 'top',
      offsetX: 12,
      baseAngleDeg: -90,
      followRotation: false,
      overrideRotationDeg: 90,
    });
    expect(fixedWorld.x).toBeCloseTo(152, 4);
    expect(fixedWorld.y).toBeCloseTo(100, 4);
    expect(fixedWorld.angleDeg).toBe(-90);
  });

  it('Émetteur ParticleEmitter : durée finie, boucle emitterLoop, initialBurstCount & burst périodique', () => {
    const emitterEntity = makeEntity({
      id: 'em-1',
      behaviors: [
        {
          id: 'beh-em',
          type: 'particle_emitter',
          enabled: true,
          rate: 0,
          color: '#f59e0b',
          shape: 'circle',
          speed: 120,
          size: 6,
          gravity: 150,
          spread: 60,
          angle: -90,
          initialBurstCount: 5,
          emitterDuration: 0.2,
          emitterLoop: false,
          lifetime: 0.06,
          lifetimeMax: 0.06,
        },
      ],
    });

    const entities = { [emitterEntity.id]: emitterEntity };

    // Tick 1 : émet la salve initiale (5 particules)
    stepMatterPhysics({ entities, deltaTime: 0.05, canvasBounds: { width: 800, height: 500 } });
    expect(hasActiveParticles()).toBe(true);

    // Laisser les particules mourir et dépasser emitterDuration (0.2s)
    const dummyCtx = createMockCanvas2DContext().ctx;
    const poolStep = async () => {
      const mod = await import('../utils/particleSystem');
      mod.stepAndRenderParticles(dummyCtx, 800, 500, 0.05);
    };
    return poolStep().then(async () => {
      // Avance au-delà de emitterDuration = 0.2s
      for (let i = 0; i < 6; i++) {
        stepMatterPhysics({ entities, deltaTime: 0.05, canvasBounds: { width: 800, height: 500 } });
        await poolStep();
      }
      // Sans boucle, aucune nouvelle salve ne doit être active après la fin
      expect(hasActiveParticles()).toBe(false);

      // Activer emitterLoop: true -> doit réémettre au franchissement du cycle suivant
      resetMatterPhysicsRuntime();
      clearParticles();
      entities[emitterEntity.id] = {
        ...emitterEntity,
        behaviors: [
          {
            id: 'beh-em',
            type: 'particle_emitter',
            enabled: true,
            rate: 0,
            color: '#f59e0b',
            shape: 'circle',
            speed: 120,
            size: 6,
            gravity: 150,
            spread: 60,
            angle: -90,
            initialBurstCount: 4,
            emitterDuration: 0.1,
            emitterLoop: true,
            lifetime: 0.05,
            lifetimeMax: 0.05,
          },
        ],
      };

      stepMatterPhysics({ entities, deltaTime: 0.05, canvasBounds: { width: 800, height: 500 } });
      expect(hasActiveParticles()).toBe(true);
      await poolStep();
      await poolStep();
      expect(hasActiveParticles()).toBe(false);

      // Tick suivant dépasse 0.1s -> boucle et déclenche une nouvelle salve
      stepMatterPhysics({ entities, deltaTime: 0.06, canvasBounds: { width: 800, height: 500 } });
      stepMatterPhysics({ entities, deltaTime: 0.01, canvasBounds: { width: 800, height: 500 } });
      expect(hasActiveParticles()).toBe(true);
    });
  });

  it('Rule action emit_particles supporte coordinates, mouse live et ancre relative sur entité', () => {
    const hero = makeEntity({
      id: 'hero-rule',
      position: { x: 200, y: 100 },
      size: { width: 100, height: 80 }, // bottom = (250, 180)
    });

    const helpers = {
      subject: hero,
      allEntities: { [hero.id]: hero },
      updateEntityState: () => {},
      updateEntityDetails: () => {},
      deleteEntity: () => {},
      spawnEntity: () => '',
    };

    // 1. Mode 'coordinates'
    executeRuleActions(
      [
        {
          id: 'p-coords',
          type: 'emit_particles',
          particleOriginMode: 'coordinates',
          particleCoords: { x: 512, y: 318 },
          particleCount: 3,
          particleCountMax: 3,
          particleSpeed: 0,
          particleSpeedMax: 0,
          particleGravity: 0,
          particleEmissionShape: 'point',
        },
      ],
      helpers
    );
    expect(hasActiveParticles()).toBe(true);
    const m1 = createMockCanvas2DContext();
    return import('../utils/particleSystem').then((mod) => {
      mod.stepAndRenderParticles(m1.ctx, 800, 500, 0.01);
      expect(Math.abs(m1.translations[0].x - 512)).toBeLessThanOrEqual(4);
      expect(Math.abs(m1.translations[0].y - 318)).toBeLessThanOrEqual(4);

      // 2. Mode 'mouse' via setLatestMouseWorldPos
      clearParticles();
      setLatestMouseWorldPos({ x: 640, y: 120 });
      expect(getLatestMouseWorldPos()).toEqual({ x: 640, y: 120 });
      executeRuleActions(
        [
          {
            id: 'p-mouse',
            type: 'emit_particles',
            particleOriginMode: 'mouse',
            particleOffsetX: 10,
            particleOffsetY: -20,
            particleCount: 2,
            particleCountMax: 2,
            particleSpeed: 0,
            particleSpeedMax: 0,
            particleGravity: 0,
          },
        ],
        helpers
      );
      const m2 = createMockCanvas2DContext();
      mod.stepAndRenderParticles(m2.ctx, 800, 500, 0.01);
      expect(Math.abs(m2.translations[0].x - 650)).toBeLessThanOrEqual(4);
      expect(Math.abs(m2.translations[0].y - 100)).toBeLessThanOrEqual(4);

      // 3. Mode relatif 'subject' avec ancre 'bottom' + offset
      clearParticles();
      executeRuleActions(
        [
          {
            id: 'p-rel',
            type: 'emit_particles',
            particleOriginMode: 'subject',
            particleAnchor: 'bottom',
            particleOffsetY: 5,
            particleCount: 2,
            particleCountMax: 2,
            particleSpeed: 0,
            particleSpeedMax: 0,
            particleGravity: 0,
          },
        ],
        helpers
      );
      const m3 = createMockCanvas2DContext();
      mod.stepAndRenderParticles(m3.ctx, 800, 500, 0.01);
      expect(Math.abs(m3.translations[0].x - 250)).toBeLessThanOrEqual(4);
      expect(Math.abs(m3.translations[0].y - 185)).toBeLessThanOrEqual(4);
    });
  });

  it('Store : collections Projet & Globale, embarquement/remapping des sprites vectoriels et roundtrip Export/Import', () => {
    const sprite = {
      id: 'sprite-leaf-1',
      name: 'Feuille',
      vectorPaths: [
        {
          id: 'vp-1',
          d: 'M 100 40 L 140 120 L 60 120 Z',
          fill: '#22c55e',
          stroke: '#14532d',
          strokeWidth: 3,
        },
      ],
      createdAt: 1000,
    };

    useSceneStore.setState({
      appMode: 'edit',
      customParticles: [sprite],
    });

    const fxId = useSceneStore.getState().saveProjectParticlePreset({
      name: 'Feuilles vent',
      config: {
        shape: 'custom',
        customParticleId: 'sprite-leaf-1',
        customParticleIds: ['sprite-leaf-1'],
        color: '#22c55e',
        color2: '#86efac',
        colorMode: 'gradient_lifetime',
        count: 14,
        countMax: 22,
        speed: 90,
        speedMax: 180,
        size: 8,
        sizeMax: 14,
        endSizeScale: 0.4,
        lifetime: 0.9,
        gravity: 40,
        drag: 1.5,
        spread: 90,
        angle: -90,
        emissionShape: 'box',
        emissionWidth: 120,
        emissionHeight: 20,
      },
    });

    const projectPreset = useSceneStore.getState().projectParticlePresets.find((p) => p.id === fxId);
    expect(projectPreset).toBeDefined();
    expect(projectPreset?.embeddedCustomSprites).toHaveLength(1);
    expect(projectPreset?.embeddedCustomSprites?.[0].id).toBe('sprite-leaf-1');

    // Sauvegarder également dans la collection inter-projets
    const localId = useSceneStore.getState().saveParticleToLocalCollection({
      name: 'Feuilles globales',
      config: projectPreset!.config,
      embeddedCustomSprites: projectPreset!.embeddedCustomSprites,
    });
    expect(useSceneStore.getState().localParticleCollection[localId]).toBeDefined();

    // Export du projet -> clearProject -> importProject restaure projectParticlePresets
    const exported = useSceneStore.getState().exportProject();
    expect(exported.particlePresets).toHaveLength(1);

    useSceneStore.getState().clearProject();
    expect(useSceneStore.getState().projectParticlePresets).toHaveLength(0);
    expect(useSceneStore.getState().customParticles).toHaveLength(0);

    // Importer un sprite embarqué depuis la collection globale dans un projet vierge (avec collision d'ID mais géométrie différente)
    useSceneStore.setState({
      customParticles: [
        {
          id: 'sprite-leaf-1',
          name: 'Autre forme',
          vectorPaths: [{ id: 'vp-other', d: 'M 0 0 L 20 20', fill: '#ef4444', stroke: '#000', strokeWidth: 2 }],
          createdAt: 2000,
        },
      ],
    });
    const remap = useSceneStore
      .getState()
      .importEmbeddedParticleSprites(useSceneStore.getState().localParticleCollection[localId].embeddedCustomSprites);
    const mappedId = remap['sprite-leaf-1'];
    expect(mappedId).toBeDefined();
    expect(mappedId).not.toBe('sprite-leaf-1');
    expect(useSceneStore.getState().customParticles.some((s) => s.id === mappedId)).toBe(true);

    // Import du JSON exporté restaure bien particlePresets
    useSceneStore.getState().importProject(exported);
    expect(useSceneStore.getState().projectParticlePresets).toHaveLength(1);
    expect(useSceneStore.getState().projectParticlePresets[0].name).toBe('Feuilles vent');

    // Suppression propre
    useSceneStore.getState().deleteProjectParticlePreset(fxId);
    expect(useSceneStore.getState().projectParticlePresets).toHaveLength(0);
    useSceneStore.getState().deleteParticleFromLocalCollection(localId);
    expect(useSceneStore.getState().localParticleCollection[localId]).toBeUndefined();
  });
});
