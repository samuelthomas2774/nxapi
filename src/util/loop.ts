import createDebug from 'debug';

const debug = createDebug('nxapi:util:loop');

export default abstract class Loop {
    update_interval = 60;

    init(): void | Promise<LoopResult | void> {}

    abstract update(): void | Promise<LoopResult | void>;

    protected async loopRun(init = false): Promise<LoopResult> {
        try {
            const result = init ? await this.init() : await this.update();

            return result ?? (init ? LoopResult.OK_SKIP_INTERVAL : LoopResult.OK);
        } catch (err) {
            return this.handleError(err as any);
        }
    }

    async handleError(err: Error): Promise<LoopResult> {
        throw err;
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
        } finally {
            this.is_loop_active--;
            this.skip_interval_once = false;
            this.timeout_resolve = null;
        }
    }

    private skip_interval_once = false;
    private timeout_resolve: ((value: void) => void) | null = null;

    skipIntervalInCurrentLoop() {
        debug('Skip update interval', this.is_loop_active);
        if (!this.is_loop_active) return;

        this.skip_interval_once = true;
        this.timeout_resolve?.call(null);
    }
}

const LoopRunOk = Symbol('LoopRunOk');
const LoopRunOkSkipInterval = Symbol('LoopRunOkSkipInterval');

export enum LoopResult {
    OK = LoopRunOk as any,
    OK_SKIP_INTERVAL = LoopRunOkSkipInterval as any,
}
