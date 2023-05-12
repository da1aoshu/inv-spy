import fs from "fs";
import path from "path";
import {mkdirs} from "../../utils";

export class DataBase {
    public readonly id: string;
    public units_path: string = '';
    public items_path: string = '';
    public update_path: string = '';

    constructor(id: string) {
        this.id = id;
        this.init(id);
    }

    /**
     * @desc 初始化本地数据存储文件
     * @param id
     */
    init(id: string) {
        if(!id && id.length !== 17) {
            console.warn('Steam id is error');
        }

        let units_path  = path.join(process.cwd(), `db/units`);
        let items_path  = path.join(process.cwd(), `db/items`);
        let update_path = path.join(process.cwd(), `db/update`);

        try {
            fs.accessSync(units_path);
            fs.accessSync(items_path);
            fs.accessSync(update_path);
            fs.writeFileSync(path.join(units_path, `${id}.json`), '');
            fs.writeFileSync(path.join(items_path, `${id}.json`), '');
            fs.writeFileSync(path.join(update_path, `${id}.json`), '');
        } catch(err) {
            mkdirs(units_path, () => {
                fs.writeFileSync(path.join(units_path, `${id}.json`), '');
            });
            mkdirs(items_path, () => {
                fs.writeFileSync(path.join(items_path, `${id}.json`), '');
            });
            mkdirs(update_path, () => {
                fs.writeFileSync(path.join(update_path, `${id}.json`), '');
            });
        }

        this.units_path = path.join(units_path, `${id}.json`);
        this.items_path = path.join(items_path, `${id}.json`);
        this.update_path = path.join(update_path, `${id}.json`);
    }

    /**
     * @desc 更新新的物品
     * @param path
     * @param data
     */
    async setDataToJson(data: any, path: string = this.update_path) {
        return this.readDataToMemory(path).then((res) => {
            res.set((res.size).toString(), data);

            return this.saveDataToJson(path, res);
        })
    }

    /**
     * @desc 读取数据到内存
     * @param path
     * @param data
     */
    async readDataToMemory(path: string, data?: Map<string, any>) {
        return fs.promises.readFile(path, 'utf8').then((res) => {
            let temp: any = res.toString();
            data = data || new Map();

            data.clear();

            try {
                temp = JSON.parse(temp);
            } catch {
                temp = { };
            }

            for(let key of Object.keys(temp)) {
                data.set(key, temp[key]);
            }

            return data;
        });
    }

    /**
     * @desc 保存数据到本地
     * @param path
     * @param data
     */
    async saveDataToJson(path: string, data: any) {
        data = JSON.stringify(Object.fromEntries(data));

        return fs.promises.writeFile(path, data, 'utf8');
    }

    /**
     * @desc 清空本地数据
     * @param path
     */
    async clearJsonData(path: string) {
        return fs.promises.writeFile(path, '', 'utf8');
    }
}