/**
 * Scores how "ugly" a masked QR matrix is. The mask with the lowest score wins,
 * which is what keeps scanners reliable. Rules and weights come from the standard.
 */
class QrPenaltyScorer {
  static ADJACENT_RUN_PENALTY = 3;
  static SAME_COLOR_BLOCK_PENALTY = 3;
  static FINDER_LOOKALIKE_PENALTY = 40;
  static COLOR_IMBALANCE_PENALTY = 10;

  constructor(modules) {
    this.modules = modules;
    this.size = modules.length;
  }

  score() {
    return (
      this.scoreRows() +
      this.scoreColumns() +
      this.scoreSameColorBlocks() +
      this.scoreColorImbalance()
    );
  }

  scoreRows() {
    return this.scoreLines((row, index) => this.modules[row][index]);
  }

  scoreColumns() {
    return this.scoreLines((column, index) => this.modules[index][column]);
  }

  /** Walks every row or column once, charging for long runs and finder look-alikes. */
  scoreLines(readModule) {
    let total = 0;
    for (let line = 0; line < this.size; line++) {
      let runIsDark = false;
      let runLength = 0;
      const runHistory = new Array(7).fill(0);

      for (let index = 0; index < this.size; index++) {
        if (readModule(line, index) === runIsDark) {
          runLength++;
          if (runLength === 5) {
            total += QrPenaltyScorer.ADJACENT_RUN_PENALTY;
          } else if (runLength > 5) {
            total += 1;
          }
        } else {
          this.pushRunToHistory(runLength, runHistory);
          if (!runIsDark) {
            total += this.countFinderLookalikes(runHistory) * QrPenaltyScorer.FINDER_LOOKALIKE_PENALTY;
          }
          runIsDark = readModule(line, index);
          runLength = 1;
        }
      }
      total +=
        this.countFinderLookalikesAtLineEnd(runIsDark, runLength, runHistory) *
        QrPenaltyScorer.FINDER_LOOKALIKE_PENALTY;
    }
    return total;
  }

  scoreSameColorBlocks() {
    let total = 0;
    for (let row = 0; row < this.size - 1; row++) {
      for (let column = 0; column < this.size - 1; column++) {
        const color = this.modules[row][column];
        const isUniformBlock =
          color === this.modules[row][column + 1] &&
          color === this.modules[row + 1][column] &&
          color === this.modules[row + 1][column + 1];
        if (isUniformBlock) {
          total += QrPenaltyScorer.SAME_COLOR_BLOCK_PENALTY;
        }
      }
    }
    return total;
  }

  scoreColorImbalance() {
    const totalModules = this.size * this.size;
    const darkModules = this.countDarkModules();
    const deviationSteps =
      Math.ceil(Math.abs(darkModules * 20 - totalModules * 10) / totalModules) - 1;
    return deviationSteps * QrPenaltyScorer.COLOR_IMBALANCE_PENALTY;
  }

  countDarkModules() {
    return this.modules.reduce(
      (rowTotal, row) => rowTotal + row.reduce((count, isDark) => count + (isDark ? 1 : 0), 0),
      0
    );
  }

  /** Detects the 1:1:3:1:1 finder-pattern ratio surrounded by light space. */
  countFinderLookalikes(runHistory) {
    const unit = runHistory[1];
    const hasFinderCore =
      unit > 0 &&
      runHistory[2] === unit &&
      runHistory[3] === unit * 3 &&
      runHistory[4] === unit &&
      runHistory[5] === unit;
    if (!hasFinderCore) {
      return 0;
    }
    const hasLeadingGap = runHistory[0] >= unit * 4 && runHistory[6] >= unit;
    const hasTrailingGap = runHistory[6] >= unit * 4 && runHistory[0] >= unit;
    return (hasLeadingGap ? 1 : 0) + (hasTrailingGap ? 1 : 0);
  }

  countFinderLookalikesAtLineEnd(runIsDark, runLength, runHistory) {
    let remainingRun = runLength;
    if (runIsDark) {
      this.pushRunToHistory(remainingRun, runHistory);
      remainingRun = 0;
    }
    remainingRun += this.size; // The quiet zone behaves like a very long light run.
    this.pushRunToHistory(remainingRun, runHistory);
    return this.countFinderLookalikes(runHistory);
  }

  pushRunToHistory(runLength, runHistory) {
    const isFirstRun = runHistory[0] === 0;
    runHistory.pop();
    runHistory.unshift(isFirstRun ? runLength + this.size : runLength);
  }
}
