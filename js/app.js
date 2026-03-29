// ════════════════════════════════════════════════════════════
// BỘ TỔNG HỢP ÂM THANH - GIAO DIỆN MỚI + LOGIC ÂM THANH GỐC
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
    lfoWaveType: DEFAULT_LFO_WAVE_TYPE,
  });

  // ─────── MAIN CANVAS SETUP ──────────
  useEffect(() => {
    const canvas = canvasRef.current;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    };

    resize();
    window.addEventListener('resize', resize);
    initializeCanvas(canvas);
    setInitializedMain(true);

    return () => window.removeEventListener('resize', resize);
  }, []);

  // ─────── MINI LFO CANVAS SETUP ──────────
  useEffect(() => {
    const canvas = lfoCanvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    };

    resize();
    window.addEventListener('resize', resize);
    drawLFOWaveform(canvas, DEFAULT_LFO_FREQUENCY, DEFAULT_LFO_WAVE_TYPE);

    return () => window.removeEventListener('resize', resize);
  }, []);

  // ─────── MAIN ANIMATION LOOP (Waveform - FROZEN on stop) ──────────
  useEffect(() => {
    const canvas = canvasRef.current;

    function loop() {
      if (analyserRef.current && playing) {
        // Draw when playing - ALWAYS clear canvas each frame
        const mode = paramsRef.current.modulationMode;
        if (mode !== 'OFF') {
          drawWithLFO(
            canvas,
            analyserRef.current,
            paramsRef.current.lfoFrequency,
            paramsRef.current.lfoDepth,
            mode,
            paramsRef.current.lfoWaveType
          );
        } else {
          // Normal mode - draw and clear every frame
          drawFromAnalyser(canvas, analyserRef.current, true);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]); 

  // ─────── MINI LFO ANIMATION LOOP ──────────
  useEffect(() => {
    const canvas = lfoCanvasRef.current;
    if (!canvas) return;

    function loop() {
      drawLFOWaveform(canvas, paramsRef.current.lfoFrequency, paramsRef.current.lfoWaveType);
      lfoRafRef.current = requestAnimationFrame(loop);
    }

    lfoRafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(lfoRafRef.current);
  }, []);

  // ─────── PHÁT ÂM THANH ──────────
  const waveMap = { 'sine': 0, 'sawtooth': 1, 'square': 2, 'triangle': 3 };
  const modMap = { 'OFF': 0, 'AM': 1, 'FM': 2 }; 
  let wasmModuleCache = null;

  async function loadWasmModule() {
    if (wasmModuleCache) {
      return wasmModuleCache;
    }
    try {
      console.log("📍 [App] Loading WASM module (KhoiTaoLoi)...");
      
      // FIX LỖI WASM: Thêm cơ chế chờ (Polling)
      let attempts = 0;
      while (typeof window.KhoiTaoLoi !== 'function' && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Đợi 100ms mỗi vòng lặp
        attempts++;
      }

      if (typeof window.KhoiTaoLoi !== 'function') {
        throw new Error('KhoiTaoLoi not found - Hãy chắc chắn bạn đã link may_tao_song.js trong file index.html');
      }
      
      const Module = await window.KhoiTaoLoi();
      console.log("✅ [App] WASM Module loaded successfully!");
      wasmModuleCache = Module;
      return Module;
    } catch (error) {
      console.error("❌ [App] Failed to load WASM module:", error);
      throw error;
    }
  }

  async function startAudio() {
    console.log("📍 Khởi động Audio Engine...");
    
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;

    // 1. Tải WASM Module
    let wasmModule;
    try {
      wasmModule = await loadWasmModule();
    } catch (e) {
      alert('Lỗi tải C++ WASM: ' + e.message);
      return;
    }

    // 2. Khởi tạo thuật toán C++ ngay trên luồng chính
    const cppOscillator = new wasmModule.May_tao_song(ctx.sampleRate);
    cppOscillator.chon_tan_so(paramsRef.current.frequency);
    cppOscillator.chon_loai_dong(waveMap[paramsRef.current.waveType] || 0);
    
    // Truyền luôn các thông số LFO mặc định vào C++ khi vừa tạo máy
    cppOscillator.chon_lfo_tan_so(paramsRef.current.lfoFrequency);
    cppOscillator.chon_lfo_depth(paramsRef.current.lfoDepth / 100);
    cppOscillator.chon_lfo_loai_dong(waveMap[paramsRef.current.lfoWaveType] || 0);
    cppOscillator.chon_che_do_mod(modMap[paramsRef.current.modulationMode] || 0);

    oscillatorRef.current = cppOscillator;

    // 3. Tạo cầu nối lấy dữ liệu từ C++ ra loa (ScriptProcessor)
    const processor = ctx.createScriptProcessor(4096, 0, 1);
    processor.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      for (let i = 0; i < output.length; i++) {
        // GỌI HÀM C++ LIÊN TỤC Ở ĐÂY!
        output[i] = cppOscillator.xu_ly();
      }
    };
    window.myAudioProcessor = processor; 

    // 4. Các Node xử lý âm lượng và đồ thị của JS
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(paramsRef.current.amplitude / 100, ctx.currentTime);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;

    // 5. Nối dây tín hiệu: C++ Processor -> Gain -> Analyser -> Loa
    processor.connect(gain);
    gain.connect(analyser);
    analyser.connect(ctx.destination);

    // Gán refs
    gainRef.current = gain;
    analyserRef.current = analyser;

    setPlaying(true);
    console.log("✅ Hệ thống đã chạy hoàn toàn bằng C++!");
  }

  // ─────── DỪNG ÂM THANH ──────────
  function stopAudio() {
    if (window.myAudioProcessor) {
      window.myAudioProcessor.disconnect();
      window.myAudioProcessor = null;
    }

    if (oscillatorRef.current) {
      oscillatorRef.current.delete(); // Giải phóng RAM C++
      oscillatorRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }

    gainRef.current = null;
    analyserRef.current = null;
    setPlaying(false);
  }

  async function togglePlay() {
    if (playing) {
      stopAudio();
    } else {
      await startAudio();
    }
  }

  // ─────── CẬP NHẬT THAM SỐ XUỐNG C++ ──────────
  const handleAmplitudeChange = (val) => {
    paramsRef.current.amplitude = val;
    setSliderUpdate(prev => prev + 1); 
    if (gainRef.current && audioCtxRef.current) {
      gainRef.current.gain.setTargetAtTime(
        val / 100,
        audioCtxRef.current.currentTime,
        0.01
      );
    }
  };

  const handleFrequencyChange = (val) => {
    paramsRef.current.frequency = val;
    setSliderUpdate(prev => prev + 1); 
    if (oscillatorRef.current) {
      oscillatorRef.current.chon_tan_so(val);
    }
  };

  const handleWaveTypeChange = (type) => {
    paramsRef.current.waveType = type;
    setSliderUpdate(prev => prev + 1);
    if (oscillatorRef.current) {
      oscillatorRef.current.chon_loai_dong(waveMap[type] || 0);
    }
  };

  const handleLfoFrequencyChange = (val) => {
    paramsRef.current.lfoFrequency = val;
    setSliderUpdate(prev => prev + 1); 
    if (oscillatorRef.current) {
      oscillatorRef.current.chon_lfo_tan_so(val);
    }
  };

  const handleLfoDepthChange = (val) => {
    paramsRef.current.lfoDepth = val;
    setSliderUpdate(prev => prev + 1); 
    if (oscillatorRef.current) {
      oscillatorRef.current.chon_lfo_depth(val / 100);
    }
  };

  const handleLfoWaveTypeChange = (type) => {
    paramsRef.current.lfoWaveType = type;
    setSliderUpdate(prev => prev + 1);
    if (oscillatorRef.current) {
      oscillatorRef.current.chon_lfo_loai_dong(waveMap[type] || 0);
    }
  };

  const handleModulationModeChange = (mode) => {
    paramsRef.current.modulationMode = mode;
    setSliderUpdate(prev => prev + 1);
    if (oscillatorRef.current) {
      oscillatorRef.current.chon_che_do_mod(modMap[mode] || 0);
    }
  };

  useEffect(() => {
    return () => stopAudio();
  }, []);

  const period = (1000 / paramsRef.current.frequency).toFixed(2);

  // ─────── RENDER KẾT HỢP GIAO DIỆN MỚI ──────────
  return (
    <div className="container">
      <header>
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
                onClick={() => handleWaveTypeChange(w)}
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
                onChange={(e) => handleAmplitudeChange(Number(e.target.value))}
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
                onChange={(e) => handleFrequencyChange(Number(e.target.value))}
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
                onClick={() => handleLfoWaveTypeChange(w)}
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
                onClick={() => handleModulationModeChange(mode)}
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
                onChange={(e) => handleLfoFrequencyChange(Number(e.target.value))}
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

// Render
ReactDOM.createRoot(document.getElementById('root')).render(<App />);