#!/usr/bin/env node

import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import {config as cache, isUrl, logger} from "./utils";
import {StateManager} from "./core/class/StateManager";

const app = async (retry: boolean = false) => {
    let config_path = path.join(process.cwd(), 'config.json');

    // 是否使用代理
    try {
        if(retry) await Promise.reject();

        fs.accessSync(config_path);
    } catch {


        await inquirer.prompt([{
            type: 'editor',
            name: 'steam_id',
            message: '请按行输入要监视的库存id：',
        },{
            type: 'confirm',
            name: 'proxy',
            message: '请问是否使用代理池：',
            default: 'true',
        },{
            type: 'list',
            name: 'proxy_type',
            message: '请选择代理类型：',
            default: 0,
            choices: [
                { value: 0, name: '本地代理' },
                { value: 1, name: '远程代理' },
            ],
            when: ({ proxy }: any) => proxy,
        },{
            type: 'editor',
            name: 'proxy_local',
            message: '请按行输入代理[http(s)://ip:port]：',
            when: ({ proxy, proxy_type }: any) => proxy && proxy_type === 0,
        },{
            type: 'input',
            name: 'proxy_url',
            message: '请输入代理池API：',
            when: ({ proxy, proxy_type }: any) => proxy && proxy_type === 1,
            validate: (input: any) => {
                if(isUrl(input)) return true;

                return '请输入正确的代理池地址';
            }
        },{
            type: 'input',
            name: 'proxy_param',
            default: 'num',
            message: '请输入代理池控制数量的参数：',
            when: ({ proxy, proxy_type }: any) => proxy && proxy_type === 1,
            validate: (input: any) => input.length || '请输入正确的参数'
        },{
            type: 'input',
            name: 'interval',
            message: '请输入监控频率（s）：',
            default: 60,
            validate: (input: any) => !!parseInt(input)
        }]).then(({ steam_id, interval, proxy, proxy_url, proxy_param, proxy_local }: any) => {
            steam_id = steam_id.split('\r\n');
            if(steam_id.length === 1) steam_id = steam_id[0];

            return fs.promises.writeFile(config_path, JSON.stringify({
                    interval,
                    steam_id: steam_id,
                    proxy: proxy ? {
                        api_url: proxy_url,
                        param: proxy_param,
                        local: proxy_local.split('\n')
                    }: {}
                }),
                'utf8'
            )
        });
    }

    fs.promises.readFile(config_path, 'utf8').then((config: any) => {
        config = JSON.parse(config);
        let { steam_id = '', proxy: { param, local, api_url }, interval = 60 } = config;

        interval = parseInt(interval.toString());

        if(Array.isArray(steam_id)) {
            for(let row in steam_id) {
                steam_id[row] = steam_id[row].toString();

                if(steam_id[row].length !== 17) {
                    logger.error(`第[${row}]行：库存ID不正确`);
                    return app(true);
                }
            }
        } else {
            steam_id = steam_id.toString();

            if(steam_id.length !== 17) {
                logger.error("config.json 中的steam_id配置错误");
                return app(true);
            }

            steam_id = [steam_id] as any;
        }

        if(!interval || interval <= 0) {
            logger.error("config.json 中的interval配置错误");
            return app(true);
        }


        let proxy_type = Array.isArray(local);
        let has_proxy = proxy_type || isUrl(api_url);

        cache.set('id', steam_id);
        cache.set('interval', interval);
        cache.set('proxy_url', api_url);
        cache.set('proxy_param', param);
        cache.set('has_proxy', has_proxy);
        cache.set('proxy_type', proxy_type);

        logger.info(`开始库存监控`);

        let manager = new StateManager(interval, api_url || '');
        (steam_id as Array<string>).forEach((id) => {
            manager.addStateMachine(id);
        })

        manager.once();
        setInterval(() => {
            manager.once();
        }, 1000 * interval)
    })
}

app().finally();