import { useState } from 'react';
import type { CandidateData, ActualTheme } from '../types';
import type { Client } from '../shared/apiTypes';
import { SlideGenerator } from '../services/slideGenerator';
import { defaultLogoPlacement } from '../services/firstSlide';
import { logoDataUrl } from '../services/clientsService';

interface GenerateButtonProps {
  candidates: CandidateData[];
  /** For the first slide */
  position: string;
  client: Client | null;
  theme: ActualTheme;
  /** Called after a deck was generated and downloaded */
  onGenerated?: () => void;
}

export function GenerateButton({ candidates, position, client, theme, onGenerated }: GenerateButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (candidates.length === 0) return;

    setIsGenerating(true);
    try {
      let logo;
      if (client?.hasLogo && client.logoWidthPx && client.logoHeightPx) {
        logo = {
          dataUrl: await logoDataUrl(client),
          placement: client.placement ?? defaultLogoPlacement(client.logoWidthPx, client.logoHeightPx),
        };
      }
      const result = await SlideGenerator.generate(candidates, { position, logo });
      if (!result.success) alert(`Error generating slides: ${result.error}`);
      else onGenerated?.();
    } catch (error) {
      alert(`Error generating slides: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const borderColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const bgColor = theme === 'dark' ? '#2a2a2a' : '#fefdfb';
  const textColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';

  return (
    <div style={{
      padding: '1.5rem',
      border: `2px solid ${borderColor}`,
      background: bgColor,
      boxShadow: `4px 4px 0px ${borderColor}`,
      marginBottom: '1.5rem',
      textAlign: 'center'
    }}>
      <button
        onClick={handleGenerate}
        disabled={isGenerating || candidates.length === 0}
        style={{
          padding: '1rem 2rem',
          background: textColor, // Inverted for emphasis
          border: `2px solid ${borderColor}`,
          color: bgColor,
          fontFamily: 'Courier New, monospace',
          fontWeight: 'bold',
          cursor: isGenerating ? 'wait' : 'pointer',
          letterSpacing: '0.1em',
          fontSize: '1rem',
          boxShadow: `2px 2px 0px ${borderColor}`,
          opacity: isGenerating ? 0.7 : 1
        }}
      >
        {isGenerating ? '[ ⏳ GENERATING... ]' : '[ 💾 DOWNLOAD .PPTX ]'}
      </button>
      <div style={{
        fontSize: '0.75rem',
        opacity: 0.6,
        marginTop: '0.5rem',
        color: textColor
      }}>
        Compatible with PowerPoint, LibreOffice & Google Slides
      </div>
    </div>
  );
}
