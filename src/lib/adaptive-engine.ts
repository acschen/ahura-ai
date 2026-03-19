/**
 * Adaptive visualization engine.
 *
 * Explores visual parameters using a simple epsilon-greedy bandit approach.
 * Tracks which parameter configurations correlate with higher engagement,
 * then steers the visualization toward those configurations.
 */

export interface VizParams {
  hueShift: number; // 0-1
  complexity: number; // 1-8
  speed: number; // 0.2-2.0
  symmetry: number; // 0, 2, 3, 4, 5, 6
  zoom: number; // 0.5-3.0
  distortion: number; // 0-1
}

interface ParamConfig {
  min: number;
  max: number;
  step: number;
}

const PARAM_CONFIGS: Record<keyof VizParams, ParamConfig> = {
  hueShift: { min: 0, max: 1, step: 0.05 },
  complexity: { min: 2, max: 7, step: 0.5 },
  speed: { min: 0.3, max: 1.5, step: 0.1 },
  symmetry: { min: 0, max: 6, step: 1 },
  zoom: { min: 0.8, max: 2.5, step: 0.1 },
  distortion: { min: 0, max: 0.8, step: 0.05 },
};

const DEFAULT_PARAMS: VizParams = {
  hueShift: 0.6,
  complexity: 4,
  speed: 0.6,
  symmetry: 0,
  zoom: 1.2,
  distortion: 0.3,
};

export class AdaptiveEngine {
  private params: VizParams;
  private engagementHistory: { params: VizParams; engagement: number }[] = [];
  private explorationRate = 0.3; // Epsilon: probability of random exploration
  private lastExplorationTime = 0;
  private explorationInterval = 8000; // Explore every 8 seconds
  private currentParamBeingExplored: keyof VizParams | null = null;
  private preExplorationEngagement = 0;

  constructor() {
    this.params = { ...DEFAULT_PARAMS };
  }

  getParams(): VizParams {
    return { ...this.params };
  }

  /**
   * Called every frame with current engagement.
   * Occasionally nudges parameters and measures the result.
   */
  update(engagement: number, deltaTime: number): VizParams {
    const now = Date.now();

    // Record history
    if (this.engagementHistory.length > 200) {
      this.engagementHistory = this.engagementHistory.slice(-100);
    }

    // Check if it's time to explore
    if (now - this.lastExplorationTime > this.explorationInterval) {
      // If we were exploring, evaluate the result
      if (this.currentParamBeingExplored) {
        this.evaluateExploration(engagement);
      }

      // Start new exploration
      if (Math.random() < this.explorationRate) {
        this.startExploration(engagement);
      }

      this.lastExplorationTime = now;
    }

    // Slowly decay exploration rate (exploit more over time)
    this.explorationRate = Math.max(0.1, this.explorationRate - 0.0001 * deltaTime);

    return this.params;
  }

  private startExploration(currentEngagement: number) {
    // Pick a random parameter to explore
    const paramKeys = Object.keys(PARAM_CONFIGS) as Array<keyof VizParams>;
    const param = paramKeys[Math.floor(Math.random() * paramKeys.length)];
    const config = PARAM_CONFIGS[param];

    this.currentParamBeingExplored = param;
    this.preExplorationEngagement = currentEngagement;

    // Nudge the parameter in a random direction
    const direction = Math.random() > 0.5 ? 1 : -1;
    const nudge = config.step * direction * (1 + Math.random());
    const newValue = Math.max(config.min, Math.min(config.max, this.params[param] + nudge));

    this.params[param] = newValue;
  }

  private evaluateExploration(currentEngagement: number) {
    if (!this.currentParamBeingExplored) return;

    const engagementDelta = currentEngagement - this.preExplorationEngagement;

    // Record the result
    this.engagementHistory.push({
      params: { ...this.params },
      engagement: currentEngagement,
    });

    // If engagement went down, partially revert
    if (engagementDelta < -5) {
      const param = this.currentParamBeingExplored;
      const config = PARAM_CONFIGS[param];
      // Revert halfway (don't fully revert — keep some exploration)
      const revertAmount = config.step * 0.5;
      const currentVal = this.params[param];
      // Move back toward the center of the range
      const center = (config.min + config.max) / 2;
      if (currentVal > center) {
        this.params[param] = Math.max(config.min, currentVal - revertAmount);
      } else {
        this.params[param] = Math.min(config.max, currentVal + revertAmount);
      }
    }

    // If engagement went up significantly, double down
    if (engagementDelta > 10) {
      // Keep the change and reduce exploration rate for this session
      this.explorationRate = Math.max(0.05, this.explorationRate - 0.02);
    }

    this.currentParamBeingExplored = null;
  }

  /**
   * Get the best parameter configuration from history.
   */
  getBestConfig(): VizParams | null {
    if (this.engagementHistory.length < 5) return null;

    // Find the entry with highest engagement
    let best = this.engagementHistory[0];
    for (const entry of this.engagementHistory) {
      if (entry.engagement > best.engagement) {
        best = entry;
      }
    }
    return best.params;
  }

  /**
   * React to a significant emotion change by adjusting params.
   */
  onEmotionShift(learningState: string) {
    switch (learningState) {
      case "frustrated":
        // Calm things down
        this.params.speed = Math.max(0.3, this.params.speed - 0.2);
        this.params.distortion = Math.max(0, this.params.distortion - 0.15);
        this.params.complexity = Math.max(2, this.params.complexity - 1);
        break;
      case "bored":
        // Increase visual interest
        this.params.speed = Math.min(1.5, this.params.speed + 0.3);
        this.params.complexity = Math.min(7, this.params.complexity + 1);
        this.params.symmetry = [0, 3, 4, 5, 6][Math.floor(Math.random() * 5)];
        this.params.distortion = Math.min(0.8, this.params.distortion + 0.2);
        break;
      case "delighted":
        // Enhance what's working
        this.params.speed = Math.min(1.5, this.params.speed + 0.1);
        break;
    }
  }
}
