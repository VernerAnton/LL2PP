import { useState, useEffect, useRef } from 'react';
import './App.css';
import { ThemeToggle } from './components/ThemeToggle';
import { AiSettings } from './components/AiSettings';
import { ClientsPage } from './components/ClientsPage';
import { SearchesPage } from './components/SearchesPage';
import { DesignPage } from './components/DesignPage';
import { DesignContext, getDesign } from './services/designService';
import { BUILT_IN_DESIGN, type SlideDesign } from './shared/design';
import { FirstSlideInput } from './components/FirstSlideInput';
import { listClients } from './services/clientsService';
import type { Client, SearchUsage } from './shared/apiTypes';
import { EMPTY_USAGE, UsageSummary, addToUsage } from './components/UsageSummary';
import { ParseModeSelector } from './components/ParseModeSelector';
import { ConcurrencySelector } from './components/ConcurrencySelector';
import { ExtraDetailsInput } from './components/ExtraDetailsInput';
import { selectedExtraFields, type ExtraFieldId } from './services/extraDetails';
import { FileUploader } from './components/FileUploader';
import { ProgressIndicator } from './components/ProgressIndicator';
import { ManualCopyOutput } from './components/ManualCopyOutput';
import { GenerateButton } from './components/GenerateButton';
import { UpdatePrompt } from './components/UpdatePrompt';
import { useAppUpdate } from './useAppUpdate';
import { APP_VERSION } from './version';
import { StorageService } from './services/storageService';
import { PDFService, hasUsableText } from './services/pdfService';
import { AIService, type ExtractionResult, type ThinkingLevel } from './services/aiService';
import type { Theme, ActualTheme, ProcessingStatus, CandidateData, ProcessingError, ParseMode, ConcurrencyLevel } from './types';

