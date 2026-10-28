/**
 * Runs rendering work a few jobs at a time instead of all at once.
 *
 * Every visible page asks to be rendered as soon as it mounts, so a long
 * document would otherwise start hundreds of renders together. They all compete
 * for the single pdf.js worker, each holding a full-page canvas while it waits,
 * which makes the first page appear later than if they had been queued and can
 * exhaust memory on large documents.
 *
 * Jobs are started in the order they were requested, so the pages the user is
 * looking at are drawn first.
 */
export class RenderQueue {
  private readonly maximumConcurrentJobs: number;
  private runningJobCount = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(maximumConcurrentJobs: number) {
    this.maximumConcurrentJobs = Math.max(1, maximumConcurrentJobs);
  }

  async enqueue<TResult>(job: () => Promise<TResult>): Promise<TResult> {
    await this.waitForATurn();
    try {
      return await job();
    } finally {
      this.finishJob();
    }
  }

  private async waitForATurn(): Promise<void> {
    if (this.runningJobCount < this.maximumConcurrentJobs) {
      this.runningJobCount += 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  /**
   * Hands the slot straight to the next waiting job, so the count never dips and
   * lets more than the maximum start.
   */
  private finishJob(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.runningJobCount -= 1;
    }
  }
}
