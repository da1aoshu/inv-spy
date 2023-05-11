export * from "./cache";
export * from "./files";
export * from "./logger";
export * from "./crypto";

import {userAgents} from "../const";

export const getRandomUserAgent = () => {
    return userAgents[parseInt(String(Math.random() * userAgents.length))];
};

export const isUrl = (url: string): boolean => {
    let strRegex = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\*\+,;=.]+$/

    return new RegExp(strRegex).test(url);
}