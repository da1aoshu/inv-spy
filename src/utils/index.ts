export * from "./cache";
export * from "./files";
export * from "./logger";
export * from "./crypto";

import {userAgents} from "../const";

import superagent from "superagent";
import superagent_proxy from "superagent-proxy";

superagent_proxy(superagent);

export const getRandomUserAgent = () => {
    return userAgents[parseInt(String(Math.random() * userAgents.length))];
};

export const isUrl = (url: string): boolean => {
    let strRegex = '^((https|http|ftp|rtsp|mms)?://)?'
        +'(([0-9a-z_!~*().&=+$%-]+: )?[0-9a-z_!~*().&=+$%-]+@)?' //ftp的user@
        +'(([0-9]{1,3}.){3}[0-9]{1,3}|'// IP形式的URL- 127.0.0.1
        +'([0-9a-z_!~*()-]+.)*'// 域名- www.
        +'[a-z]{2,6})'//域名的扩展名
        +'(:[0-9]{1,4})?'// 端口- :80
        +'((/?)|(/[0-9a-z_!~*().;?:@&=+$,%#-]+)+/?)$';

    return new RegExp(strRegex).test(url);
}


export default superagent;