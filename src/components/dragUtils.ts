// Pointer-drag helpers shared by the logo editor and the design editor
import type React from 'react';

/** Run onMove with the pointer delta (in screen px) until the pointer is released */
export function startDrag(event: React.PointerEvent, onMove: (dx: number, dy: number) => void) {
  event.preventDefault();
  event.stopPropagation();
  const startX = event.clientX;
  const startY = event.clientY;
  const target = event.currentTarget as HTMLElement;
  target.setPointerCapture(event.pointerId);
  const move = (e: PointerEvent) => onMove(e.clientX - startX, e.clientY - startY);
  const up = () => {
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', up);
  };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const handleStyle = (cursor: string): React.CSSProperties => ({
  position: 'absolute',
  width: 16,
  height: 16,
  background: '#fff',
  border: '2px solid #2a2a2a',
  cursor,
  touchAction: 'none',
  transform: 'translate(-50%, -50%)',
});

