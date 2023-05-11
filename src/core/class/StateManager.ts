import {ProxyPool} from "./ProxyPool";
import StateMachine from "./StateMachine";


export class StateManager {
    public proxy_pool: ProxyPool;
    public interval: number;
    public state_machines: Map<string, StateMachine>;

    constructor(interval: number, proxy_pool: string) {
        this.interval = interval;
        this.state_machines = new Map();
        this.proxy_pool = new ProxyPool(proxy_pool, this);
    }
    /**
     * @desc 全部状态机更新一次
     */
    once() {
        this.state_machines.forEach((state_machine) => {
            state_machine.update().finally();
        })
    }

    /**
     * @desc 获取该状态管理器每分钟所需ip
     */
    getIpTimes() {
        return Math.floor(60 / this.interval) * this.state_machines.size;
    }

    /**
     * @desc 新增状态机
     * @param id
     */
    addStateMachine(id: string) {
        let state_machine = this.state_machines.get(id);
        if(state_machine) return state_machine;

        state_machine = new StateMachine(id, this.proxy_pool);
        this.state_machines.set(id, state_machine);

        return state_machine;
    }

    /**
     * @desc 激活状态机
     */
    activeStateMachine(id: string) {
        let cache = this.state_machines.get(id);

        if(cache) {
            cache.active();
        }
    }

    /**
     * @desc 删除状态机
     */
    deleteStateMachine(id: string) {
        if(this.state_machines.has(id)) {
            this.state_machines.delete(id);
        }
    }
}