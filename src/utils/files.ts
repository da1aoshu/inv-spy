import fs from "fs";
import path from "path";

export function mkdirs(dirname: string, callback: () => void) {
    //检测目录是否存在，不存在就创建
    if(fs.existsSync(dirname)) {
        callback();
    } else {
        mkdirs(path.dirname(dirname), function () {
            fs.mkdir(dirname, callback);
        });
    }
}