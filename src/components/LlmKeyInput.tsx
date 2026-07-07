import { useState } from 'react';
import type { AiProvider, ActualTheme, AnthropicModel } from '../types';

interface LlmKeyInputProps {
  existingKey: string | null;
  provider: AiProvider;
  anthropicModel: AnthropicModel;
  extendedThinking: boolean;
  onSave: (key: string) => void;
  onRemove: () => void;
  onProviderChange: (provider: AiProvider) => void;
  onModelChange: (model: AnthropicModel) => void;
  onExtendedThinkingChange: (enabled: boolean) => void;
  theme: ActualTheme;
}

export function LlmKeyInput({
  existingKey,
  provider,
  anthropicModel,
  extendedThinking,
  onSave,
  onRemove,
  onProviderChange,
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
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
        [ API KEY CONFIGURATION ]
      </div>

      {/* Provider Selection */}
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
          AI PROVIDER:
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => onProviderChange('anthropic')}
            style={{
              padding: '0.5rem 1rem',
              background: provider === 'anthropic' ? textColor : 'none',
              border: `2px solid ${borderColor}`,
              color: provider === 'anthropic' ? bgColor : textColor,
              fontFamily: 'Courier New, monospace',
              fontWeight: 'bold',
              cursor: 'pointer',
              letterSpacing: '0.1em',
              fontSize: '0.75rem',
            }}
          >
            [ ANTHROPIC ]
          </button>
          <button
            disabled
            title="Coming Soon"
            style={{
              padding: '0.5rem 1rem',
              background: 'none',
              border: `2px solid ${borderColor}`,
              color: textColor,
              fontFamily: 'Courier New, monospace',
              fontWeight: 'bold',
              cursor: 'not-allowed',
              letterSpacing: '0.1em',
              fontSize: '0.75rem',
              opacity: 0.4,
            }}
          >
            [ OPENAI ]
          </button>
        </div>
      </div>

      {/* Model Selection (Anthropic only) */}
      {provider === 'anthropic' && (
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
            <button
              onClick={() => onModelChange('claude-haiku-4-5-20251001')}
              style={{
                padding: '0.5rem 1rem',
                background: anthropicModel === 'claude-haiku-4-5-20251001' ? textColor : 'none',
                border: `2px solid ${borderColor}`,
                color: anthropicModel === 'claude-haiku-4-5-20251001' ? bgColor : textColor,
                fontFamily: 'Courier New, monospace',
                fontWeight: 'bold',
                cursor: 'pointer',
                letterSpacing: '0.1em',
                fontSize: '0.75rem',
              }}
            >
              [ HAIKU 4.5 ]
            </button>
            <button
              onClick={() => onModelChange('claude-sonnet-5')}
              style={{
                padding: '0.5rem 1rem',
                background: anthropicModel === 'claude-sonnet-5' ? textColor : 'none',
                border: `2px solid ${borderColor}`,
                color: anthropicModel === 'claude-sonnet-5' ? bgColor : textColor,
                fontFamily: 'Courier New, monospace',
                fontWeight: 'bold',
                cursor: 'pointer',
                letterSpacing: '0.1em',
                fontSize: '0.75rem',
              }}
            >
              [ SONNET 5 ]
            </button>
            <button
              onClick={() => onModelChange('claude-opus-4-6')}
              style={{
                padding: '0.5rem 1rem',
                background: anthropicModel === 'claude-opus-4-6' ? textColor : 'none',
                border: `2px solid ${borderColor}`,
                color: anthropicModel === 'claude-opus-4-6' ? bgColor : textColor,
                fontFamily: 'Courier New, monospace',
                fontWeight: 'bold',
                cursor: 'pointer',
                letterSpacing: '0.1em',
                fontSize: '0.75rem',
              }}
            >
              [ OPUS 4.6 ]
            </button>
          </div>
          <div
            style={{
              fontSize: '0.65rem',
              opacity: 0.6,
              marginTop: '0.5rem',
              color: textColor,
            }}
          >
            {anthropicModel === 'claude-haiku-4-5-20251001' && '⚡ Haiku 4.5 - Fastest & Cheapest ($1/1M in, $5/1M out)'}
            {anthropicModel === 'claude-sonnet-5' && '⚖️ Sonnet 5 - Latest Balanced (intro $2/1M in, $10/1M out)'}
            {anthropicModel === 'claude-opus-4-6' && '🧠 Opus 4.6 - Most Capable ($5/1M in, $25/1M out)'}
            {anthropicModel === 'claude-sonnet-4-6' && '⚖️ Sonnet 4.6 - Legacy ($3/1M in, $15/1M out)'}
            {anthropicModel === 'claude-sonnet-4-5-20250929' && '⚖️ Sonnet 4.5 - Legacy ($3/1M in, $15/1M out)'}
            {anthropicModel === 'claude-opus-4-5-20251101' && '🧠 Opus 4.5 - Legacy ($5/1M in, $25/1M out)'}
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
                title="Enables deeper reasoning before extracting CV data. Recommended for personal CVs with unusual formatting, non-standard date formats, or ambiguous role titles. Has no benefit for clean, consistently-formatted exports. Increases token usage (~8K extra tokens per CV)."
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
                ? '🧠 Extended thinking ON — deeper reasoning, higher token usage (budget: 8K tokens)'
                : '💡 Extended thinking OFF — standard speed and cost'}
            </div>
          </div>
        </div>
      )}

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
            {provider === 'anthropic' ? 'ANTHROPIC API KEY (sk-ant-...)' : 'OPENAI API KEY (sk-...)'}:
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
              onKeyPress={handleKeyPress}
              placeholder={
                provider === 'anthropic'
                  ? 'sk-ant-api03-...'
                  : 'sk-proj-...'
              }
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
            🔒 Your API key is stored locally in your browser and never sent to any server except
            the AI provider you choose.
          </div>
        </div>
      )}
    </div>
  );
}