function App() {
  const [themePreference, setThemePreference] = useState<Theme>(() => StorageService.getTheme());
  const [actualTheme, setActualTheme] = useState<ActualTheme>(() => StorageService.getActualTheme());

  const [tab, setTab] = useState<'cvs' | 'searches' | 'clients' | 'design'>('cvs');

  // Slide design (backgrounds, size, positions); the built-in one until the saved one loads
  const [design, setDesign] = useState<SlideDesign>(BUILT_IN_DESIGN);
  const [designError, setDesignError] = useState<string | null>(null);

  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('auto');

  // Client library (logos) from the server, and the first slide of this deck (not saved)
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [firstSlideClientId, setFirstSlideClientId] = useState('');
  const [position, setPosition] = useState('');

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('idle');
  const [_parsedCVs, setParsedCVs] = useState<any[]>([]);
  const [extractedCandidates, setExtractedCandidates] = useState<CandidateData[]>([]);
  const [failedExtractions, setFailedExtractions] = useState<ProcessingError[]>([]);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);

  const [parseMode, setParseMode] = useState<ParseMode>(() => StorageService.getParseMode());
  const [concurrencyLevel, setConcurrencyLevel] = useState<ConcurrencyLevel>(() => StorageService.getConcurrencyLevel());
  // Extra details (e.g. location) for this run only; deliberately not saved
  const [extraFields, setExtraFields] = useState<ExtraFieldId[]>([]);

  // Token use and estimated cost of this run (every CV, failed ones too); cleared by reset
  const [usage, setUsage] = useState<SearchUsage>(EMPTY_USAGE);

  const [justReset, setJustReset] = useState(false);
  const [fileUploaderKey, setFileUploaderKey] = useState(0);

  // Offers a reload when a newer build has been deployed (never reloads by itself)
  const update = useAppUpdate();

  // Ref to track if extraction should be cancelled
  const cancelExtractionRef = useRef(false);

  // Clean up settings from older versions (e.g. the removed OpenAI provider and model picker)
  useEffect(() => {
    StorageService.removeLegacyKeys();
  }, []);

  // Which Sonnet the server will use, and the client library
  useEffect(() => {
    AIService.getModel()
      .then(setActiveModel)
      .catch((e) => setModelError(e instanceof Error ? e.message : String(e)));
    getDesign()
      .then(setDesign)
      .catch((e) => setDesignError(e instanceof Error ? e.message : String(e)));
    listClients()
      .then(setClients)
      .catch((e) => setClientsError(e instanceof Error ? e.message : String(e)));
  }, []);

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
    setUsage(EMPTY_USAGE);
    setFileUploaderKey((prev: number) => prev + 1);
    setExtraFields([]);
    setFirstSlideClientId('');
    setPosition('');
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

    // Reset cancellation flag
    cancelExtractionRef.current = false;

    try {
      setProcessingStatus('parsing');
      setProgressCurrent(0);
      setProgressTotal(0);
      setExtractedCandidates([]);
      setFailedExtractions([]);
      setUsage(EMPTY_USAGE);

      const allCVs: any[] = [];

      for (let fileIndex = 0; fileIndex < uploadedFiles.length; fileIndex++) {
        const file = uploadedFiles[fileIndex];
        if (parseMode === 'longlist') {
          const cvs = await PDFService.parseAndSplit(file);
          // Splitting into CVs needs the "Page 1 of" text, so an image-only longlist can't be used
          if (!hasUsableText(cvs.map((cv) => cv.text).join(''))) {
            throw new Error(
              `"${file.name}" has no readable text: it looks like scanned images, so it can't be split into separate CVs. ` +
                'Upload the CVs one by one instead (SEARCHES tab, or Individual mode); scanned CVs work there.'
            );
          }
          allCVs.push(...cvs);
        } else {
          const pageTexts = await PDFService.parsePDF(file);
          const pageCount = await PDFService.getPageCount(file);
          const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1);
          const cv = { text: pageTexts.join('\n\n'), pageNumbers: pageNumbers, fileName: file.name, file };
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
      let runUsage = EMPTY_USAGE;

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
          const options = {
            extraFields: selectedExtraFields(extraFields).map((field) => field.id),
            level: thinkingLevel,
            source: parseMode,
          };
          let result: ExtractionResult;
          if (hasUsableText(cv.text)) {
            result = await AIService.extractCVData([{ text: cv.text }], options);
          } else if (cv.file) {
            // Individual scanned CV: send the PDF itself, Claude reads the page images
            result = await AIService.extractCVData([{ pdf: cv.file }], options);
          } else {
            result = {
              success: false,
              error: 'No readable text on these pages (scanned?). Upload this CV on its own in a search or Individual mode.',
              requests: 0, // nothing was sent to Claude
            };
          }

          return {
            index: globalIndex,
            result,
            cv
          };
        });

        const batchResults = await Promise.all(batchPromises);

        for (const { index, result, cv } of batchResults) {
          // Track usage and cost: every CV counts, failed ones too (they are billed)
          runUsage = addToUsage(runUsage, result.usage, result.requests);
          if (result.success && result.data) {
            candidates.push(result.data);

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
        setUsage(runUsage);
      }

      setUsage(runUsage);
      setExtractedCandidates(candidates);
      setFailedExtractions(errors);
      setProcessingStatus('done');
      // Reflect a switch to the fallback model, if the newest Sonnet rejected the request
      AIService.getModel().then(setActiveModel).catch(() => {});

    } catch (error) {
      console.error('❌ Error during processing:', error);
      setProcessingStatus('error');
      alert('Error during processing: ' + (error as Error).message);
    }
  };

  const borderColor = actualTheme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const bgColor = actualTheme === 'dark' ? '#2a2a2a' : '#fefdfb';
  const textColor = actualTheme === 'dark' ? '#e0e0e0' : '#2a2a2a';

  // Allow re-running after a finished or failed run (e.g. after changing the thinking level)
  const canProcess = uploadedFiles.length > 0 &&
    (processingStatus === 'idle' || processingStatus === 'done' || processingStatus === 'error');

  return (
    // Extra bottom space while the update prompt is up, so it can't cover the last controls
    <DesignContext.Provider value={design}>
    <div className="container" style={update.needRefresh ? { paddingBottom: '10rem' } : undefined}>
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

      <div className="mode-buttons tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`mode-button ${tab === 'cvs' ? 'active' : ''}`} onClick={() => setTab('cvs')}>
          [ CVs ]
        </button>
        <button className={`mode-button ${tab === 'searches' ? 'active' : ''}`} onClick={() => setTab('searches')}>
          [ SEARCHES ]
        </button>
        <button className={`mode-button ${tab === 'clients' ? 'active' : ''}`} onClick={() => setTab('clients')}>
          [ CLIENTS ]
        </button>
        <button className={`mode-button ${tab === 'design' ? 'active' : ''}`} onClick={() => setTab('design')}>
          [ DESIGN ]
        </button>
      </div>

      {designError && (
        <div style={{ fontSize: '0.75rem', color: '#ff6b6b', marginBottom: '1rem' }}>
          Could not load the slide design ({designError}); using the built-in one.
        </div>
      )}

      {tab === 'design' && <DesignPage design={design} onDesignChange={setDesign} theme={actualTheme} />}

      {tab === 'clients' && (
        <ClientsPage clients={clients} loadError={clientsError} onClientsChange={setClients} theme={actualTheme} />
      )}

      {/* Claude settings and concurrency apply to longlists and searches alike */}
      <div style={{ display: tab === 'clients' || tab === 'design' ? 'none' : 'block' }}>
        <AiSettings
          activeModel={activeModel}
          modelError={modelError}
          thinkingLevel={thinkingLevel}
          onThinkingLevelChange={setThinkingLevel}
          disabled={processingStatus === 'parsing' || processingStatus === 'extracting'}
          theme={actualTheme}
        />
        <ConcurrencySelector
          level={concurrencyLevel}
          onLevelChange={handleConcurrencyChange}
          theme={actualTheme}
        />
      </div>

      {/* Tabs are hidden rather than removed, so a run in progress keeps going while you look elsewhere */}
      <div style={{ display: tab === 'searches' ? 'block' : 'none' }}>
        <SearchesPage clients={clients} thinkingLevel={thinkingLevel} concurrencyLevel={concurrencyLevel} theme={actualTheme} />
      </div>

      <div style={{ display: tab === 'cvs' ? 'block' : 'none' }}>

      <ParseModeSelector
        mode={parseMode}
        onModeChange={handleParseModeChange}
        theme={actualTheme}
      />

      <ExtraDetailsInput
        selected={extraFields}
        onSelectedChange={setExtraFields}
        disabled={processingStatus === 'parsing' || processingStatus === 'extracting'}
        theme={actualTheme}
      />

      <FirstSlideInput
        clients={clients}
        clientId={firstSlideClientId}
        onClientIdChange={setFirstSlideClientId}
        position={position}
        onPositionChange={setPosition}
        onManageClients={() => setTab('clients')}
        theme={actualTheme}
      />

      <FileUploader
        key={fileUploaderKey}
        onFileSelect={handleFileSelect}
        theme={actualTheme}
        disabled={processingStatus !== 'idle' && processingStatus !== 'done' && processingStatus !== 'error'}
        parseMode={parseMode}
      />

      <ProgressIndicator
        status={processingStatus}
        current={progressCurrent}
        total={progressTotal}
        theme={actualTheme}
      />

      {/* Cost Tracking Display */}
      {(processingStatus === 'extracting' || processingStatus === 'done') && usage.cvReads > 0 && (
        <UsageSummary
          usage={usage}
          candidates={extractedCandidates.length}
          title="API USAGE: THIS RUN"
          note="Not saved: cleared by reset."
          inProgress={processingStatus === 'extracting'}
          model={activeModel}
          theme={actualTheme}
        />
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
            {processingStatus !== 'extracting' && extraFields.length > 0 && (
              <div style={{ marginTop: '0.25rem' }}>
                + extra details: {selectedExtraFields(extraFields).map((field) => field.label).join(', ')}
              </div>
            )}
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
          position={position}
          client={clients.find((c) => c.id === firstSlideClientId) ?? null}
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
              {candidate.extras && candidate.extras.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  {candidate.extras.map((extra, xIdx) => (
                    <div key={xIdx} style={{ fontSize: '0.75rem', marginBottom: '0.25rem', color: textColor, opacity: 0.8 }}>
                      <span style={{ fontWeight: 'bold' }}>{extra.label.toUpperCase()}:</span>{' '}
                      {extra.value || <span style={{ opacity: 0.6 }}>not stated in CV</span>}
                    </div>
                  ))}
                </div>
              )}
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
      </div>

      <div className="footer">
        [ ✅ PDF Parsing | ✅ AI Extraction | ✅ PPTX Generation | 🚀 App Ready! ]
        <div
          title={`Build ${__BUILD_COMMIT__} · ${__BUILD_TIME__}`}
          style={{ marginTop: '0.75rem', fontWeight: 'bold', letterSpacing: '0.1em' }}
        >
          V{APP_VERSION}
        </div>
        <div style={{ marginTop: '0.25rem', fontSize: '0.7rem' }}>
          build {__BUILD_COMMIT__} · {__BUILD_TIME__}
        </div>
      </div>

      {update.needRefresh && (
        <UpdatePrompt
          latestVersion={update.latestVersion}
          onReload={update.updateApp}
          onDismiss={update.dismiss}
          theme={actualTheme}
        />
      )}
    </div>
    </DesignContext.Provider>
  );
}

export default App;