import {StateValue} from "../interface";

/**
 * @desc 新旧物品比较差异
 * @param old_items
 * @param new_items
 */
export function handleItemsDiff(old_items: Map<string, StateValue>, new_items: Map<string, StateValue>): [StateValue[], StateValue[]] {
    let decrease: StateValue[] = [];
    let increase: StateValue[] = [];

    // 遍历旧物品
    old_items.forEach((old_item, id) => {
        let new_item = new_items.get(id);

        // 如果被标记
        if(old_item?.mark) {
            let timestamp = new Date().getTime() - 7 * 24 * 60 * 60 * 1000;
            // 按周清除标记的数据
            if(timestamp > old_item.timestamp) {
                return old_items.delete(id);
            }
        }

        // 如果新物品中不存在，说明存入组件或卖出
        if(!new_item) {
            if(!old_item.mark) {
                decrease.push(old_item);
            }

            return;
        }

        // 新物品中存在，但是判断是否更新
        if(
            old_item.classid !== new_item.classid ||
            old_item.instanceid !== new_item.instanceid
        ) {
            // 有变化，更新旧的状态
            old_items.set(id, Object.assign(old_item, new_item));
        }

        // 无差异，如果被标记，说明是被取回的
        if(old_item.mark) {
            increase.push(old_item);
        }

        // 删除新旧交集
        new_items.delete(id);
    })

    // 遍历剩余新物品，购入或取回
    new_items.forEach((item, id) => {
        increase.push(item);
        old_items.set(id, item);
    })

    return [increase, decrease];
}