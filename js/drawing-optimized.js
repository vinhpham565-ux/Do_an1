// ════════════════════════════════════════════════════════════
// OPTIMIZED CANVAS DRAWING - LIGHTWEIGHT
// ════════════════════════════════════════════════════════════

/**
 * Vẽ lưới nền (minimal)
 */
function drawGrid(ctx, W, H) {
  ctx.strokeStyle = '#1e1e3a';
  ctx.lineWidth = 0.5;
  
  // Only draw center line
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();
}

/**
 * Vẽ sóng từ Analyser (tối ưu: giảm số điểm vẽ)
 */
function drawFromAnalyser(canvas, analyser) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const bufLen = analyser.fftSize;
  const data = new Uint8Array(bufLen);
  analyser.getByteTimeDomainData(data);

  ctx.clearRect(0, 0, W, H);
  drawGrid(ctx, W, H);

  const sliceW = W / bufLen;

  // Chỉ vẽ 1 lớp duy nhất (không lớp bóng)
  ctx.beginPath();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#7b8fff';
  ctx.globalAlpha = 1;

  let x = 0;
  for (let i = 0; i < bufLen; i++) {
    const v = data[i] / 128.0;
    const y = (v / 2) * H;

    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    x += sliceW;
  }
  ctx.stroke();

  ctx.globalAlpha = 1;
}

/**
 * Vẽ idle state
 */
function drawIdle(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);
  drawGrid(ctx, W, H);

  ctx.beginPath();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#5a6a8a';
  ctx.globalAlpha = 0.5;
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

/**
 * Vẽ LFO + sóng chính (tối ưu: rút gọn logic)
 */
function drawWithLFO(canvas, analyser, lfoFreq, lfoDepth, modulationMode) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const bufLen = analyser.fftSize;
  const data = new Uint8Array(bufLen);
  analyser.getByteTimeDomainData(data);

  ctx.clearRect(0, 0, W, H);
  drawGrid(ctx, W, H);

  const sliceW = W / bufLen;
  const now = Date.now() / 1000;

  // Vẽ sóng chính
  ctx.beginPath();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#7b8fff';
  ctx.globalAlpha = 0.8;

  let x = 0;
  for (let i = 0; i < bufLen; i++) {
    const v = data[i] / 128.0;
    const y = (v / 2) * H;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    x += sliceW;
  }
  ctx.stroke();

  // Vẽ LFO indicator (line ở trên cùng)
  if (modulationMode !== 'OFF') {
    const lfoY = H * 0.2;
    const lfoValue = Math.sin(now * Math.PI * 2 * lfoFreq) * (lfoDepth / 100) * (H * 0.15);

    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#ff9a44';
    ctx.globalAlpha = 0.6;
    ctx.moveTo(0, lfoY - lfoValue);
    ctx.lineTo(W, lfoY - lfoValue);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}
