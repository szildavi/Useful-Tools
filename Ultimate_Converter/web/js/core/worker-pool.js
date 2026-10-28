/** A fixed set of Web Workers that share out conversion tasks. */

export class WorkerPool {
  #workerUrl;
  #idleWorkers = [];
  #busyWorkers = new Set();
  #waitingResolvers = [];
  #size;

  constructor(workerUrl, size) {
    this.#workerUrl = workerUrl;
    this.#size = Math.max(1, size);
  }

  get size() {
    return this.#size;
  }

  /**
   * Change how many conversions may run at once.
   *
   * Workers already running are left alone; a smaller pool simply stops handing
   * out slots until enough of them have finished.
   */
  set size(newSize) {
    this.#size = Math.max(1, newSize);
  }

  /** Run one conversion on a free worker, waiting for a slot when all are busy. */
  async run(request) {
    const worker = await this.#claimWorker();
    try {
      return await sendRequestToWorker(worker, request);
    } finally {
      this.#releaseWorker(worker);
    }
  }

  /** Stop every worker and forget them. */
  terminate() {
    for (const worker of [...this.#idleWorkers, ...this.#busyWorkers]) {
      worker.terminate();
    }
    this.#idleWorkers = [];
    this.#busyWorkers.clear();
  }

  /** Take an idle worker, creating one if the pool has not reached its size. */
  async #claimWorker() {
    const worker = this.#idleWorkers.pop() ?? this.#createWorkerIfBelowSize();
    if (worker) {
      this.#busyWorkers.add(worker);
      return worker;
    }
    return new Promise((resolve) => this.#waitingResolvers.push(resolve));
  }

  #createWorkerIfBelowSize() {
    if (this.#idleWorkers.length + this.#busyWorkers.size >= this.#size) {
      return null;
    }
    return new Worker(this.#workerUrl, { type: 'module' });
  }

  /** Hand a finished worker to whoever is waiting, or park it as idle. */
  #releaseWorker(worker) {
    this.#busyWorkers.delete(worker);
    const waitingResolver = this.#waitingResolvers.shift();
    if (waitingResolver) {
      this.#busyWorkers.add(worker);
      waitingResolver(worker);
      return;
    }
    this.#idleWorkers.push(worker);
  }
}

/** Post one request and resolve with the worker's matching reply. */
function sendRequestToWorker(worker, request) {
  return new Promise((resolve, reject) => {
    const handleMessage = (event) => {
      cleanUp();
      const reply = event.data;
      if (reply.ok) {
        resolve(reply);
      } else {
        reject(new Error(reply.error));
      }
    };
    const handleError = (event) => {
      cleanUp();
      reject(new Error(event.message || 'The conversion worker stopped unexpectedly.'));
    };
    const cleanUp = () => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
    };
    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    worker.postMessage(request, [request.buffer]);
  });
}
