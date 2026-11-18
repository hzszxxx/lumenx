/**
 * Web Audio API based sound synthesizer for interactive drama simulator.
 * Zero external audio assets required; runs seamlessly in any modern browser.
 */

class InteractiveSoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.isMuted) return null;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.ctx || this.ctx.state === "closed") {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === "suspended") {
        void this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.ctx && this.ctx.state === "running") {
      void this.ctx.suspend().catch(() => {});
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * 倒计时心跳/滴答警报音 (当 <= 3 秒紧急时音调更高且更短促)
   */
  public playCountdownTick(urgent: boolean = false) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = urgent ? "sawtooth" : "sine";
      osc.frequency.setValueAtTime(urgent ? 880 : 440, now); // A5 or A4
      osc.frequency.exponentialRampToValueAtTime(urgent ? 660 : 330, now + (urgent ? 0.08 : 0.05));

      gain.gain.setValueAtTime(urgent ? 0.18 : 0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (urgent ? 0.09 : 0.06));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // Ignore audio synthesis errors in test/restricted environments
    }
  }

  /**
   * 做出剧情抉择时的确认音效 (科技感双音阶滑音)
   */
  public playChoiceSelected() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.12); // C6

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {}
  }

  /**
   * 通关与成就达成高光音效 (Major triad arpeggio)
   */
  public playEndingSuccess(secret: boolean = false) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const notes = secret ? [523.25, 659.25, 783.99, 1046.5, 1318.51] : [440, 554.37, 659.25, 880];
      const step = 0.08;

      notes.forEach((freq, idx) => {
        if (!ctx) return;
        const now = ctx.currentTime + idx * step;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.35);
      });
    } catch {}
  }

  /**
   * 挫败/Bad End 沉闷下潜音效
   */
  public playEndingDefeat() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now); // A3
      osc.frequency.exponentialRampToValueAtTime(65.41, now + 0.35); // C2

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.42);
    } catch {}
  }
}

export const interactiveSoundEngine = new InteractiveSoundEngine();
