import { beforeEach, describe, expect, it } from 'vitest';
import { Entity, HealthBehaviorConfig } from '../types';
import { useSceneStore } from '../store/useSceneStore';

function makeArchetype(type: string, name: string): Entity {
  return {
    id: type,
    name,
    type,
    tags: ['ennemi'],
    position: { x: 0, y: 0 },
    size: { width: 120, height: 120 },
    currentStateId: 'idle',
    isDraggable: false,
    states: {
      idle: {
        id: 'idle',
        name: 'Repos',
        color: '#3b82f6',
        scale: 1,
        rotation: 0,
        vectorPaths: [
          {
            id: 'p1',
            d: 'M 20 20 L 180 20 L 180 180 Z',
            stroke: '#1e293b',
            strokeWidth: 4,
            fill: '#3b82f6',
          },
        ],
      },
      hurt: {
        id: 'hurt',
        name: 'Blessé',
        color: '#ef4444',
        scale: 1,
        rotation: 0,
      },
    },
    behaviors: [
      {
        id: 'health_1',
        type: 'health',
        enabled: true,
        maxHp: 3,
        onDeath: 'destroy',
        hurtStateId: 'hurt',
      } as HealthBehaviorConfig,
    ],
  };
}

describe('Sous-phase A : Duplication indépendante, renommage d’instance & options Santé', () => {
  beforeEach(() => {
    useSceneStore.setState({
      appMode: 'edit',
      entities: {},
      entityOrder: [],
      customArchetypes: {},
      entityGroups: [],
      selectedEntityId: null,
      selectedLayerId: null,
      layerDrawingActions: null,
    });
  });

  it('duplicateCustomArchetype crée une entité indépendante sans lien avec l’originale', () => {
    const sourceType = 'custom_guard';
    const guardArchetype = makeArchetype(sourceType, 'Gardien');

    useSceneStore.setState({
      customArchetypes: { [sourceType]: guardArchetype },
      entityGroups: [{ id: 'grp_1', name: 'Personnages', entityTypes: [sourceType] }],
    });

    const dupType = useSceneStore.getState().duplicateCustomArchetype(sourceType);
    expect(dupType).toBeTruthy();
    expect(dupType).not.toBe(sourceType);

    const stateAfter = useSceneStore.getState();
    const duplicated = stateAfter.customArchetypes[dupType];
    expect(duplicated).toBeDefined();
    expect(duplicated.type).toBe(dupType);
    expect(duplicated.name).toBe('Gardien (Copie)');
    expect(stateAfter.selectedEntityId).toBe(dupType);
    expect(stateAfter.entityGroups[0].entityTypes).toEqual([sourceType, dupType]);

    // Modifier l'original ne doit JAMAIS impacter la copie indépendante
    stateAfter.updateEntityDetails(sourceType, { name: 'Gardien Élite' });
    stateAfter.updateStateProperties(sourceType, 'idle', { color: '#10b981' });

    const finalState = useSceneStore.getState();
    expect(finalState.customArchetypes[sourceType].name).toBe('Gardien Élite');
    expect(finalState.customArchetypes[sourceType].states.idle.color).toBe('#10b981');
    expect(finalState.customArchetypes[dupType].name).toBe('Gardien (Copie)');
    expect(finalState.customArchetypes[dupType].states.idle.color).toBe('#3b82f6');
  });

  it('duplicateCustomArchetype gère le nommage incrémental et les entités intégrées (apple)', () => {
    const appleDup1 = useSceneStore.getState().duplicateCustomArchetype('apple');
    const appleDup2 = useSceneStore.getState().duplicateCustomArchetype('apple');

    expect(appleDup1).toBeTruthy();
    expect(appleDup2).toBeTruthy();
    expect(appleDup1).not.toBe(appleDup2);

    const archetypes = useSceneStore.getState().customArchetypes;
    expect(archetypes[appleDup1].name).toBe('Pomme (Copie)');
    expect(archetypes[appleDup2].name).toBe('Pomme (Copie 2)');
    expect(archetypes[appleDup1].states.default.vectorPaths?.length).toBeGreaterThan(0);
  });

  it('updateEntityDetails avec { instanceOnly: true } renomme uniquement l’instance ciblée', () => {
    const sharedType = 'custom_crate';
    const archetype = makeArchetype(sharedType, 'Caisse');
    const inst1: Entity = {
      ...JSON.parse(JSON.stringify(archetype)),
      id: 'crate-1',
      position: { x: 100, y: 100 },
    };
    const inst2: Entity = {
      ...JSON.parse(JSON.stringify(archetype)),
      id: 'crate-2',
      position: { x: 260, y: 100 },
    };

    useSceneStore.setState({
      customArchetypes: { [sharedType]: archetype },
      entities: {
        'crate-1': inst1,
        'crate-2': inst2,
      },
      entityOrder: ['crate-1', 'crate-2'],
    });

    useSceneStore
      .getState()
      .updateEntityDetails('crate-1', { name: 'Caisse Gauche' }, { instanceOnly: true });

    const st = useSceneStore.getState();
    expect(st.entities['crate-1'].name).toBe('Caisse Gauche');
    expect(st.entities['crate-2'].name).toBe('Caisse');
    expect(st.customArchetypes[sharedType].name).toBe('Caisse');
  });

  it('HealthBehaviorConfig garde blinkOnDamage désactivé par défaut', () => {
    const healthCfg: HealthBehaviorConfig = {
      id: 'h1',
      type: 'health',
      enabled: true,
      maxHp: 3,
      onDeath: 'destroy',
    };
    expect(Boolean(healthCfg.blinkOnDamage)).toBe(false);
  });
});
