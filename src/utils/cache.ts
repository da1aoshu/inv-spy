import NodeCache from "node-cache";

export const steam_429 = new NodeCache({
    stdTTL: 60 * 15      // 过期时间为15分钟
});

export const proxy_fail = new NodeCache({
    stdTTL: 60 * 30      // 过期时间为30分钟
});

export const config = new Map<string, any>();