import { useState } from 'react';
import type { ActualTheme, AnthropicModel } from '../types';

const MODELS: { id: AnthropicModel; label: string; description: string }[] = [
  { id: 'claude-haiku-5-5', label: 'HAIKU 5.5', description: '⚡ Haiku 5.5 - Fastest & Cheapest ($0.10/1M in, $0.50/1M out)' },
  { id: 'claude-sonnet-5-5', label: 'SONNET 5.5', description: '⚖️ Sonnet 5.5 - Balanced, recommended ($2/1M in, $10/1M out)' },
  { id: 'claude-opus-5-5', label: 'OPUS 5.5', description: '🧠 Opus 5.5 - Most Capable ($4/1M in, $20/1M out)' },
];

interface LlmKeyInputProps {
  existingKey: string | null;
  anthropicModel: AnthropicModel;
  extendedThinking: boolean;
  onSave: (key: string) => void;
  onRemove: () => void;
  onModelChange: (model: AnthropicModel) => void;
  onExtendedThinkingChange: (enabled: boolean) => void;
  theme: ActualTheme;
}

export function LlmKeyInput({
  existingKey,
  anthropicModel,
  extendedThinking,
  onSave,
  onRemove,
  onModelChange,
  onExtendedThinkingChange,
  theme,
}: LlmKeyInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showKey, setShowKey] = useState(false);

  const borderColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const bgColor = theme === 'dark' ? '#2a2a2a' : '#fefdfb';
  const textColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';

  const handleSave = () => {
    if (inputValue.trim()) {
      onSave(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <div
      style={{
        padding: '1.5rem',
        border: `2px solid ${borderColor}`,
        background: bgColor,
        boxShadow: `4px 4px 0px ${borderColor}`,
        marginBottom: '1.5rem',
      }}
    >
      <div
        style={{
          fontSize: '0.875rem',
          fontWeight: 'bold',
          marginBottom: '1rem',
          letterSpacing: '0.1em',
          color: textColor,
        }}
      >
        [ CLAUDE API CONFIGURATION ]
      </div>

      {/* Model Selection */}
      <div style={{ marginBottom: '1rem' }}>
        <label
          style={{
            display: 'block',
            fontSize: '0.75rem',
            marginBottom: '0.5rem',
            opacity: 0.8,
            color: textColor,
          }}
        >
          MODEL:
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => onModelChange(model.id)}
              style={{
                padding: '0.5rem 1rem',
                background: anthropicModel === model.id ? textColor : 'none',
                border: `2px solid ${borderColor}`,
                color: anthropicModel === model.id ? bgColor : textColor,
                fontFamily: 'Courier New, monospace',
                fontWeight: 'bold',
                cursor: 'pointer',
                letterSpacing: '0.1em',
                fontSize: '0.75rem',
              }}
            >
              [ {model.label} ]
            </button>
          ))}
        </div>
        <div
          style={{
            fontSize: '0.65rem',
            opacity: 0.6,
            marginTop: '0.5rem',
            color: textColor,
          }}
        >
          {MODELS.find((model) => model.id === anthropicModel)?.description}
        </div>

        {/* Extended Thinking Toggle */}
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <label
              style={{
                fontSize: '0.75rem',
                opacity: 0.8,
                color: textColor,
              }}
            >
              EXTENDED THINKING:
            </label>
            <span
              title="Enables deeper reasoning before extracting CV data. Recommended for personal CVs with unusual formatting, non-standard date formats, or ambiguous role titles. Has no benefit for clean, consistently-formatted exports. Increases token usage and processing time per CV."
              style={{ cursor: 'help', fontSize: '0.75rem', opacity: 0.6, color: textColor }}
            >
              ⓘ
            </span>
          </div>
          <button
            onClick={() => onExtendedThinkingChange(!extendedThinking)}
            style={{
              padding: '0.5rem 1rem',
              background: extendedThinking ? textColor : 'none',
              border: `2px solid ${borderColor}`,
              color: extendedThinking ? bgColor : textColor,
              fontFamily: 'Courier New, monospace',
              fontWeight: 'bold',
              cursor: 'pointer',
              letterSpacing: '0.1em',
              fontSize: '0.75rem',
            }}
          >
            {extendedThinking ? '[ ON ]' : '[ OFF ]'}
          </button>
          <div
            style={{
              fontSize: '0.65rem',
              opacity: 0.6,
              marginTop: '0.5rem',
              color: textColor,
            }}
          >
            {extendedThinking
              ? '🧠 Extended thinking ON — deeper reasoning, higher token usage (high effort)'
              : '💡 Extended thinking OFF — low effort, fastest and cheapest'}
          </div>
        </div>
      </div>

      {existingKey ? (
        /* Show existing key status */
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              gap: '0.5rem',
              marginBottom: '0.5rem',
            }}
          >
            <div
              style={{
                flex: 1,
                padding: '0.75rem',
                border: `1px solid ${borderColor}`,
                background: theme === 'dark' ? '#1a1a1a' : '#fff',
                fontFamily: 'Courier New, monospace',
                fontSize: '0.75rem',
                color: textColor,
                overflow: 'hidden',
                wordBreak: 'break-all',
                minWidth: 0, // Important for flex items to shrink below content size
              }}
            >
              {showKey ? existingKey : '●'.repeat(20)}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button
                onClick={() => setShowKey(!showKey)}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'none',
                  border: `2px solid ${borderColor}`,
                  color: textColor,
                  fontFamily: 'Courier New, monospace',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  letterSpacing: '0.1em',
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap',
                }}
              >
                {showKey ? '[ HIDE ]' : '[ SHOW ]'}
              </button>
              <button
                onClick={onRemove}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'none',
                  border: `2px solid #ff6b6b`,
                  color: '#ff6b6b',
                  fontFamily: 'Courier New, monospace',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  letterSpacing: '0.1em',
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap',
                }}
              >
                [ REMOVE ]
              </button>
            </div>
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              opacity: 0.6,
              color: textColor,
            }}
          >
            ✅ API key saved (stored in browser localStorage)
          </div>
        </div>
      ) : (
        /* Show input for new key */
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.75rem',
              marginBottom: '0.5rem',
              opacity: 0.8,
              color: textColor,
            }}
          >
            ANTHROPIC API KEY (sk-ant-...):
          </label>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '0.5rem',
            }}
          >
            <input
              type="password"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="sk-ant-api03-..."
              style={{
                flex: 1,
                padding: '0.75rem',
                border: `2px solid ${borderColor}`,
                background: theme === 'dark' ? '#1a1a1a' : '#fff',
                color: textColor,
                fontFamily: 'Courier New, monospace',
                fontSize: '0.875rem',
              }}
            />
            <button
              onClick={handleSave}
              disabled={!inputValue.trim()}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'none',
                border: `2px solid ${borderColor}`,
                color: textColor,
                fontFamily: 'Courier New, monospace',
                fontWeight: 'bold',
                cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                letterSpacing: '0.1em',
                fontSize: '0.875rem',
                opacity: inputValue.trim() ? 1 : 0.5,
              }}
            >
              [ SAVE ]
            </button>
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              opacity: 0.6,
              lineHeight: '1.4',
              color: textColor,
            }}
          >
            🔒 Your API key is stored locally in your browser and is only ever sent to Anthropic.
            Get a key at console.anthropic.com.
          </div>
        </div>
      )}
    </div>
  );
}
