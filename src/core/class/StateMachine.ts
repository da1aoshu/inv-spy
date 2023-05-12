import {createLogger, format, Logger} from "winston";
import superagent from "superagent";
import superagent_proxy from "superagent-proxy";
import {DataBase} from "./DataBase";
import {ProxyPool} from "./ProxyPool";
import {handleStateData} from "../handle";
import {StateType, StateValue} from "../interface";
import {handleItemsDiff, handleRawInventoryData} from "../handle";
import {steam_429, config, getRandomUserAgent, logger, proxy_fail} from "../../utils";
import dailyRoateFile from "winston-daily-rotate-file";
import path from "path";

superagent_proxy(superagent);

export default class StateMachine {
    private readonly id: string;
    private db: DataBase;
    private ready: -1|0|1|2;
    private status: boolean;
    private is_dead: boolean;
    private proxy_pool: ProxyPool;
    private update_logger: Logger;
    private readonly state: StateType = {
        value: {
            items: new Map<string, StateValue>(),
            units: new Map<string, StateValue>(),
            items_count: 0,
            units_count: 0,
            total: 0,
        },
        update: {
            operate: {
                buy: new Map(),
                sell: new Map(),
                deposit: new Map(),
                retrieve: new Map(),
            },
            timestamp: new Date().getTime()
        }
    };

    /**
     * 初始化状态
     */
    constructor(id: string, proxy_pool: ProxyPool) {
        this.id = id;
        this.db = new DataBase(id);
        this.proxy_pool = proxy_pool;
        this.update_logger = createLogger({
            format: format.combine(
                format.printf(
                    (info) => info.message
                )
            ),
            transports: new dailyRoateFile({
                filename: path.join(process.cwd(), `logs/${id}/%DATE%.log`),
                datePattern: 'YYYY-MM-DD',
            })
        });

        // 初始化数据
        this.ready = 0;
        this.status = false;
        this.is_dead = false;
        this.initStateData();
    }

    active() {
        this.is_dead = false;
    }

    /**
     * 初始化数据
     */
    initStateData() {
        if(this.ready !== 0 && this.ready !== -1) return;

        this.ready = 2;
        return Promise.all([
            this.db.readDataToMemory(this.db.items_path, this.state.value.items),
            this.db.readDataToMemory(this.db.units_path, this.state.value.units),
        ]).then(() => {
            // 更新状态的数量
            handleStateData(this.state.value);
            this.ready = 1;
        }).catch(() => Promise.reject(this.ready = 0));
    }

    /**
     * @desc 将变化的数据分类保存
     * @param src
     * @param mark
     * @param tradable
     * @param market_name
     */
    saveDataToUpdate(src: Map<string, number>, { mark, tradable, market_name }: any) {
        let name = (mark ? '*' : '') + market_name + (tradable ? ' 冷却中' : '');
        let value = src.get(name);
        src.set(name, (value || 0) + 1);
    }

    async getInventory(times: number = 0) {
        let has_proxy = config.get("has_proxy");

        // 尝试60次还无效就判定为死亡
        if(times === 60) return this.is_dead = false;

        let user_agent  = getRandomUserAgent();
        let proxy_agent = has_proxy ? await this.proxy_pool.take() : '';

        return new Promise((resolve) => {
            superagent.get(`https://steamcommunity.com/inventory/${this.id}/730/2?l=schinese&count=1000`)
                .timeout(3000)
                .disableTLSCerts()
                .proxy(proxy_agent)
                .set('User-Agent', user_agent)
                .set('Content-Type', 'application/json; charset=utf-8')
                .end((err, res) => {
                    if(err || res?.status !== 200) {
                        // 429 ip记入缓存
                        if(res?.status === 429) {
                            logger.warn("请求频繁，steam拒绝访问");

                            if(proxy_agent) steam_429.set(proxy_agent, true);
                        }

                        // 失败代理记入缓存
                        if(err) {
                            proxy_fail.set(proxy_agent, true);
                        }

                        if(has_proxy && times < 60) {
                            let message = `${proxy_agent || '无代理IP'} 代理请求失败，重新尝试中`;
                            console.log(message);
                            logger.error(message);
                            return resolve(this.getInventory(times + 1));
                        }

                        resolve(null);
                    } else {
                        resolve(res.body);
                        this.proxy_pool.setIp(proxy_agent);
                    }
                })
        })
    }

