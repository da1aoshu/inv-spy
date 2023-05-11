import {StateType} from "../interface";

export * from "./handleItemsDiff";
export * from "./handleStateData";
export * from "./handleRawInventoryData";

export const handleClearCache = (state: StateType) => {
    let {
        value: {
            items,
            units
        },
        update: {
            operate: {
                buy,
                sell,
                deposit,
                retrieve
            }
        }
    } = state;

    items.clear();
    units.clear();

    buy.clear();
    sell.clear();
    deposit.clear();
    retrieve.clear();
}