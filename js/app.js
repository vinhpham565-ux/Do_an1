// ════════════════════════════════════════════════════════════
// PROFESSIONAL OSCILLOSCOPE - WAVEFORM ANALYZER (WASM C++ EDITION)
// ════════════════════════════════════════════════════════════

const { useState, useRef, useEffect } = React;

function App() {
  // ─────── STATE: ONLY for UI triggers ──────────
  const [playing, setPlaying] = useState(false);
  const [initializedMain, setInitializedMain] = useState(false);
  const [sliderUpdate, setSliderUpdate] = useState(0);

  // ─────── REFS: ALL real-time values (No re-renders) ──────────
  const canvasRef = useRef(null);
  const lfoCanvasRef = useRef(null);
  const rafRef = useRef(null);
  const lfoRafRef = useRef(null);
  const audioCtxRef = useRef(null);
  const oscillatorRef = useRef(null); // Sẽ chứa Class C++
  const gainRef = useRef(null);
  const analyserRef = useRef(null);

  // ─────── PARAMETER REFS (Real-time) ──────────
  const paramsRef = useRef({
    amplitude: DEFAULT_AMPLITUDE,
    frequency: DEFAULT_FREQUENCY,
    waveType: DEFAULT_WAVE_TYPE,
    lfoFrequency: DEFAULT_LFO_FREQUENCY,
    lfoDepth: DEFAULT_LFO_DEPTH,
    modulationMode: DEFAULT_MODULATION_MODE,
    lfoWaveType: DEFAULT_LFO_WAVE_TYPE
  });

  // ─────── INITIALIZE AUDIO CONTEXT & WASM MODULE ──────────
  const initAudio = async () => {
    if (audioCtxRef.current) return;

    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    
    // --- KHỞI TẠO CLASS C++ ---
    if (typeof Module !== 'undefined' && Module.May_tao_song) {
        oscillatorRef.current = new Module.May_tao_song(audioCtxRef.current.sampleRate);
        console.log("C++ May_tao_song initialized!");
    } else {
        alert("WASM Module chưa tải xong, vui lòng thử lại sau 1 giây!");
        return;
    }

    gainRef.current = audioCtxRef.current.createGain();
    analyserRef.current = audioCtxRef.current.createAnalyser();

    analyserRef.current.fftSize = FFT_SIZE;
    gainRef.current.gain.value = paramsRef.current.amplitude / 100;

    // --- SỬ DỤNG SCRIPTPROCESSOR ĐỂ GỌI C++ MỖI FRAME ---
    const bufferSize = 2048;
    const scriptNode = audioCtxRef.current.createScriptProcessor(bufferSize, 0, 1);
    
    scriptNode.onaudioprocess = (audioProcessingEvent) => {
        const outputBuffer = audioProcessingEvent.outputBuffer;
        const channelData = outputBuffer.getChannelData(0);
        
        // C++ tính toán và điền trực tiếp vào channelData
        for (let i = 0; i < bufferSize; i++) {
            channelData[i] = oscillatorRef.current.xu_ly();
        }
    };

    // Kết nối chuỗi âm thanh
    scriptNode.connect(gainRef.current);
    gainRef.current.connect(analyserRef.current);
    analyserRef.current.connect(audioCtxRef.current.destination);

    // Apply default settings
    oscillatorRef.current.chon_tan_so(paramsRef.current.frequency);
    oscillatorRef.current.chon_loai_dong(WAVE_TYPES.indexOf(paramsRef.current.waveType));
    
    // LFO Defaults
    oscillatorRef.current.chon_lfo_tan_so(paramsRef.current.lfoFrequency);
    oscillatorRef.current.chon_lfo_loai_song(LFO_WAVE_TYPES.indexOf(paramsRef.current.lfoWaveType));
    oscillatorRef.current.chon_lfo_depth(paramsRef.current.lfoDepth / 100);
    oscillatorRef.current.chon_che_do_mod(MODULATION_MODES.indexOf(paramsRef.current.modulationMode));

    setInitializedMain(true);
  };

  // ─────── START/STOP ──────────
  const togglePlay = async () => {
    if (!audioCtxRef.current) await initAudio();

    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }

    if (playing) {
      gainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.05);
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(lfoRafRef.current);
    } else {
      gainRef.current.gain.setTargetAtTime(paramsRef.current.amplitude / 100, audioCtxRef.current.currentTime, 0.05);
      renderFrame();
      renderLfoFrame();
    }
    setPlaying(!playing);
  };

  // ─────── EVENT HANDLERS ──────────
  const handleAmpChange = (val) => {
    paramsRef.current.amplitude = val;
    if (gainRef.current && playing) {
      gainRef.current.gain.setTargetAtTime(val / 100, audioCtxRef.current.currentTime, 0.05);
    }
    setSliderUpdate(prev => prev + 1);
  };

  const handleFreqChange = (val) => {
    paramsRef.current.frequency = val;
    if (oscillatorRef.current) {
        oscillatorRef.current.chon_tan_so(val);
    }
    setSliderUpdate(prev => prev + 1);
  };

  const setWave = (w) => {
    paramsRef.current.waveType = w;
    if (oscillatorRef.current) {
        oscillatorRef.current.chon_loai_dong(WAVE_TYPES.indexOf(w));
    }
    setSliderUpdate(prev => prev + 1);
  };

  const setModMode = (mode) => {
    paramsRef.current.modulationMode = mode;
    if (oscillatorRef.current) {
        oscillatorRef.current.chon_che_do_mod(MODULATION_MODES.indexOf(mode));
    }
    setSliderUpdate(prev => prev + 1);
  };

  const setLfoWave = (w) => {
    paramsRef.current.lfoWaveType = w;
    if (oscillatorRef.current) {
        oscillatorRef.current.chon_lfo_loai_song(LFO_WAVE_TYPES.indexOf(w));
    }
    setSliderUpdate(prev => prev + 1);
  };

  const handleLfoFreqChange = (val) => {
    paramsRef.current.lfoFrequency = val;
    if (oscillatorRef.current) {
        oscillatorRef.current.chon_lfo_tan_so(val);
    }
    setSliderUpdate(prev => prev + 1);
  };

  const handleLfoDepthChange = (val) => {
    paramsRef.current.lfoDepth = val;
    if (oscillatorRef.current) {
        oscillatorRef.current.chon_lfo_depth(val / 100);
    }
    setSliderUpdate(prev => prev + 1);
  };

  // ─────── RENDERING LOOPS ──────────
  const renderFrame = () => {
    if (canvasRef.current && analyserRef.current) {
      drawFromAnalyser(canvasRef.current, analyserRef.current);
    }
    rafRef.current = requestAnimationFrame(renderFrame);
  };

  const renderLfoFrame = () => {
    if (lfoCanvasRef.current) {
      drawLFOOnly(
        lfoCanvasRef.current,
        paramsRef.current.lfoWaveType,
        paramsRef.current.lfoFrequency,
        paramsRef.current.modulationMode
      );
    }
    lfoRafRef.current = requestAnimationFrame(renderLfoFrame);
  };

  // ─────── CLEANUP ──────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(lfoRafRef.current);
      if (oscillatorRef.current) {
          oscillatorRef.current.delete(); // Xóa memory C++
      }
    };
  }, []);

  const period = (1000 / paramsRef.current.frequency).toFixed(2);

  return (
    <div className="container">
      <header>
        {/* ĐÃ SỬA TÊN Ở ĐÂY */}
        <h1>Bộ Tổng Hợp Âm Thanh <span style={{ fontSize: '1.2rem', color: '#ff9a44' }}>(C++ WASM)</span></h1>
        <p className="subtitle">Nền Tảng Xử Lý Tín Hiệu Số (DSP)</p>
      </header>

      <div className="main-grid">
        {/* CARRIER OSCILLATOR PANEL */}
        <div className="panel osc-panel">
          <div className="panel-header">CARRIER OSCILLATOR</div>
          
          <div className="wave-selector">
            {WAVE_TYPES.map(w => (
              <button 
                key={w} 
                className={`wave-btn ${paramsRef.current.waveType === w ? 'active' : ''}`}
                onClick={() => setWave(w)}
              >
                {WAVE_LABELS[w]}
              </button>
            ))}
          </div>

          <div className="controls">
            <div className="control-group">
              <div className="control-label">
                <span className="control-name">Amplitude</span>
                <span className="control-value">{paramsRef.current.amplitude}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                defaultValue={DEFAULT_AMPLITUDE}
                onChange={(e) => handleAmpChange(Number(e.target.value))}
              />
            </div>

            <div className="control-group">
              <div className="control-label">
                <span className="control-name">Frequency</span>
                <span className="control-value">{paramsRef.current.frequency} Hz</span>
              </div>
              <input
                type="range"
                min="20"
                max="2000"
                defaultValue={DEFAULT_FREQUENCY}
                onChange={(e) => handleFreqChange(Number(e.target.value))}
              />
            </div>
            
            <button className={`play-btn ${playing ? 'playing' : ''}`} onClick={togglePlay}>
              {playing ? '■ STOP SYSTEM' : '▶ START SYSTEM'}
            </button>
          </div>
        </div>

        {/* MAIN OSCILLOSCOPE PANEL */}
        <div className="panel screen-panel">
          <div className="screen-header">
            <span>CH1: OUTPUT ANALYZER</span>
            <span style={{ color: playing ? '#4ade80' : '#f87171' }}>
              {playing ? '● ACTIVE' : '○ STANDBY'}
            </span>
          </div>
          <div className="canvas-container">
            <canvas ref={canvasRef} width={800} height={400} />
          </div>
        </div>

        {/* LFO PANEL */}
        <div className="panel lfo-panel">
          <div className="panel-header">LFO MODULATION LAB</div>
          
          <div className="lfo-visualizer">
             <canvas ref={lfoCanvasRef} width={300} height={100} />
          </div>
          
          <div className="lfo-wave-selector">
            {LFO_WAVE_TYPES.map(w => (
              <button 
                key={`lfo-${w}`} 
                className={`lfo-wave-btn ${paramsRef.current.lfoWaveType === w ? 'active' : ''}`}
                onClick={() => setLfoWave(w)}
              >
                {LFO_WAVE_LABELS[w]}
              </button>
            ))}
          </div>

          <div className="lfo-mode-buttons">
            {MODULATION_MODES.map(mode => (
              <button 
                key={mode} 
                className={`lfo-mode-btn ${paramsRef.current.modulationMode === mode ? 'active' : ''}`}
                onClick={() => setModMode(mode)}
              >
                {MODULATION_LABELS[mode]}
              </button>
            ))}
          </div>

          <div className="controls">
            <div className={`control-group ${paramsRef.current.modulationMode === 'OFF' ? 'disabled' : ''}`}>
              <div className="control-label">
                <span className="control-name">LFO Rate</span>
                <span className="control-value">{paramsRef.current.lfoFrequency.toFixed(2)} Hz</span>
              </div>
              <input
                type="range"
                min={LFO_FREQ_MIN}
                max={LFO_FREQ_MAX}
                step="0.01"
                defaultValue={DEFAULT_LFO_FREQUENCY}
                onChange={(e) => handleLfoFreqChange(Number(e.target.value))}
              />
            </div>

            <div className={`control-group ${paramsRef.current.modulationMode === 'OFF' ? 'disabled' : ''}`}>
              <div className="control-label">
                <span className="control-name">Modulation Depth</span>
                <span className="control-value">{paramsRef.current.lfoDepth}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                defaultValue={DEFAULT_LFO_DEPTH}
                onChange={(e) => handleLfoDepthChange(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="info-row">
        <div className="info-chip">Freq: <span>{paramsRef.current.frequency}Hz</span></div>
        <div className="info-chip">Period: <span>{period}ms</span></div>
        <div className="info-chip">Amplitude: <span>{paramsRef.current.amplitude}%</span></div>
        
        <div className={`info-chip ${paramsRef.current.modulationMode === 'OFF' ? 'v-hidden' : ''}`}>
          Modulation: <span style={{ color: '#ff9a44' }}>
            {paramsRef.current.modulationMode === 'AM' ? '🔊 AM' : paramsRef.current.modulationMode === 'FM' ? '📈 FM' : 'OFF'}
          </span>
        </div>
        <div className={`info-chip ${paramsRef.current.modulationMode === 'OFF' ? 'v-hidden' : ''}`}>LFO Rate: <span>{paramsRef.current.lfoFrequency.toFixed(2)}Hz</span></div>
        <div className={`info-chip ${paramsRef.current.modulationMode === 'OFF' ? 'v-hidden' : ''}`}>LFO Wave: <span>{LFO_WAVE_LABELS[paramsRef.current.lfoWaveType]}</span></div>
        <div className={`info-chip ${paramsRef.current.modulationMode === 'OFF' ? 'v-hidden' : ''}`}>LFO Depth: <span>{paramsRef.current.lfoDepth}%</span></div>
        
        <div className="info-chip">
          Status: <span style={{ color: playing ? '#4ade80' : '#f87171' }}>
            {playing ? 'Playing' : 'Stopped'}
          </span>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);