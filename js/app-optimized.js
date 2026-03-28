// ════════════════════════════════════════════════════════════
// WAVE SYNTHESIZER - OPTIMIZED FOR PERFORMANCE
// ════════════════════════════════════════════════════════════

const { useState, useRef, useEffect } = React;

/**
 * App chính
 */
function App() {
  // ─────── STATE: ONLY for UI triggers (Minimize re-renders) ──────────
  const [playing, setPlaying] = useState(false);

  // ─────── REFS: ALL real-time values (No re-renders) ──────────
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const audioCtxRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainRef = useRef(null);
  const analyserRef = useRef(null);
  const lfoOscRef = useRef(null);
  const lfoGainRef = useRef(null);
  const fmGainRef = useRef(null);

  // ─────── PARAMETER REFS (Real-time, no re-render) ──────────
  const paramsRef = useRef({
    amplitude: DEFAULT_AMPLITUDE,
    frequency: DEFAULT_FREQUENCY,
    waveType: DEFAULT_WAVE_TYPE,
    lfoFrequency: DEFAULT_LFO_FREQUENCY,
    lfoDepth: DEFAULT_LFO_DEPTH,
    modulationMode: DEFAULT_MODULATION_MODE,
  });

  // ─────── SETUP CANVAS ──────────
  useEffect(() => {
    const canvas = canvasRef.current;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    };

    resize();
    window.addEventListener('resize', resize);
    drawIdle(canvas);

    return () => window.removeEventListener('resize', resize);
  }, []);

  // ─────── ANIMATION LOOP (Runs ONCE, reads from refs) ──────────
  useEffect(() => {
    const canvas = canvasRef.current;

    function loop() {
      if (analyserRef.current) {
        const mode = paramsRef.current.modulationMode;
        if (mode !== 'OFF') {
          drawWithLFO(
            canvas,
            analyserRef.current,
            paramsRef.current.lfoFrequency,
            paramsRef.current.lfoDepth,
            mode
          );
        } else {
          drawFromAnalyser(canvas, analyserRef.current);
        }
      } else {
        drawIdle(canvas);
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // ← Empty! Runs once only

  // ─────── LFO 동적 라우팅 함수 ──────────
  function reconnectLFO(newMode) {
    const ctx = audioCtxRef.current;
    const lfoOsc = lfoOscRef.current;
    const lfoGain = lfoGainRef.current;
    const osc = oscillatorRef.current;
    const gain = gainRef.current;

    if (!ctx || !lfoOsc || !lfoGain || !osc || !gain) return;

    try {
      lfoGain.disconnect();
    } catch (e) {}

    if (fmGainRef.current) {
      try {
        fmGainRef.current.disconnect();
      } catch (e) {}
      fmGainRef.current = null;
    }

    if (newMode === 'AM') {
      lfoOsc.connect(lfoGain);
      lfoGain.connect(gain.gain);
    } else if (newMode === 'FM') {
      const fmGain = ctx.createGain();
      const baseFreq = paramsRef.current.frequency;
      const maxFreqDeviation = Math.min(100, baseFreq * 0.5);
      fmGain.gain.setValueAtTime(maxFreqDeviation, ctx.currentTime);

      lfoOsc.connect(lfoGain);
      lfoGain.connect(fmGain);
      fmGain.connect(osc.frequency);

      fmGainRef.current = fmGain;
    }
  }

  // ─────── PHÁT ÂM THANH ──────────
  function startAudio() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;

    const osc = ctx.createOscillator();
    osc.type = paramsRef.current.waveType;
    osc.frequency.setValueAtTime(paramsRef.current.frequency, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(paramsRef.current.amplitude / 100, ctx.currentTime);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;

    osc.connect(gain);
    gain.connect(analyser);
    analyser.connect(ctx.destination);
    osc.start();

    const lfoOsc = ctx.createOscillator();
    lfoOsc.type = 'sine';
    lfoOsc.frequency.setValueAtTime(paramsRef.current.lfoFrequency, ctx.currentTime);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(paramsRef.current.lfoDepth / 100, ctx.currentTime);

    lfoOsc.start();

    oscillatorRef.current = osc;
    gainRef.current = gain;
    analyserRef.current = analyser;
    lfoOscRef.current = lfoOsc;
    lfoGainRef.current = lfoGain;

    reconnectLFO(paramsRef.current.modulationMode);
    setPlaying(true);
  }

  // ─────── DỪNG ÂM THANH ──────────
  function stopAudio() {
    if (lfoOscRef.current) {
      lfoOscRef.current.stop();
      lfoOscRef.current.disconnect();
      lfoOscRef.current = null;
    }

    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current.disconnect();
      oscillatorRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }

    gainRef.current = null;
    analyserRef.current = null;
    lfoGainRef.current = null;
    setPlaying(false);
  }

  function togglePlay() {
    playing ? stopAudio() : startAudio();
  }

  // ─────── CẬP NHẬT THAM SỐ (Không trigger re-render) ──────────
  const handleAmplitudeChange = (val) => {
    paramsRef.current.amplitude = val;
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
    if (oscillatorRef.current && audioCtxRef.current) {
      oscillatorRef.current.frequency.setTargetAtTime(
        val,
        audioCtxRef.current.currentTime,
        0.01
      );
      if (playing && fmGainRef.current && paramsRef.current.modulationMode === 'FM') {
        const maxFreqDeviation = Math.min(100, val * 0.5);
        fmGainRef.current.gain.setTargetAtTime(
          maxFreqDeviation,
          audioCtxRef.current.currentTime,
          0.01
        );
      }
    }
  };

  const handleWaveTypeChange = (type) => {
    paramsRef.current.waveType = type;
    if (oscillatorRef.current) {
      oscillatorRef.current.type = type;
    }
  };

  const handleLfoFrequencyChange = (val) => {
    paramsRef.current.lfoFrequency = val;
    if (lfoOscRef.current && audioCtxRef.current) {
      lfoOscRef.current.frequency.setTargetAtTime(
        val,
        audioCtxRef.current.currentTime,
        0.01
      );
    }
  };

  const handleLfoDepthChange = (val) => {
    paramsRef.current.lfoDepth = val;
    if (lfoGainRef.current && audioCtxRef.current) {
      lfoGainRef.current.gain.setTargetAtTime(
        val / 100,
        audioCtxRef.current.currentTime,
        0.01
      );
    }
  };

  const handleModulationModeChange = (mode) => {
    paramsRef.current.modulationMode = mode;
    if (playing) {
      reconnectLFO(mode);
    }
  };

  useEffect(() => {
    return () => stopAudio();
  }, []);

  const period = (1000 / paramsRef.current.frequency).toFixed(2);

  // ─────── RENDER ──────────
  return (
    <>
      <h1>Wave Synthesizer</h1>
      <p className="subtitle">Bộ tổng hợp sóng âm thanh thực tế từ Web Audio API</p>

      <div className={`canvas-wrapper${playing ? ' playing' : ''}`}>
        <span className={`canvas-badge${playing ? ' live' : ''}`}>
          {playing ? '● Live' : '○ Idle'}
        </span>
        <canvas ref={canvasRef} style={{ height: '240px' }} />
      </div>

      <div className="play-row">
        <button
          className={`play-btn ${playing ? 'playing' : 'stopped'}`}
          onClick={togglePlay}
        >
          {playing ? '⏹ Stop' : '▶ Play'}
        </button>
      </div>

      <div className="wave-type-row">
        {WAVE_TYPES.map((t) => (
          <button
            key={t}
            className={`wave-btn${paramsRef.current.waveType === t ? ' active' : ''}`}
            onClick={() => {
              handleWaveTypeChange(t);
              // Force UI update
              document.querySelectorAll('.wave-btn').forEach((btn, idx) => {
                btn.classList.toggle('active', WAVE_TYPES[idx] === t);
              });
            }}
          >
            {WAVE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="controls">
        <div className="control-card">
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

        <div className="control-card">
          <div className="control-label">
            <span className="control-name">Frequency</span>
            <span className="control-value">{paramsRef.current.frequency}Hz</span>
          </div>
          <input
            type="range"
            min="20"
            max="2000"
            defaultValue={DEFAULT_FREQUENCY}
            onChange={(e) => handleFrequencyChange(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="lfo-section">
        <h3>LFO Engine</h3>

        <div className="lfo-mode-buttons">
          {MODULATION_MODES.map((mode) => (
            <button
              key={mode}
              className={`lfo-mode-btn${paramsRef.current.modulationMode === mode ? ' active' : ''}`}
              onClick={() => {
                handleModulationModeChange(mode);
                document
                  .querySelectorAll('.lfo-mode-btn')
                  .forEach((btn) => btn.classList.remove('active'));
                event.target.classList.add('active');
              }}
            >
              {MODULATION_LABELS[mode] || mode}
            </button>
          ))}
        </div>

        <div className="controls">
          <div className="control-card">
            <div className="control-label">
              <span className="control-name">LFO Freq</span>
              <span className="control-value">{paramsRef.current.lfoFrequency.toFixed(2)}Hz</span>
            </div>
            <input
              type="range"
              min={LFO_FREQ_MIN}
              max={LFO_FREQ_MAX}
              step="0.1"
              defaultValue={DEFAULT_LFO_FREQUENCY}
              onChange={(e) => handleLfoFrequencyChange(Number(e.target.value))}
            />
          </div>

          <div className="control-card">
            <div className="control-label">
              <span className="control-name">LFO Depth</span>
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

      <div className="info-row">
        <div className="info-chip">Wave: <span>{WAVE_LABELS[paramsRef.current.waveType]}</span></div>
        <div className="info-chip">Amplitude: <span>{paramsRef.current.amplitude}%</span></div>
        <div className="info-chip">Frequency: <span>{paramsRef.current.frequency}Hz</span></div>
        <div className="info-chip">Period: <span>{period}ms</span></div>
        {paramsRef.current.modulationMode !== 'OFF' && (
          <>
            <div className="info-chip">LFO Mode: <span>{paramsRef.current.modulationMode}</span></div>
            <div className="info-chip">LFO Freq: <span>{paramsRef.current.lfoFrequency.toFixed(2)}Hz</span></div>
          </>
        )}
        <div className="info-chip">
          Status: <span style={{ color: playing ? '#4ade80' : '#f87171' }}>
            {playing ? 'Playing' : 'Stopped'}
          </span>
        </div>
      </div>
    </>
  );
}

// Render
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
