// ════════════════════════════════════════════════════════════
// OSCILLOSCOPE-STYLE WAVEFORM VISUALIZATION
// ════════════════════════════════════════════════════════════

/**
 * Vẽ lưới nền (minimal)
 */
function drawGrid(ctx, W, H) {
  ctx.strokeStyle = '#1e1e3a';
  ctx.lineWidth = 0.5;
  
  // Vẽ đường giữa
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();
  
  // Vẽ một số đường lưới dọc (để tham khảo thời gian)
  ctx.strokeStyle = '#0f1f3a';
  ctx.lineWidth = 0.25;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo((W / 4) * i, 0);
    ctx.lineTo((W / 4) * i, H);
    ctx.stroke();
  }
}

/**
 * Vẽ sóng từ Analyser - AGGRESSIVE ZOOM-IN MODE (chỉ 200 điểm đầu)
 * Sóng to, rõ, di chuyển chậm như máy hiện sóng Oscar
 * Freeze logic: KHÔNG clear khi shouldClear = false (dành cho freeze mode)
 */
function drawFromAnalyser(canvas, analyser, shouldClear = true) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const bufLen = analyser.fftSize;
  const data = new Uint8Array(bufLen);
  analyser.getByteTimeDomainData(data);

  // FREEZE LOGIC: Nếu shouldClear = false, không xóa canvas
  // Sóng cũ sẽ vẫn hiển thị (freeze trên màn hình)
  if (shouldClear) {
    ctx.clearRect(0, 0, W, H);
    drawGrid(ctx, W, H);
  }

  // ZOOM-IN: Chỉ vẽ 200 điểm đầu tiên (của 2048 tổng cộng)
  // Điều này làm sóng to gấp 10 lần, rõ nét và di chuyển chậm
  const visibleLen = Math.min(SLOW_MOTION_SAMPLES, bufLen);
  const sliceW = W / visibleLen;

  ctx.beginPath();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#7b8fff';
  ctx.globalAlpha = 1;

  let x = 0;
  for (let i = 0; i < visibleLen; i++) {
    const v = data[i] / 128.0;
    const y = H - (v * H / 2);
    
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    x += sliceW;
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Vẽ LFO waveform trên mini canvas
 * @param {HTMLCanvasElement} canvas - Mini canvas cho LFO
 * @param {number} lfoFreq - Tần số LFO (Hz)
 * @param {string} waveType - Loại sóng: sine, square, sawtooth, triangle
 */
function drawLFOWaveform(canvas, lfoFreq, waveType) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // Clear canvas
  ctx.clearRect(0, 0, W, H);
  
  // Vẽ lưới
  ctx.strokeStyle = '#1e1e3a';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();

  // Tính số chu kỳ để vẽ (2 chu kỳ đẹp)
  const cycles = 2;
  const samplesPerCycle = W / cycles;
  const totalSamples = Math.floor(W);

  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ff9a44';
  ctx.globalAlpha = 0.9;

  let firstPoint = true;
  for (let i = 0; i < totalSamples; i++) {
    const phase = (i / samplesPerCycle) * Math.PI * 2;
    let value = 0;

    switch (waveType) {
      case 'sine':
        value = Math.sin(phase);
        break;
      case 'square':
        value = phase < Math.PI ? 1 : -1;
        break;
      case 'sawtooth':
        value = 2 * (phase / (2 * Math.PI) - Math.floor(phase / (2 * Math.PI) + 0.5));
        break;
      case 'triangle':
        value = Math.asin(Math.sin(phase)) * (2 / Math.PI);
        break;
      default:
        value = Math.sin(phase);
    }

    const y = (H / 2) - (value * (H / 2.5));
    
    if (firstPoint) {
      ctx.moveTo(i, y);
      firstPoint = false;
    } else {
      ctx.lineTo(i, y);
    }
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Vẽ sóng chính + LFO indicator (với zoom-in 200 samples)
 */
function drawWithLFO(canvas, analyser, lfoFreq, lfoDepth, modulationMode, lfoWaveType = 'sine') {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const bufLen = analyser.fftSize;
  const data = new Uint8Array(bufLen);
  analyser.getByteTimeDomainData(data);

  ctx.clearRect(0, 0, W, H);
  drawGrid(ctx, W, H);

  // ZOOM-IN: Chỉ vẽ 200 điểm đầu tiên (của 2048 tổng)
  const visibleLen = Math.min(SLOW_MOTION_SAMPLES, bufLen);
  const sliceW = W / visibleLen;

  // Vẽ sóng chính (được modulate bởi LFO)
  ctx.beginPath();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#7b8fff';
  ctx.globalAlpha = 0.9;

  let x = 0;
  for (let i = 0; i < visibleLen; i++) {
    const v = data[i] / 128.0;
    const y = (v / 2) * H;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    x += sliceW;
  }
  ctx.stroke();

  // Vẽ LFO indicator line (thể hiện hình dạng LFO đang tác động)
  if (modulationMode !== 'OFF') {
    const lfoY = H * 0.15;
    const now = Date.now() / 1000;
    
    // Tính LFO value dựa trên waveType
    const phase = (now * Math.PI * 2 * lfoFreq) % (2 * Math.PI);
    let lfoValue = 0;
    
    switch (lfoWaveType) {
      case 'sine':
        lfoValue = Math.sin(phase);
        break;
      case 'square':
        lfoValue = phase < Math.PI ? 1 : -1;
        break;
      case 'sawtooth':
        lfoValue = 2 * (phase / (2 * Math.PI) - 0.5);
        break;
      case 'triangle':
        lfoValue = Math.asin(Math.sin(phase)) * (2 / Math.PI);
        break;
      default:
        lfoValue = Math.sin(phase);
    }
    
    lfoValue *= (lfoDepth / 100) * (H * 0.12);

    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ff9a44';
    ctx.globalAlpha = 0.8;
    ctx.moveTo(0, lfoY - lfoValue);
    ctx.lineTo(W, lfoY - lfoValue);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

/**
 * Initialize canvas (không clear - để dùng cho freeze)
 */
function initializeCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);
  drawGrid(ctx, W, H);

  // Vẽ một đường baseline
  ctx.beginPath();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#5a6a8a';
  ctx.globalAlpha = 0.3;
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