    /**
     * 更新状态
     */
    async update() {
        // 如果没有初始化成功，重新初始化
        if(this.ready !== 1) await this.initStateData();
        if(this.status) return;

        this.status = true;
        let timestamp = new Date().getTime();
        return this.getInventory().then((data: any) => {
            if(!data) {
                logger.error(`库存监控更新失败(${this.id})`);
                console.log("更新失败：" + new Date(timestamp).toLocaleString());
                this.status = false;
                return;
            }

            // 解析请求的数据
            let {items, units, items_count, units_count} = handleRawInventoryData(data, timestamp);


            let {value} = this.state;
            let is_unit_change = false;

            // 是否有组件变化，有变化更新组件数据
            units.forEach((item, id) => {
                let new_unit = units.get(id);
                let old_unit = value.units.get(id);

                // 如果添加新组件
                if(!old_unit) {
                    // 如果组件数量不为零，就有变化
                    if(new_unit.unitinfo.amount) {
                        // 添加新组件
                        is_unit_change = true;
                    }
                } else {
                    // 如果组件有变化
                    if(
                        new_unit.classid !== old_unit.classid ||
                        new_unit.instanceid !== old_unit.instanceid
                    ) {
                        is_unit_change = true;
                    } else {
                        new_unit.timestamp = old_unit.timestamp;
                    }
                }

                value.units.delete(id);
            });

            // 如果旧组件有多余，说明被删除，更新组件
            value.units.forEach((item) => {
                // 如果被删除的组件有数量
                if(item.amount) {
                    is_unit_change = true;
                }
            })

            // 更新旧组件列表
            value.units = units;

            // 初始化存疑数据
            let doubt: Map<string, number> = new Map();

            // 新增和减少的物品
            let [increase, decrease] = handleItemsDiff(value.items, items);

            let items_count_diff = items_count - value.items_count;
            let units_count_diff = units_count - value.units_count;
            let {buy, sell, deposit, retrieve} = this.state.update.operate;

            if(!is_unit_change) {
                // 组件无变化

                // 物品买入 ** 长时间运行忽略市场取回的情况 **
                increase.forEach((item) => {
                    // 可信数据
                    if(!item?.mark) {
                        this.saveDataToUpdate(buy, item);
                    } else {
                        Reflect.deleteProperty(item, 'mark');
                        this.saveDataToUpdate(retrieve, item);
                    }
                });

                // 物品卖出 ** 其实还有市场出售的情况 **
                decrease.forEach((item) => {
                    // 存疑数据
                    this.saveDataToUpdate(sell, item);
                    item['mark'] = 'sell';
                });
            } else {
                // 组件有变化

                // 物品购入或取回 ** 其实还有市场取回的情况 **
                increase.forEach((item) => {
                    // ** 在冷却期中的统一为购入 **
                    if(!item.tradable) {
                        // 可信数据
                        if(!item?.mark) {
                            this.saveDataToUpdate(buy, item);
                        } else {
                            Reflect.deleteProperty(item, 'mark');
                            this.saveDataToUpdate(retrieve, item);
                        }
                    } else {
                        // 可信数据
                        this.saveDataToUpdate(retrieve, item);
                    }
                });

                // 物品卖出或存入 ** 其实还有市场出售的情况 **
                decrease.forEach((item) => {
                    // ** 在冷却期中的统一为存入 **
                    if(!item.tradable) {
                        item['mark'] = 'deposit';
                        this.saveDataToUpdate(deposit, item);
                    } else {
                        // 无解，只能最优情况分析

                        // 如果物品减少和组件数量变化正相关
                        if(
                            items_count_diff < 0 &&
                            items_count_diff + item.amount <= 0 &&
                            items_count_diff + units_count_diff >= 0
                        ) {
                            item['mark'] = 'deposit';
                            this.saveDataToUpdate(deposit, item);
                        } else {
                            // 如果总库存减少
                            if(items_count_diff + units_count_diff <= item.amount) {
                                item['mark'] = 'sell';
                                this.saveDataToUpdate(sell, item);
                            } else {
                                this.saveDataToUpdate(doubt, item);
                                item['mark'] = 'sell|deposit';
                            }
                        }
                    }
                })
            }

            let Queue = [
                this.db.saveDataToJson(this.db.items_path, this.state.value.items),
                this.db.saveDataToJson(this.db.units_path, this.state.value.units),
            ];

            // 如果更新状态不为空，则保存
            if(sell.size || buy.size || deposit.size || retrieve.size) {
                Queue.push(this.db.setDataToJson({
                    buy: Object.fromEntries(buy.entries()),
                    sell: Object.fromEntries(sell.entries()),
                    deposit: Object.fromEntries(deposit.entries()),
                    retrieve: Object.fromEntries(retrieve.entries()),
                }));
            }

            this.state.update.timestamp = timestamp;
            logger.info(`库存监控更新成功${this.id}`);

            // 保存状态到本地
            Promise.all(Queue).then(() => {
                // 释放内存
                this.ready = -1;
                logger.info(`库存数据保存成功${this.id}`);
                console.log(`----------保存成功(${new Date(timestamp).toLocaleString()})----------`)
            }).catch(() => {
                logger.error(`库存数据保存失败${this.id}`);
                console.log(`----------保存失败(${new Date(timestamp).toLocaleString()})----------`)
            }).finally(() => {
                // 更新消息
                this.sendUpdateMessage(doubt, [items_count_diff, units_count_diff]);
                this.status = false;
            });
        })
    }
    sendUpdateMessage(doubt: Map<string, number>, diff: [number, number]) {
        let {  operate: { buy, sell, deposit, retrieve }  } = this.state.update;

        let output = `----------保存成功(${new Date(this.state.update.timestamp).toLocaleString()})----------\n`;

        console.log("购买：");
        output = output.concat("购买：\n");
        buy.forEach((count, key) => {
            console.log(`${key} × ${count}`);
            output = output.concat(`${key} × ${count}\n`);
        });

        console.log("卖出：");
        output = output.concat("卖出：\n");
        sell.forEach((count, key) => {
            console.log(`${key} × ${count}`);
            output = output.concat(`${key} × ${count}\n`);
        });

        console.log("存入：");
        output = output.concat("存入：\n");
        deposit.forEach((count, key) => {
            console.log(`${key} × ${count}`);
            output = output.concat(`${key} × ${count}\n`);
        });

        console.log("取回：");
        output = output.concat("取回：\n");
        retrieve.forEach((count, key) => {
            console.log(`${key} × ${count}`);
            output = output.concat(`${key} × ${count}\n`);
        });

        // 存疑数据
        console.log("卖出或存入：");
        output = output.concat("卖出或存入：\n");
        doubt.forEach((count, key) => {
            console.log(`${key} × ${count}`);
            output = output.concat(`${key} × ${count}\n`);
        });

        // 组件数据
        console.log("库存组件：");
        output = output.concat("库存组件：\n");
        this.state.value.units.forEach((item) => {
            if(item.timestamp === this.state.update.timestamp) {
                console.log(`[${item?.fraudwarnings ? item.fraudwarnings : '无标签'}] × ${item.unitinfo?.count}`);
                output = output.concat(`[${item?.fraudwarnings ? item.fraudwarnings : '无标签'}] × ${item.unitinfo?.count}\n`);
            }
        });

        let text = `总变化：${
            diff[0] + diff[1] > 0 ? '+' + (diff[0] + diff[1]) : diff[0] + diff[1]
        } 库存变化：${
            diff[0] > 0 ? '+' + diff[0] : diff[0]
        } 组件变化：${
            diff[1] > 0 ? '+' + diff[1] : diff[1]
        }`;

        console.log(text);
        output = output.concat(text);

        if(sell.size || buy.size || deposit.size || retrieve.size) {
            this.update_logger.info(output);
        }

        buy.clear();
        sell.clear();
        deposit.clear();
        retrieve.clear();

        if(this.ready === -1) {
            this.state.value.items.clear();
            this.state.value.units.clear();
        }
    }
}