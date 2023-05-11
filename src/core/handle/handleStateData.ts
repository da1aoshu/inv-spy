import {StateValueType} from "../interface";

export function handleStateData(value: StateValueType) {
    let { items, units } = value;

    value.total = 0;
    value.items_count = 0;
    value.units_count = 0;

    items.forEach((item) => {
        if(item.mark) return;
        value.items_count += item.amount;
    })

    units.forEach((item) => {
        value.units_count += item.unitinfo?.count || 0;
    })

    value.total = value.items_count + value.units_count;
}