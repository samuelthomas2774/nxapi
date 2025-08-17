import createDebug from './debug.js';

const debug = createDebug('nxapi:util:loop');

export default abstract class Loop {
    update_interval = 60;
    errors = 0;

    init(): void | Promise<LoopResult | void> {}

    abstract update(): void | Promise<LoopResult | void>;

    protected async loopRun(init = false): Promise<LoopResult> {
        try {
            const result = init ? await this.init() : await this.update();

            this.errors = 0;

            return result ?? (init ? LoopResult.OK_SKIP_INTERVAL : LoopResult.OK);
        } catch (err) {
            this.errors++;
            return this.handleError(err as any);
        }
    }

    async handleError(err: Error): Promise<LoopResult> {
        throw err;
    }

    get next_update_interval() {
        return this.update_interval * Math.min(this.errors / 2, 20);
    }

    private is_loop_active = 0;

    async loop(init = false) {
        try {
            this.is_loop_active++;

            const result = await this.loopRun(init);

            if (result === LoopResult.OK) {
                if (this.skip_interval_once) {
                    this.skip_interval_once = false;
                } else {
                    await new Promise(rs => setTimeout(this.timeout_resolve = rs, this.update_interval * 1000));
                }
            }
            if (result === LoopResult.DEFER_NEXT_UPDATE) {
                if (this.skip_interval_once) {
                    this.skip_interval_once = false;
                } else {
                    await new Promise(rs => setTimeout(this.timeout_resolve = rs, this.next_update_interval * 1000));
                }
            }
            if (result === LoopResult.STOP) {
                return LoopResult.STOP;
            }
        } finally {
            this.is_loop_active--;
            this.skip_interval_once = false;
            this.timeout_resolve = null;
        }
    }

    private skip_interval_once = false;
    protected timeout_resolve: ((value: void) => void) | null = null;

    skipIntervalInCurrentLoop() {
        debug('Skip update interval', this.is_loop_active);
        if (!this.is_loop_active) return;

        this.skip_interval_once = true;
        this.timeout_resolve?.call(null);
    }
}

const LoopRunOk = Symbol('LoopRunOk');
const LoopRunOkSkipInterval = Symbol('LoopRunOkSkipInterval');
const LoopRunIncrementInterval = Symbol('LoopRunIncrementInterval');
const LoopRunStop = Symbol('LoopRunStopNow');

export enum LoopResult {
    OK = LoopRunOk as any,
    OK_SKIP_INTERVAL = LoopRunOkSkipInterval as any,
    DEFER_NEXT_UPDATE = LoopRunIncrementInterval as any,
    STOP = LoopRunStop as any,
}

export abstract class EmbeddedLoop extends Loop {
    onStop?(): Promise<void> | void;

    enable() {
        if (this._running !== 0) return;
        this._run();
    }

    disable() {
        this._running = 0;
        this.skipIntervalInCurrentLoop();
    }

    get enabled() {
        return this._running !== 0;
    }

    private _running = 0;

    private async _run() {
        this._running++;
        const i = this._running;

        try {
            const result = await this.loop(true);
            if (result === LoopResult.STOP) return;

            while (i === this._running) {
                const result = await this.loop();

                if (result === LoopResult.STOP) {
                    await this.onStop?.();
                    return;
                }
            }

            if (this._running === 0 && !this.onStop) {
                // Run one more time after the loop ends
                const result = await this.loopRun();
            }

        } finally {
            this._running = 0;
        }
    }
}
