#!/usr/bin/env node

import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import {config as cache, getRandomUserAgent, isUrl, logger} from "./utils";
import {StateManager} from "./core/class/StateManager";

const app = async (retry: boolean = false) => {
    let config_path = path.join(process.cwd(), 'config.json');

    // 是否使用代理
    try {
        if(retry) await Promise.reject();

        fs.accessSync(config_path);
    } catch {
        await inquirer.prompt([{
            type: 'input',
            name: 'steam_id',
            message: '请输入要监视的库存id：',
            validate: (input: any) => parseInt(input.toString()).toString().length === 17 || '请输入正确的库存id',
        },{
            type: 'confirm',
            name: 'proxy',
            message: '请问是否使用代理池：',
            default: 'true',
        },{
            type: 'input',
            name: 'proxy_url',
            message: '请输入代理池API：',
            when: ({ proxy }: any) => proxy,
            validate: (input: any) => {
                if(isUrl(input)) return true;

                return '请输入正确的代理池地址';
            }
        },{
            type: 'input',
            name: 'proxy_param',
            default: 'num',
            message: '请输入代理池控制数量的参数：',
            when: ({ proxy }) => proxy,
            validate: (input: any) => input.length || '请输入正确的参数'
        },{
            type: 'input',
            name: 'interval',
            message: '请输入监控频率（s）：',
            default: 60,
            validate: (input: any) => !!parseInt(input)
        }]).then(({ steam_id, interval, proxy, proxy_url, proxy_param }: any) => {
            return fs.promises.writeFile(config_path, JSON.stringify({
                    steam_id,
                    interval,
                    proxy: proxy ? {
                        api_url: proxy_url,
                        param: proxy_param
                    }: {}
                }),
                'utf8'
            )
        });
    }

    fs.promises.readFile(config_path, 'utf8').then((config: any) => {
        config = JSON.parse(config);
        let { steam_id = '', proxy: { param, api_url }, interval = 60 } = config;

        steam_id = steam_id.toString();
        interval = parseInt(interval.toString());

        if(steam_id.length !== 17) {
            logger.error("config.json 中的steam_id配置错误");
            return app(true);
        }

        if(!interval || interval <= 0) {
            logger.error("config.json 中的interval配置错误");
            return app(true);
        }

        if(api_url) {
            if(!isUrl(api_url)) {
                logger.error("config.json 中的api_url配置错误");
                return app(true);
            }
        }

        cache.set('id', steam_id);
        cache.set('interval', interval);
        if(api_url) {
            cache.set('proxy_url', api_url);
            cache.set('proxy_param', param);
        }

        logger.info(`开始库存监控：${steam_id}`);

        let manager = new StateManager(interval, api_url || '');
        manager.addStateMachine(steam_id).update();
        setInterval(() => {
            manager.once();
        }, 1000 * interval)
    })
}

app().finally();