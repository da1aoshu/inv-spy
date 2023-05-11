export interface StateType {
    value: StateValueType
    update: StateUpdateType
}

export interface StateValueType {
    items: Map<string, StateValue>;
    units: Map<string, StateValue>;
    items_count: number;
    units_count: number;
    total: number;
}

export interface StateUpdateType {
    timestamp: number;
    operate: {
        buy: Map<string, number>;
        sell: Map<string, number>;
        deposit: Map<string, number>;
        retrieve: Map<string, number>;
    };
}

export interface StateValue {
    id: string;
    mark?: string;
    amount: number;
    classid: string;
    tradable: number;
    commodity: number;
    instanceid: string;
    marketable: number;
    market_name: string;
    market_hash_name: string;
    fraudwarnings?: string;
    unitinfo?: {
        count: number;
        timestamp: number;
    };
    timestamp: number;
}