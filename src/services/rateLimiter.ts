// Spaces out the *start* of API requests so a burst of parallel requests doesn't trip
// per-minute rate limits. Requests run concurrently once started — how many run at once
// is controlled by the concurrency level in the UI.

interface QueuedRequest<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

export class RateLimiter {
  private queue: QueuedRequest<any>[] = [];
  private processing = false;
  private lastStartTime = 0;

  constructor(private minDelayMs: number = 1000) {}

  /**
   * Add a request to the queue; resolves with the request's result
   */
  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      void this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const wait = this.minDelayMs - (Date.now() - this.lastStartTime);
      if (wait > 0) await this.sleep(wait);

      const request = this.queue.shift();
      if (!request) break;

      this.lastStartTime = Date.now();
      // Start the request without waiting for it to finish
      request.fn().then(request.resolve, request.reject);
    }

    this.processing = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Reject and drop all requests that haven't started yet
   */
  clear(): void {
    this.queue.forEach((request) => request.reject(new Error('Request cancelled')));
    this.queue = [];
  }
}
