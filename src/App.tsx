import { useState, useEffect, useRef } from 'react';
import './App.css';
import { ThemeToggle } from './components/ThemeToggle';
import { LlmKeyInput } from './components/LlmKeyInput';
import { ParseModeSelector } from './components/ParseModeSelector';
import { ConcurrencySelector } from './components/ConcurrencySelector';
import { FileUploader } from './components/FileUploader';
import { ProgressIndicator } from './components/ProgressIndicator';
import { ManualCopyOutput } from './components/ManualCopyOutput';
import { GenerateButton } from './components/GenerateButton';
import { StorageService } from './services/storageService';
import { PDFService } from './services/pdfService';
import { AIService } from './services/aiService';
import type { Theme, ActualTheme, ProcessingStatus, CandidateData, ProcessingError, ParseMode, AiProvider, AnthropicModel, ConcurrencyLevel } from './types';

function App() {
  const [themePreference, setThemePreference] = useState<Theme>(() => StorageService.getTheme());
  const [actualTheme, setActualTheme] = useState<ActualTheme>(() => StorageService.getActualTheme());

  const [apiKey, setApiKey] = useState<string | null>(() => StorageService.getApiKey());
  const [aiProvider, setAiProvider] = useState<AiProvider>(() => StorageService.getAiProvider());
  const [anthropicModel, setAnthropicModel] = useState<AnthropicModel>(() => StorageService.getAnthropicModel());
  const [extendedThinking, setExtendedThinking] = useState(false);

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('idle');
  const [_parsedCVs, setParsedCVs] = useState<any[]>([]);
  const [extractedCandidates, setExtractedCandidates] = useState<CandidateData[]>([]);
  const [failedExtractions, setFailedExtractions] = useState<ProcessingError[]>([]);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);

  const [parseMode, setParseMode] = useState<ParseMode>(() => StorageService.getParseMode());
  const [concurrencyLevel, setConcurrencyLevel] = useState<ConcurrencyLevel>(() => StorageService.getConcurrencyLevel());

  const [totalCost, setTotalCost] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);

  const [justReset, setJustReset] = useState(false);
  const [fileUploaderKey, setFileUploaderKey] = useState(0);

  // Ref to track if extraction should be cancelled
  const cancelExtractionRef = useRef(false);

  // Initialize AIService with saved values
  useEffect(() => {
    if (apiKey) {
      AIService.setApiKey(apiKey);
    }
    AIService.setProvider(aiProvider);
    AIService.setAnthropicModel(anthropicModel);
    AIService.setExtendedThinking(extendedThinking);
  }, [apiKey, aiProvider, anthropicModel, extendedThinking]);

  useEffect(() => {
    document.body.className = `${actualTheme}-mode`;
  }, [actualTheme]);

  useEffect(() => {
    if (themePreference !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setActualTheme(e.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themePreference]);

  const handleThemeToggle = () => {
    let newPreference: Theme;
    if (themePreference === 'system') newPreference = 'light';
    else if (themePreference === 'light') newPreference = 'dark';
    else newPreference = 'system';

    setThemePreference(newPreference);
    StorageService.saveTheme(newPreference);
    setActualTheme(newPreference === 'system' ? StorageService.getActualTheme() : newPreference);
  };

  const handleParseModeChange = (mode: ParseMode) => {
    setParseMode(mode);
    StorageService.saveParseMode(mode);
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    StorageService.saveApiKey(key);
    AIService.setApiKey(key);
  };

  const handleRemoveApiKey = () => {
    setApiKey(null);
    StorageService.removeApiKey();
    AIService.setApiKey(null);
  };

  const handleProviderChange = (provider: AiProvider) => {
    setAiProvider(provider);
    StorageService.saveAiProvider(provider);
    AIService.setProvider(provider);
  };

  const handleModelChange = (model: AnthropicModel) => {
    setAnthropicModel(model);
    StorageService.saveAnthropicModel(model);
    AIService.setAnthropicModel(model);
  };

  const handleExtendedThinkingChange = (enabled: boolean) => {
    setExtendedThinking(enabled);
    AIService.setExtendedThinking(enabled);
  };

  const handleConcurrencyChange = (level: ConcurrencyLevel) => {
    setConcurrencyLevel(level);
    StorageService.saveConcurrencyLevel(level);
  };

  const handleFileSelect = async (files: File[]) => {
    setUploadedFiles(files);
    setParsedCVs([]);
    setExtractedCandidates([]);
    setFailedExtractions([]);
    setProcessingStatus('idle');
  };

  const handleReset = () => {
    // Cancel any ongoing extraction
    cancelExtractionRef.current = true;

    setUploadedFiles([]);
    setParsedCVs([]);
    setExtractedCandidates([]);
    setFailedExtractions([]);
    setProcessingStatus('idle');
    setProgressCurrent(0);
    setProgressTotal(0);
    setTotalCost(0);
    setTotalTokens(0);
    setFileUploaderKey((prev: number) => prev + 1);
    setJustReset(true);
    setTimeout(() => setJustReset(false), 1500);
  };

  const handleStopExtraction = () => {
    cancelExtractionRef.current = true;
    setProcessingStatus('idle');
  };

  const handleParsePDF = async () => {
    if (uploadedFiles.length === 0) {
      alert('Please upload at least one PDF file first');
      return;
    }

    if (!apiKey) {
      alert('Please enter your API key first');
      return;
    }

    // Reset cancellation flag
    cancelExtractionRef.current = false;

    try {
      setProcessingStatus('parsing');
      setProgressCurrent(0);
      setProgressTotal(0);

      const allCVs: any[] = [];

      for (let fileIndex = 0; fileIndex < uploadedFiles.length; fileIndex++) {
        const file = uploadedFiles[fileIndex];
        if (parseMode === 'longlist') {
          const cvs = await PDFService.parseAndSplit(file);
          allCVs.push(...cvs);
        } else {
          const pageTexts = await PDFService.parsePDF(file);
          const pageCount = await PDFService.getPageCount(file);
          const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1);
          const cv = { text: pageTexts.join('\n\n'), pageNumbers: pageNumbers, fileName: file.name };
          allCVs.push(cv);
        }
      }

      setParsedCVs(allCVs);
      setProgressTotal(allCVs.length);
      setProcessingStatus('extracting');
      setProgressCurrent(0);

      const candidates: CandidateData[] = [];
      const errors: ProcessingError[] = [];

      // Process CVs with controlled concurrency
      let completedCount = 0;
      let cumulativeCost = 0;
      let cumulativeTokens = 0;

      for (let i = 0; i < allCVs.length; i += concurrencyLevel) {
        // Check if extraction was cancelled
        if (cancelExtractionRef.current) {
          console.log('⏹️ Extraction cancelled by user');
          setProcessingStatus('idle');
          break;
        }

        const batch = allCVs.slice(i, i + concurrencyLevel);
        const batchPromises = batch.map(async (cv, batchIndex) => {
          const globalIndex = i + batchIndex;
          const result = await AIService.extractCVData(cv.text);

          return {
            index: globalIndex,
            result,
            cv
          };
        });

        const batchResults = await Promise.all(batchPromises);

        for (const { index, result, cv } of batchResults) {
          if (result.success && result.data) {
            candidates.push(result.data);
            // Track usage and cost
            if (result.usage) {
              cumulativeCost += result.usage.estimatedCost;
              cumulativeTokens += result.usage.totalTokens;
            }
          } else {
            errors.push({
              candidateIndex: index,
              error: result.error || 'Unknown error',
              rawText: cv.text,
            });
          }
          completedCount++;
          setProgressCurrent(completedCount);
        }

        // Update state after each batch to show results in real-time
        setExtractedCandidates([...candidates]);
        setFailedExtractions([...errors]);
        setTotalCost(cumulativeCost);
        setTotalTokens(cumulativeTokens);
      }

      setTotalCost(cumulativeCost);
      setTotalTokens(cumulativeTokens);
      setExtractedCandidates(candidates);
      setFailedExtractions(errors);
      setProcessingStatus('done');

    } catch (error) {
      console.error('❌ Error during processing:', error);
      setProcessingStatus('error');
      alert('Error during processing: ' + (error as Error).message);
    }
  };

  const borderColor = actualTheme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const bgColor = actualTheme === 'dark' ? '#2a2a2a' : '#fefdfb';
  const textColor = actualTheme === 'dark' ? '#e0e0e0' : '#2a2a2a';

  const canProcess = uploadedFiles.length > 0 && apiKey && processingStatus === 'idle';

  return (
    <div className="container">
      <div className="header">
        <ThemeToggle
          themePreference={themePreference}
          actualTheme={actualTheme}
          onToggle={handleThemeToggle}
        />
        <div className="title">════ LL2PP ════</div>
        <button
          className="reset-button"
          onClick={handleReset}
          title="Reset application"
          style={{
            borderColor: justReset ? '#4CAF50' : undefined,
            color: justReset ? '#4CAF50' : undefined,
            transition: 'all 0.3s ease'
          }}
        >
          {justReset ? '[ ✓ CLEARED ]' : '[ ↻ RESET ]'}
        </button>
      </div>

      <div className="subtitle">
        [ LongList to PowerPoint - Convert CV PDFs to Presentations ]
      </div>

      <LlmKeyInput
        existingKey={apiKey}
        provider={aiProvider}
        anthropicModel={anthropicModel}
        extendedThinking={extendedThinking}
        onSave={handleSaveApiKey}
        onRemove={handleRemoveApiKey}
        onProviderChange={handleProviderChange}
        onModelChange={handleModelChange}
        onExtendedThinkingChange={handleExtendedThinkingChange}
        theme={actualTheme}
      />

      <ParseModeSelector
        mode={parseMode}
        onModeChange={handleParseModeChange}
        theme={actualTheme}
      />

      <ConcurrencySelector
        level={concurrencyLevel}
        onLevelChange={handleConcurrencyChange}
        theme={actualTheme}
      />

      <FileUploader
        key={fileUploaderKey}
        onFileSelect={handleFileSelect}
        theme={actualTheme}
        disabled={processingStatus !== 'idle' && processingStatus !== 'done' && processingStatus !== 'error'}
        parseMode={parseMode}
      />

      {/* AI Model Selector Removed since it's hardcoded to Flash now to simplify UI */}
      
      <ProgressIndicator
        status={processingStatus}
        current={progressCurrent}
        total={progressTotal}
        theme={actualTheme}
      />

      {/* Cost Tracking Display */}
      {(processingStatus === 'extracting' || processingStatus === 'done') && totalTokens > 0 && (
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
            [ {processingStatus === 'extracting' ? '⏳ ' : ''}API USAGE SUMMARY{processingStatus === 'extracting' ? ' (IN PROGRESS)' : ''} ]
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ color: textColor }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                TOTAL TOKENS:
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'Courier New, monospace' }}>
                {totalTokens.toLocaleString()}
              </div>
            </div>
            <div style={{ color: textColor }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                ESTIMATED COST:
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', fontFamily: 'Courier New, monospace' }}>
                ${totalCost.toFixed(4)}
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: '0.65rem',
              opacity: 0.5,
              marginTop: '1rem',
              color: textColor,
            }}
          >
            💡 Cost per CV: ${(totalCost / extractedCandidates.length).toFixed(4)} • Model: {aiProvider === 'anthropic' ? anthropicModel : 'GPT-4 Turbo'}
          </div>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div style={{
          padding: '1.5rem',
          border: `2px solid ${borderColor}`,
          background: bgColor,
          boxShadow: `4px 4px 0px ${borderColor}`,
          marginBottom: '1.5rem',
          textAlign: 'center'
        }}>
          {processingStatus === 'extracting' ? (
            <button
              onClick={handleStopExtraction}
              style={{
                padding: '1rem 2rem',
                background: 'none',
                border: `2px solid #ff6b6b`,
                color: '#ff6b6b',
                fontFamily: 'Courier New, monospace',
                fontWeight: 'bold',
                cursor: 'pointer',
                letterSpacing: '0.1em',
                fontSize: '1rem'
              }}
            >
              [ ⏹️ STOP EXTRACTION ]
            </button>
          ) : (
            <button
              onClick={handleParsePDF}
              disabled={!canProcess}
              style={{
                padding: '1rem 2rem',
                background: 'none',
                border: `2px solid ${borderColor}`,
                color: textColor,
                fontFamily: 'Courier New, monospace',
                fontWeight: 'bold',
                cursor: canProcess ? 'pointer' : 'not-allowed',
                letterSpacing: '0.1em',
                fontSize: '1rem',
                opacity: canProcess ? 1 : 0.5
              }}
            >
              [ 🚀 PROCESS CVs ]
            </button>
          )}
          <div style={{
            fontSize: '0.75rem',
            opacity: 0.6,
            marginTop: '0.5rem',
            color: textColor
          }}>
            {processingStatus === 'extracting' ? 'Stop the current extraction' : 'Parse PDF(s) + Extract with AI'}
          </div>
        </div>
      )}

      {failedExtractions.length > 0 && (
        <div style={{
          padding: '1.5rem',
          border: `2px solid #ff6b6b`,
          background: bgColor,
          boxShadow: `4px 4px 0px #ff6b6b`,
          marginBottom: '1.5rem'
        }}>
          {failedExtractions.map((error, index) => (
            <div key={index} style={{ padding: '1rem', border: `1px solid #ff6b6b`, marginBottom: '0.5rem', background: actualTheme === 'dark' ? '#1a1a1a' : '#fff' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: textColor }}>CV {error.candidateIndex + 1}</div>
              <div style={{ fontSize: '0.75rem', color: '#ff6b6b' }}>Error: {error.error}</div>
            </div>
          ))}
        </div>
      )}

      {extractedCandidates.length > 0 && (
        <GenerateButton
          candidates={extractedCandidates}
          theme={actualTheme}
        />
      )}

      {extractedCandidates.length > 0 && (
        <div style={{
          padding: '1.5rem',
          border: `2px solid ${borderColor}`,
          background: bgColor,
          boxShadow: `4px 4px 0px ${borderColor}`,
          marginBottom: '1.5rem'
        }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: 'bold',
            marginBottom: '1rem',
            letterSpacing: '0.1em',
            color: textColor
          }}>
            [ {processingStatus === 'extracting' ? '⏳' : '✅'} EXTRACTED CANDIDATES: {extractedCandidates.length}{processingStatus === 'extracting' ? ` / ${progressTotal}` : ''} ]
          </div>
          {extractedCandidates.map((candidate, index) => (
            <div
              key={index}
              style={{
                padding: '1rem',
                border: `1px solid ${borderColor}`,
                marginBottom: '1rem',
                background: actualTheme === 'dark' ? '#1a1a1a' : '#fff'
              }}
            >
              <div style={{
                fontWeight: 'bold',
                fontSize: '1rem',
                marginBottom: '0.75rem',
                color: textColor
              }}>
                {index + 1}. {candidate.name}
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.25rem', color: textColor, opacity: 0.8 }}>WORK HISTORY:</div>
                {candidate.workHistory.map((work, wIdx) => (
                  <div key={wIdx} style={{ fontSize: '0.75rem', marginLeft: '1rem', marginBottom: '0.25rem', color: textColor, opacity: 0.7 }}>
                    • {work.jobTitle} at {work.company} {work.dates && `(${work.dates})`}
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.25rem', color: textColor, opacity: 0.8 }}>EDUCATION:</div>
                {candidate.education.map((edu, eIdx) => (
                  <div key={eIdx} style={{ fontSize: '0.75rem', marginLeft: '1rem', marginBottom: '0.25rem', color: textColor, opacity: 0.7 }}>
                    • {edu.degree} from {edu.institution} {edu.dates && `(${edu.dates})`}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {extractedCandidates.length > 0 && (
        <ManualCopyOutput
          candidates={extractedCandidates}
          theme={actualTheme}
        />
      )}

      <div className="footer">
        [ ✅ PDF Parsing | ✅ AI Extraction | ✅ PPTX Generation | 🚀 App Ready! ]
      </div>
    </div>
  );
}

export default App;