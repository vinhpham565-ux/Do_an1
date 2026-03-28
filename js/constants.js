// ════════════════════════════════════════════════════════════
// HẰNG SỐ VÀ CẤU HÌNH
// ════════════════════════════════════════════════════════════

// Các loại sóng có sẵn
const WAVE_TYPES = ['sine', 'square', 'sawtooth', 'triangle'];

// Tên hiển thị cho mỗi loại sóng
const WAVE_LABELS = {
  sine: 'Sine',
  square: 'Square',
  sawtooth: 'Sawtooth',
  triangle: 'Triangle'
};

// Giá trị mặc định cho âm lượng (0-100%)
const DEFAULT_AMPLITUDE = 60;

// Giá trị mặc định cho tần số (Hz)
const DEFAULT_FREQUENCY = 440;

// Loại sóng mặc định
const DEFAULT_WAVE_TYPE = 'sine';

// Cài đặt FFT size cho Analyser (phải là số mũ của 2)
const FFT_SIZE = 2048;

// ════════════════════════════════════════════════════════════
// LFO (Low-Frequency Oscillator) CẤU HÌNH
// ════════════════════════════════════════════════════════════

// Các loại modulation
const MODULATION_MODES = ['OFF', 'AM', 'FM'];
const MODULATION_LABELS = {
  OFF: 'Off',
  AM: 'Amplitude Mod',
  FM: 'Frequency Mod'
};

// Giá trị mặc định LFO
const DEFAULT_LFO_FREQUENCY = 2;      // 2 Hz
const DEFAULT_LFO_DEPTH = 50;          // 0-100%
const DEFAULT_MODULATION_MODE = 'OFF'; // OFF, AM, hoặc FM

// LFO Wave Types
const LFO_WAVE_TYPES = ['sine', 'square', 'sawtooth', 'triangle'];
const LFO_WAVE_LABELS = {
  sine: 'Sine',
  square: 'Square',
  sawtooth: 'Sawtooth',
  triangle: 'Triangle'
};
const DEFAULT_LFO_WAVE_TYPE = 'sine';

// Giới hạn LFO Frequency (Hz)
const LFO_FREQ_MIN = 0.1;
const LFO_FREQ_MAX = 20;

// Aggressive zoom-in: Draw only first N samples (not percentage)
// This makes waveform HUGE, clear, and move slowly like real oscilloscope
// 100 samples = 20x magnification (2048 / 100 = 20.48)
const SLOW_MOTION_SAMPLES = 2048; // Draw ALL samples for full view (original behavior)

// Màu sắc chủ yếu
const COLORS = {
  primary: '#7b8fff',      // Xanh chủ đạo
  accent: '#aab0ff',        // Xanh nhạt
  success: '#6dff8a',       // Xanh lá thành công
  danger: '#ff7b9a',        // Đỏ cảnh báo
  background: '#0f0f1a',    // Nền đen
  cardBackground: '#13132b', // Nền card
  border: '#2a2a5a',        // Viền
  lfo: '#ff9a44',           // Cam - cho LFO
  modulated: '#44d9ff'      // Cyan - cho sóng đã điều chế
};
