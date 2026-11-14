import { useState, useEffect } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { FullScreenDrawingModal } from './FullScreenDrawingModal';

interface CreateEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateEntityModal({ isOpen, onClose }: CreateEntityModalProps) {
  const addCustomEntity = useSceneStore((state) => state.addCustomEntity);
  const showTagsSystem = useSceneStore((state) => state.settings.showTagsSystem);

  const [name, setName] = useState('Mon Dessin');
  const [tagInput, setTagInput] = useState('');

  // Réinitialiser les champs à chaque ouverture pour une nouvelle création propre
  useEffect(() => {
    if (isOpen) {
      setName('Mon Dessin');
      setTagInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <FullScreenDrawingModal
      mode="create"
      entityName={name}
      onEntityNameChange={setName}
      entityTags={tagInput}
      onEntityTagsChange={setTagInput}
      showTagsInput={showTagsSystem}
      saveButtonLabel="Ajouter à la scène"
      initialPaths={[]}
      initialColliderType="box"
      enableFlipbook={true}
      onSave={(
        paths,
        dataUrl,
        colliderType,
        _stateName,
        _hotspot,
        layers,
        colliderBounds,
        _overrideCollider,
        animationData
      ) => {
        const cleanName = name.trim() || 'Mon Dessin';
        const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/gi, '_') || 'dessin';
        const uniqueType = `custom_${slug}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const tags = tagInput
          .split(/[\s,]+/)
          .map((t) => t.replace(/^#/, '').trim())
          .filter((t) => t.length > 0);

        addCustomEntity({
          name: cleanName,
          type: uniqueType,
          icon: '🎨',
          drawingDataUrl: dataUrl,
          vectorPaths: paths,
          drawingLayers: layers,
          colliderType: colliderType || 'box',
          colliderBounds,
          color: 'transparent',
          tags: tags.length > 0 ? tags : [slug, 'custom'],
          frames: animationData?.frames,
          frameRate: animationData?.frameRate,
          animationLoop: animationData?.animationLoop,
        });

        onClose();
      }}
      onClose={onClose}
    />
  );
}
