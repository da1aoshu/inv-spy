import {handleRawDescription} from "./handleRawDescription";

export function handleRawInventoryData(res: any, timestamp: number) {
    let {assets, descriptions} = res;
    let [items, units, units_count] = handleRawDescription(descriptions);

    let items_count = 0;
    let new_items = new Map<string, any>();
    let new_units = new Map<string, any>();

    assets?.forEach((item: any) => {
        let {amount, assetid, classid, contextid, instanceid} = item;
        let unique_id = `${assetid}_${contextid}`;
        let item_id = `${classid}_${instanceid}`;
        let value = items.get(item_id);
        amount = parseInt(amount);

        if(value) {
            // 库存物品数量计数
            items_count += amount;

            // 为每个物品添加描述信息
            new_items.set(unique_id, {
                id: unique_id,
                timestamp,
                amount,
                ...value,
            });
        } else {
            value = units.get(item_id);
            if(value) {
                // 为每个组件添加描述信息
                new_units.set(unique_id, {
                    id: unique_id,
                    timestamp,
                    amount,
                    ...value,
                });
            }
        }
    });

    return {
        items_count,
        units_count,
        items: new_items,
        units: new_units,
    }
}