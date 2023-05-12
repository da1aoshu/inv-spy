import fs from "fs";
import path from "path";
import superagent from "superagent";
import {StateManager} from "./StateManager";
import {steam_429, config, getRandomUserAgent, proxy_fail} from "../../utils";

export class ProxyPool {
    private state: boolean;
    private proxy_pool: string[];
    private proxy_pool_url: string;
    private state_manager: StateManager;
    private superagent_state: Promise<null> | null;

    constructor(url: string, manager: StateManager) {
        this.state = !1;
        this.proxy_pool = [];
        this.proxy_pool_url = url;
        this.state_manager = manager;
        this.superagent_state = null;
        this.init().finally();
    }

    remote(): Promise<null> {
        let times = this.state_manager.getIpTimes() * 10;
        return new Promise((resolve) => {
            let key = config.get("proxy_param") || "num";
            superagent.get(this.proxy_pool_url)
                .set('User-Agent', getRandomUserAgent())
                .query({ [key]: times })
                .end((err, res) => {
                    if(err || res.status !== 200) {
                        return resolve(this.superagent_state = null);
                    }

                    let data = res.body;
                    if(Array.isArray(data)) {
                        let result = new Set<string>();
                        data.forEach((temp: string) => {
                            let item = "http://" + temp;
                            if(steam_429.has(item)) return;
                            if(proxy_fail.has(item)) return;

                            result.add(item);
                        });

                        if(!result.size) resolve(this.remote());

                        // 将最新获取的放到代理池队列出口处
                        this.proxy_pool.push(...result);
                    }

                    resolve(this.superagent_state = null);
                })
        });
    }

    local(): Promise<null> {
        return new Promise((resolve) => {
            fs.promises.readFile(path.join(process.cwd(), 'config.json'), 'utf8')
                .then((res: any) => {
                    res = JSON.parse(res);

                    let { proxy: { local } } = res;

                    if(Array.from(local)) {
                        let result = new Set<string>();
                        local.forEach((item: string) => {
                            item = item.toString();
                            if(steam_429.has(item)) return;
                            if(proxy_fail.has(item)) return;

                            result.add(item);
                        });

                        this.proxy_pool.unshift(...result);
                    }

                    resolve(this.superagent_state = null)
                })
                .catch(() => resolve(this.superagent_state = null))
        })
    }

    init() {
        this.superagent_state = config.get('proxy_type') ? this.local() : this.remote();

        return this.superagent_state;
    }

    async take(): Promise<string> {
        // 如果ip池余量小于一定值就及时补充
        let times = this.state_manager.getIpTimes()
        if(this.proxy_pool.length < times) {
            await (this.superagent_state || this.init());
        }

        // 判断当前代理池状态
        this.state = !!this.proxy_pool.length;

        return this.proxy_pool.pop() || '';
    }

    setIp(ip: string) {
        if(steam_429.has(ip)) return;

        // 将有用的代理放到代理池队列的前面
        return this.proxy_pool.unshift(ip);
    }
}